#!/usr/bin/env node
/**
 * Gate: every `src/**\/*.module.css` is imported by at least one `.ts`/`.tsx` file (issue #615).
 *
 * WHAT IT CATCHES, AND WHY THREE EXISTING GATES COULD NOT.
 * `ProductIngredientsManager.module.css` — 379 lines, 28 classes — had no importer at all. Its
 * component moved to `IngredientGroup.module.css` in #588 and the stylesheet was left behind.
 * Every CSS gate on this repo ran on every PR for weeks and none of them could state the shape:
 *
 *   - `check-css-module-bindings.mjs` asks whether every USED binding exists. There are no uses,
 *     so there is nothing to resolve and nothing to report.
 *   - the physical-CSS ratchet (E8) counts declarations in the BUILT css. A file with no importer
 *     is not built, so its declarations are not counted.
 *   - the file-length gate DID see it — and `scripts/file-length-baseline.txt` EXCUSED it. That is
 *     worse than blindness: the entry made the file look like owned, tracked debt.
 *
 * An orphan is not a broken binding. It is NO binding, which is precisely the shape a
 * binding-checker cannot express, and the reason this is a separate pass rather than a new rule
 * inside the old one.
 *
 * WHY IT MATCHES THE IMPORT AND NOT THE CLASS USE. A stylesheet can be imported and have every one
 * of its classes unused (dead rules — a different, milder problem the bindings gate is closer to).
 * It can also be referenced by name in a comment, a baseline file or a doc and still be orphaned:
 * the orphaned file's ONLY surviving mention anywhere in the repo was its own line in the
 * file-length baseline. The import is the one thing that decides whether the bytes ship.
 *
 * TEST FILES COUNT AS IMPORTERS, deliberately. The alternative — production importers only —
 * reports a stylesheet used solely by a test fixture as an orphan, and the fix a reader would then
 * apply is to delete a file a test depends on. The narrower rule is worth having one day; it is not
 * worth shipping a gate whose first failure teaches people to distrust it.
 *
 * NO BASELINE. The house idiom is a shrink-only baseline, and it is deliberately NOT used here: the
 * check found exactly one violation in the whole tree and it was real, so a baseline would exist
 * only to hold zero entries and to offer somewhere to hide the next one. If a future tree
 * legitimately needs an exception, add it as an explicit, commented allow-list — not a regenerable
 * file.
 *
 * FAIL-CLOSED. A run that finds no stylesheets, or that resolves no imports at all, is a FAILURE:
 * both are what a broken scanner looks like, and both would otherwise read as a clean tree forever.
 * The success line prints what was examined so a green run is falsifiable.
 *
 *   node scripts/check-css-module-orphans.mjs
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './lib/comment-stripper.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const ROOT = path.join(REPO, 'src');

/**
 * The tsconfig roots `@/` resolves against, in order; the first that exists on disk wins, which is
 * how TypeScript resolves it too. Mirrored from `check-css-module-bindings.mjs` — an alias-blind
 * first cut of THAT gate silently skipped ~24% of the tree, and an alias-blind orphan check would
 * make the same mistake in the louder direction: it would report every alias-imported stylesheet as
 * dead.
 */
const ALIAS_ROOTS = ['src', 'src/services', 'src/app', 'src/app/styles'];

function walk(dir, test) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, test));
    else if (test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Every `*.module.css` specifier a source file imports, resolved to an absolute path.
 *
 * BOTH import forms, and this is not hypothetical tidiness:
 *   `import styles from './X.module.css'`  — the common one;
 *   `import '@/app/styles/X.module.css'`   — SIDE-EFFECT, no binding at all.
 * A regex requiring a binding cannot see the second, and would report a genuinely used stylesheet
 * as an orphan — a false positive on a gate is how gates get switched off.
 */
function importedStylesheets(source, fromDir) {
  const out = [];
  // Comments stripped first, so a commented-out import cannot keep a dead file alive. Strings are
  // preserved by the shared stripper, which is what lets the specifier itself survive.
  const live = stripComments(source);

  // ONE greedy class whose next token it cannot itself match, so the engine never backtracks:
  // `[^'"]*` stops dead at the first quote, which is also what stops a match starting at an
  // `import` line from reaching a string several lines below — a quote is a hard barrier, so
  // `readFileSync(join(__dirname, '../X.module.css'))` is NOT read as an import. An earlier version
  // spelled the two import forms out as `(?:[\w*{}\s,]+\s+from\s+)?`, where a class containing
  // `\s` is followed by `\s+`: ambiguous, super-linear on backtracking, and SonarCloud rule S8786
  // was right to refuse it. This form covers both shapes — `import './x.module.css'` with no
  // binding at all, and `import styles from './x.module.css'` — without the alternation.
  for (const [, spec] of live.matchAll(/\bimport\s[^'"]*['"]([^'"]*\.module\.css)['"]/g)) {
    if (spec.startsWith('.')) {
      out.push(path.resolve(fromDir, spec));
      continue;
    }
    if (!spec.startsWith('@/')) continue;

    const tail = spec.slice(2);
    out.push(ALIAS_ROOTS.map((root) => path.join(REPO, root, tail)).find((p) => existsSync(p)) ?? path.join(REPO, 'src', tail));
  }
  return out;
}

/**
 * Stylesheets a STYLESHEET pulls in: `composes: x from './y.module.css'` and `@import`.
 *
 * MEASURED, and the reason this function exists at all: without it the first run reported
 * `templates/craft/primitives.module.css` as dead. Nine craft stylesheets compose their buttons and
 * card plates from it and NO `.tsx` imports it directly — it is alive, widely used, and invisible
 * to a scanner that only reads TypeScript. A gate whose first output tells you to delete the
 * design system's primitives is a gate that gets switched off the same afternoon.
 */
function composedStylesheets(css, fromDir) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [
    ...clean.matchAll(/composes:[^;}]*?from\s+['"]([^'"]+\.css)['"]/g),
    ...clean.matchAll(/@import\s+(?:url\()?['"]([^'"]+\.css)['"]/g),
  ].map(([, spec]) =>
    spec.startsWith('@/')
      ? (ALIAS_ROOTS.map((root) => path.join(REPO, root, spec.slice(2))).find((p) => existsSync(p)) ??
        path.join(REPO, 'src', spec.slice(2)))
      : path.resolve(fromDir, spec),
  );
}

const stylesheets = walk(ROOT, (name) => name.endsWith('.module.css'));
const sources = walk(ROOT, (name) => /\.tsx?$/.test(name));

const imported = new Set();
for (const file of sources) {
  for (const target of importedStylesheets(readFileSync(file, 'utf8'), path.dirname(file))) imported.add(target);
}

/**
 * Reachability, not a single hop. A stylesheet composed only from an ORPHAN is itself dead, so the
 * live set is the transitive closure from the TypeScript entry points — the same reason a linker
 * walks the graph instead of counting references.
 */
const queue = [...imported];
while (queue.length > 0) {
  const sheet = queue.pop();
  let css;
  try {
    css = readFileSync(sheet, 'utf8');
  } catch {
    continue; // A missing target is the bindings gate's problem, not this one's.
  }
  for (const next of composedStylesheets(css, path.dirname(sheet))) {
    if (!imported.has(next)) {
      imported.add(next);
      queue.push(next);
    }
  }
}

const rel = (p) => path.relative(REPO, p);
const orphans = stylesheets.filter((sheet) => !imported.has(sheet)).map(rel).sort();

if (orphans.length > 0) {
  console.error(`✗ ${orphans.length} orphaned CSS module(s) — no .ts/.tsx file imports them:\n`);
  for (const orphan of orphans) console.error(`  ${orphan}`);
  console.error('\nDelete the file, or import it from the component that needs it.');
  process.exit(1);
}

/**
 * The fail-closed guards run ONLY on the green path, and the ordering is the whole point.
 *
 * They were written above the verdict first, which was wrong and its own test caught it: a tree
 * whose stylesheets are ALL orphaned resolves zero imports, so the guard fired and reported
 * "the scanner is broken" while suppressing a list of real orphans it had already computed.
 *
 * A GUARD AGAINST A FALSE GREEN MUST NEVER BE ABLE TO SWALLOW A RED. The only result that needs
 * corroboration is the one that says there is nothing to see.
 */
if (stylesheets.length === 0) {
  console.error('✗ found no *.module.css under src/ — the scanner is broken, not the tree');
  process.exit(1);
}
if (imported.size === 0) {
  console.error('✗ resolved no *.module.css imports at all — the scanner is broken, not the tree');
  process.exit(1);
}

console.log(
  `✓ every CSS module is imported (${stylesheets.length} stylesheets, ${imported.size} resolved imports, ${sources.length} sources)`,
);
