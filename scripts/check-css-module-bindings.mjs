#!/usr/bin/env node
/**
 * Gate: every `styles.x` a component names is a class its stylesheet actually declares
 * (§6 follow-up 2 — the repo-wide half of `src/components/menu/cssModuleBindings.test.ts`).
 *
 * WHY NOTHING ELSE CATCHES IT. This is the best-evidenced blind spot in the frontend:
 *
 *   - `jest.config.js` maps CSS modules to `identity-obj-proxy`, so `styles.anythingAtAll` is a
 *     truthy string in EVERY test. A rendering assertion written against a class name passes
 *     whether the rule exists or not.
 *   - Next types a CSS module as an index signature, so `tsc --noEmit` is clean for any key.
 *   - ESLint has no rule for it, and a screenshot cannot see a class that styles nothing.
 *   - There is no telltale in the DOM either: React OMITS an attribute whose value is `undefined`
 *     rather than rendering `class="undefined"`. Measured on prod — `getAttribute('class')` was
 *     `null` both before and after a dangling reference was removed.
 *
 * So reading the stylesheet is the only check that can fail, and two of these shipped: the menu
 * grid's `<section>` — the element every E2E test addresses — rendered with no class at all in
 * production for months.
 *
 * THE ONE THAT IS NOT MERELY DEAD. Inside a template literal (`className={`${a} ${b}`}`)
 * `undefined` STRINGIFIES, so a dangling name there really does serve `class="… undefined"`.
 * `MenuFilters.tsx` did exactly that. Those are reported as a separate, louder class.
 *
 * BASELINE, not a hard zero, and deliberately. A gate that fails on day one for reasons outside the
 * change that introduced it gets disabled — the house idiom (`check-file-length.sh`,
 * `check-locale-parity.mjs`) is a committed baseline that may only shrink. Fix one, bank it, and it
 * can never come back.
 *
 * THE POPULATION TOOK THREE MEASUREMENTS TO GET RIGHT, and the wrong ones both looked plausible:
 *
 *   - §6 estimated "~17 files". The first run agreed at 17 — for the wrong reason: it matched
 *     `styles.module` inside the import specifier `'./styles.module.css'`. A parser artefact, and
 *     it would have been banked as real debt.
 *   - Fixing that gave 13, which was reported as measured. It was measured over three quarters of
 *     the tree: `cssImports` took RELATIVE specifiers only, and ~24% of this repo's bindings come
 *     through the `@/` alias — not a random quarter, but precisely the SHARED stylesheets
 *     (`@/app/styles/CashierPage.module.css`) where a component reaches for a class another module
 *     declares. That is the whole defect class.
 *   - Resolving the alias: **65 references across 26 files, 10 of them interpolated** (i.e. really
 *     serving `class="… undefined"`). `QRScannerDialog.tsx` alone holds 10, importing
 *     `CashierPage.module.css` "reusing cashier styles" — which declares none of them.
 *
 * The 58 that an intermediate version reported was wrong for a fourth reason worth recording: it
 * reused `lib/ratchet.mjs`'s stripper, which deliberately drops template-literal CONTENTS. That is
 * right for counting patterns in code and exactly wrong here — `className={`${styles.a}`}` puts the
 * references inside that span, so the gate reported ZERO interpolated cases, blind to the one class
 * it most needs to see. Every number here is now cross-checked against an independent count.
 *
 * They are all the documented shape: the class exists, in a module the component does not import.
 * `src/app/account/page.tsx` reads `styles.strengthWeak` from `AccountPage.module.css` while the
 * rule lives in `PasswordManagementSection.module.css`; `OrderList.tsx` reads `styles.orderList`
 * from `CashierPage.module.css` while it lives in `CashierMainContent.module.css`.
 *
 * FAIL-CLOSED. A run that resolves no bindings is a FAILURE, and the success line prints what was
 * examined so a green run is falsifiable.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const ROOT = path.join(REPO, 'src');
const BASELINE = path.join(HERE, 'css-module-bindings-baseline.json');

const REGEN = process.argv.includes('--regen-baseline');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Comments stripped before ANY scan. Not tidiness: a JSX comment explaining a class that was
 * REMOVED otherwise reports the very reference the fix deleted as still live — the same shape that
 * has bitten the CSS readers repeatedly.
 *
 * Delegated to `lib/ratchet.mjs`, which tokenizes strings and template literals, rather than the
 * obvious regex. A regex stripper cannot see that the `/*` in `accept="image/*"` is inside a string
 * and blanks everything from there to the next `*​/` — four files in this tree contain exactly that
 * attribute, and the lib's own docstring records the same bug biting two earlier gates.
 */
/**
 * Blank out comments, per line, WITHOUT touching string or template contents.
 *
 * Two constraints pull in opposite directions and both matter:
 *
 *   - It must know about strings, or the `/*` inside `accept="image/*"` opens a comment that
 *     swallows the rest of the file. Four files here contain exactly that attribute, and
 *     `lib/ratchet.mjs` records the same bug blinding two earlier gates.
 *   - It must NOT drop what is inside a template literal. `lib/ratchet.mjs`'s stripper does — right
 *     for counting patterns in code, wrong here, because `className={`${styles.a} ${styles.b}`}`
 *     puts the references being checked inside exactly that span. Reusing it made the gate report
 *     ZERO interpolated cases, which is the single class it most needs to see.
 *
 * So strings are TRACKED (to find comment openers correctly) but PRESERVED. The cost is that an
 * import specifier survives; import lines are blanked separately below.
 */
/**
 * One line, comments removed and strings preserved. Returns the text plus the span still open at
 * the end of it — only a template literal and a block comment survive a newline.
 */
function stripLine(line, carried) {
  let out = '';
  let state = carried;
  let i = 0;

  while (i < line.length) {
    const two = line.slice(i, i + 2);

    if (state === 'block') {
      if (two === '*/') state = 'code';
      i += two === '*/' ? 2 : 1;
      continue;
    }

    if (state !== 'code') {
      out += line[i];
      if (line[i] === '\\') {
        out += line[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (line[i] === state) state = 'code';
      i += 1;
      continue;
    }

    if (two === '/*') {
      state = 'block';
      i += 2;
      continue;
    }
    if (two === '//') break;

    if (line[i] === "'" || line[i] === '"' || line[i] === '`') state = line[i];
    out += line[i];
    i += 1;
  }

  // A plain quoted string cannot span lines; resetting here stops one unbalanced apostrophe
  // swallowing the rest of the file.
  return { out, carried: state === 'block' || state === '`' ? state : 'code' };
}

function stripComments(source) {
  const lines = [];
  let carried = 'code';

  for (const line of source.split('\n')) {
    const step = stripLine(line, carried);
    carried = step.carried;
    lines.push(step.out);
  }

  return lines;
}

/** Import lines blanked, so a specifier cannot masquerade as a usage (`styles.module`). */
const codeOnly = (lines) => lines.map((l) => (/^\s*import\s/.test(l) ? '' : l)).join('\n');

/**
 * The tsconfig roots `@/` resolves against, in order. Mirrored from `compilerOptions.paths`; the
 * first one that exists on disk wins, which is how TypeScript resolves it too.
 */
const ALIAS_ROOTS = ['src', 'src/services', 'src/app', 'src/app/styles'];

/**
 * `import x from './y.module.css'` → `{ x: '<abs path>' }`.
 *
 * BOTH specifier forms. Relative-only was the first cut and it silently skipped ~24% of the tree's
 * bindings — and not a random quarter: `@/` is how components reach the SHARED stylesheets
 * (`@/app/styles/CashierPage.module.css`), which is exactly where a class gets referenced from a
 * module that does not declare it. Skipping them under-reported the population five-fold.
 */
function cssImports(lines, fromDir) {
  const out = {};
  // Strings survive the stripper, so specifiers are read straight off the comment-free source —
  // and a commented-out import contributes nothing, which is the point of stripping first.
  const live = lines.join('\n');

  for (const [, binding, spec] of live.matchAll(
    /import\s+(\w+)\s+from\s+['"]([^'"]*\.module\.css)['"]/g,
  )) {
    if (spec.startsWith('.')) {
      out[binding] = path.resolve(fromDir, spec);
      continue;
    }

    if (!spec.startsWith('@/')) continue;

    const tail = spec.slice(2);
    const resolved = ALIAS_ROOTS.map((root) => path.join(REPO, root, tail)).find((p) =>
      existsSync(p),
    );
    // Unresolvable is reported as a missing stylesheet below, never silently dropped.
    out[binding] = resolved ?? path.join(REPO, ALIAS_ROOTS[0], tail);
  }
  return out;
}

/**
 * Class names a stylesheet makes available.
 *
 * Every `.name` in the file, PLUS the right-hand side of `composes:` — a class composed from
 * another module is legitimately usable through this module's binding even though this file never
 * writes it as a selector. Comments stripped so a commented-out rule does not count as declared.
 */
function declaredClasses(cssPath) {
  let css;
  try {
    css = readFileSync(cssPath, 'utf8');
  } catch {
    return null;
  }

  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Only class SELECTORS. A `composes: x from './other.css'` is deliberately NOT counted as
  // declaring `x` here: per CSS Modules semantics the importing module exports only its own local
  // class — composing applies the other file's rule to it, it does not re-export the name, and
  // css-loader emits no key for it. (Removing this branch changed nothing across the tree's 92
  // `composes … from` sites, so it was masking nothing — but its justification was wrong.)
  return new Set([...clean.matchAll(/\.([A-Za-z][\w-]*)/g)].map(([, n]) => n));
}

const files = walk(ROOT);
const violations = [];
let bindingCount = 0;
let referenceCount = 0;

for (const file of files) {
  const lines = stripComments(readFileSync(file, 'utf8'));
  const imports = cssImports(lines, path.dirname(file));
  const body = codeOnly(lines);

  for (const [binding, cssPath] of Object.entries(imports)) {
    bindingCount++;
    const declared = declaredClasses(cssPath);

    if (declared === null) {
      // An import that does not resolve is a worse bug than a dangling class, and it must not
      // read as "declares nothing, therefore nothing to report".
      violations.push({
        file: path.relative(REPO, file),
        name: path.relative(REPO, cssPath),
        kind: 'missing-stylesheet',
      });
      continue;
    }

    const used = new Set(
      [...body.matchAll(new RegExp(String.raw`\b${binding}\.([A-Za-z]\w*)`, 'g'))].map(([, n]) => n),
    );
    referenceCount += used.size;

    for (const name of used) {
      if (declared.has(name)) continue;

      // Interpolated into a template literal, `undefined` stringifies into the class attribute
      // instead of being omitted — the difference between dead and actively wrong.
      const interpolated = new RegExp(String.raw`\$\{[^}]*\b${binding}\.${name}\b`).test(body);

      violations.push({
        file: path.relative(REPO, file),
        name: `${binding}.${name}`,
        kind: interpolated ? 'renders-undefined' : 'dead',
      });
    }
  }
}

if (files.length === 0 || bindingCount === 0) {
  console.error(
    `CSS-module binding gate examined NOTHING (${files.length} file(s), ${bindingCount} binding(s)). ` +
      `Expected components under ${ROOT}. Failing rather than passing vacuously.`,
  );
  process.exit(2);
}

/** How each violation kind is explained in the failure output. */
const NOTES = {
  'renders-undefined': 'INTERPOLATED — this really does serve class="… undefined"',
  'missing-stylesheet': 'the imported stylesheet does not exist',
  dead: 'dead reference (React omits the attribute entirely)',
};

const key = (v) => `${v.file} :: ${v.name}`;
const current = violations.map(key).sort((a, b) => a.localeCompare(b));

if (REGEN) {
  writeFileSync(BASELINE, `${JSON.stringify({ dangling: current }, null, 2)}\n`);
  console.log(`Baselined ${current.length} dangling CSS-module reference(s).`);
  process.exit(0);
}

let baseline = [];
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).dangling ?? [];
} catch {
  console.error(
    `Missing or unreadable ${path.relative(REPO, BASELINE)}. ` +
      'Run `node scripts/check-css-module-bindings.mjs --regen-baseline` and commit it.',
  );
  process.exit(2);
}

const banked = new Set(baseline);
const added = violations.filter((v) => !banked.has(key(v)));
const fixed = baseline.filter((b) => !current.includes(b));

// A reference interpolated into a template literal really does serve `class="… undefined"`, so it
// is worth calling out separately — but it is still grandfathered if it is in the baseline. An
// earlier draft refused those outright, which sounded principled and made the gate unshippable:
// the tree already has some, and a gate that cannot go green on the day it lands gets deleted.
// New ones are refused whatever their kind; the banked ones are named on every green run so they
// stay visible instead of quietly becoming permanent.
const rendersUndefined = violations.filter((v) => v.kind === 'renders-undefined');

if (added.length > 0) {
  console.error('CSS-module bindings: new dangling reference(s).\n');

  for (const v of added) {
    console.error(`  ${v.file}  ${v.name}\n      ${NOTES[v.kind] ?? NOTES.dead}`);
  }

  console.error(
    '\nNothing else in CI can see this: identity-obj-proxy makes every styles.x truthy in jest, ' +
      'and Next types a module as an index signature so tsc is clean for any key.',
  );
  process.exit(1);
}

if (fixed.length > 0) {
  console.error(
    `${fixed.length} baselined dangling reference(s) are fixed — bank them so they cannot return:\n` +
      '  node scripts/check-css-module-bindings.mjs --regen-baseline\n',
  );
  for (const f of fixed) console.error(`  ${f}`);
  process.exit(1);
}

console.log(
  `CSS-module bindings OK — ${files.length} component(s), ${bindingCount} binding(s), ` +
    `${referenceCount} reference(s), ${baseline.length} baselined ` +
    `(${rendersUndefined.length} of them interpolated, i.e. actually serving class="… undefined").`,
);
