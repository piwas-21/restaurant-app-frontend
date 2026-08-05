#!/usr/bin/env node
/**
 * Gate: a CSS Modules class that `composes` a base from ANOTHER file must not re-declare one of
 * that base's own properties in a way whose winner is decided by source order (#447).
 *
 * WHY. `composes` does not merge declarations — it puts a SECOND class on the element. Base and
 * site are then two selectors of equal specificity on the same element, so the winner is whichever
 * comes later in the cascade. Within one emitted stylesheet that is source order and it is stable.
 * When the two land in different route chunks it is `<link>` order, which chunk placement decides,
 * not the import graph.
 *
 * Not theoretical: PR #446 deleted some dead CSS and one component, the chunk boundary moved, and
 * `checkout/sections.module.css .sectionTitle` flipped against its composed `.tapeLabel`. Every
 * craft checkout heading lost the gap between its icon and its text (`gap` is inert on
 * `inline-block`) and dropped from 1.4rem to 1.25rem. tsc, eslint, prettier, jest, both CSS
 * ratchets and the bundle gate were green with that live — only the screenshot baseline saw it.
 *
 * THE FIX IT ENFORCES. Keep `composes` on the plain `.x` rule (CSS Modules requires a simple
 * selector there) and move the overriding declarations to `.x.x` — 0,2,0 beats the base's 0,1,0
 * whatever the order.
 *
 * FOUR checks, because the naive version of this gate had three ways to pass while blind:
 *
 *   A. site plain vs base plain — the original tie.
 *   B. site plain vs base DOUBLED — worse than a tie: the base wins ALWAYS, so the site's
 *      declaration is dead code. Introduced the moment a base file adopts the doubled fix
 *      (`primitives.module.css .btnKraft.btnKraft`), which this repo now has.
 *   C. site doubled vs base DOUBLED — the same tie one specificity level up. The prescribed fix
 *      does not generalise, so it has to be checked, not assumed.
 *   D. a property doubled on the base rule of a class that ALSO declares it on a single-class
 *      selector inside `@media` — the responsive rule drops below the new 0,2,0 rule and silently
 *      stops applying. This is the highest-risk half of the fix and nothing else can see it.
 *
 * Shorthands are expanded before comparing: a base declaring `padding` and a site declaring
 * `padding-inline` collide just as hard as two `padding`s, and the physical-CSS ratchet actively
 * pushes authors from `padding-left` toward `padding-inline-start`, i.e. straight into this.
 *
 * FAIL-CLOSED. Every earlier version of this file could print OK having checked nothing: a renamed
 * template directory left the corpus empty, and an unresolvable `composes` target resolved to "the
 * base declares no properties" and therefore "no violation". Both now fail loudly, and the success
 * line prints what was actually examined so a green run is falsifiable. `scripts/lib/ratchet.mjs`
 * already argues this case for the sibling gates: a corpus that vanishes is a FAILURE, not a pass.
 *
 * SCOPE is every `*.module.css` under `src/` that composes from another file — not just craft.
 * Craft is the only current population (87 of the 89 `composes` sites in the tree; the other two
 * are `composes: … from global`), but the hazard is a property of CSS Modules, not of one template,
 * and scoping to a directory is what made the vanishing-corpus bug possible.
 *
 * Cascade layers would fix the class structurally and are the better end state. Not done here:
 * layering the base files moves every craft rule at once, which needs the linux-only screenshot
 * regeneration to verify, and the layer-order statement must live somewhere guaranteed to load
 * before every base file. See #447.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', 'src');

/** Longhands each shorthand can collide with. Only the ones this tree actually uses. */
const SHORTHAND = {
  background: ['background-color', 'background-image', 'background-position', 'background-size'],
  border: ['border-color', 'border-width', 'border-style'],
  padding: [
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'padding-inline',
    'padding-block',
    'padding-inline-start',
    'padding-inline-end',
  ],
  margin: [
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'margin-inline',
    'margin-block',
    'margin-inline-start',
    'margin-inline-end',
  ],
  font: ['font-size', 'font-family', 'font-weight', 'font-style'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
  transition: ['transition-property', 'transition-duration', 'transition-timing-function'],
  inset: ['top', 'right', 'bottom', 'left'],
  gap: ['row-gap', 'column-gap'],
};

/** A property plus everything it can collide with, lowercased (CSS names are case-insensitive). */
function collisionKeys(prop) {
  const p = prop.toLowerCase();
  const keys = new Set([p]);
  for (const [short, longs] of Object.entries(SHORTHAND)) {
    if (p === short) longs.forEach((l) => keys.add(l));
    else if (longs.includes(p)) keys.add(short);
  }
  return keys;
}

function collide(a, b) {
  for (const p of a) for (const k of collisionKeys(p)) if (b.has(k)) return true;
  return false;
}

function sharedProps(siteProps, baseProps) {
  const out = new Set();
  for (const p of siteProps) if (collide(new Set([p]), baseProps)) out.add(p);
  return [...out].sort((a, b) => a.localeCompare(b));
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.module.css')) out.push(full);
  }
  return out;
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * `composes: a b from './x.module.css'` | `composes: a b` | `composes: x from global`.
 * Returns null for the `from global` form (a :global reference has no base rule to tie
 * against). Split on the keyword rather than one regex over the whole value: the obvious
 * `^(.+?)\s+from\s+['"](.+?)['"]$` backtracks super-linearly.
 */
function parseComposesValue(value, file) {
  const fromAt = value.search(/\sfrom\s/);
  if (fromAt < 0) {
    return { names: value.split(/\s+/).filter(Boolean), file };
  }
  const names = value.slice(0, fromAt).split(/\s+/).filter(Boolean);
  const target = value
    .slice(fromAt)
    .replace(/^\s*from\s*/, '')
    .trim();
  if (target === 'global') return null;
  const quoted = /^(['"])([^'"]*)\1$/.exec(target);
  if (!quoted) return { names, file };
  return { names, file: path.resolve(path.dirname(file), quoted[2]) };
}

/**
 * Parse one module. Per class:
 *   plain    — props on `.x`
 *   doubled  — props on `.x.x`
 *   media    — props on `.x` INSIDE an at-rule
 *   composes — [{name, file, unresolved}]
 */
function parse(file) {
  const text = stripComments(readFileSync(file, 'utf8'));
  const classes = new Map();
  const stack = [];
  let buf = '';
  let unbalanced = false;

  const entryFor = (name) => {
    if (!classes.has(name)) {
      classes.set(name, { plain: new Set(), doubled: new Set(), media: new Set(), composes: [] });
    }
    return classes.get(name);
  };

  const record = (selector, body, inAtRule) => {
    for (const raw of selector.split(',')) {
      const sel = raw.trim();
      const plain = /^\.([A-Za-z0-9_-]+)$/.exec(sel);
      const dbl = /^\.([A-Za-z0-9_-]+)\.\1$/.exec(sel);
      if (!plain && !dbl) continue;
      const name = (plain ?? dbl)[1];
      const entry = entryFor(name);
      let bucket = entry.plain;
      if (dbl) bucket = entry.doubled;
      else if (inAtRule) bucket = entry.media;

      for (const decl of body.split(';')) {
        const idx = decl.indexOf(':');
        if (idx < 0) continue;
        const prop = decl.slice(0, idx).trim();
        const val = decl.slice(idx + 1).trim();
        if (prop.toLowerCase() === 'composes') {
          const parsedComposes = parseComposesValue(val, file);
          if (parsedComposes === null) continue; // `from global`: no base rule to tie against
          for (const t of parsedComposes.names) {
            entry.composes.push({ name: t, file: parsedComposes.file });
          }
        } else if (prop && !prop.startsWith('--')) {
          bucket.add(prop.toLowerCase());
        }
      }
    }
  };

  for (const ch of text) {
    if (ch === '{') {
      const sel = buf.trim();
      buf = '';
      stack.push({ sel, isAt: sel.startsWith('@') });
    } else if (ch === '}') {
      const top = stack.pop();
      if (top === undefined) unbalanced = true;
      else if (!top.isAt)
        record(
          top.sel,
          buf,
          stack.some((s) => s.isAt),
        );
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (stack.length > 0) unbalanced = true;
  return { classes, unbalanced };
}

const files = walk(ROOT);
const parsed = new Map(files.map((f) => [f, parse(f)]));

const errors = [];

// --- fail-closed corpus assertions ---------------------------------------------------------
const composingFiles = [...parsed.values()].filter((p) =>
  [...p.classes.values()].some((c) => c.composes.length > 0),
).length;

if (files.length === 0) {
  errors.push(`no *.module.css found under ${ROOT} — the gate examined NOTHING. Fix the path.`);
}
if (composingFiles === 0) {
  errors.push(
    `found ${files.length} module(s) but NONE uses \`composes\`. That is either a broken parser or a\n` +
      `  repo-wide refactor; either way this gate is no longer protecting anything. Fix or delete it.`,
  );
}
for (const [file, p] of parsed) {
  if (p.unbalanced) errors.push(`${path.relative(ROOT, file)}: unbalanced braces — parser cannot trust this file`);
}

const get = (file, cls) => parsed.get(file)?.classes.get(cls);

/** Transitive bases; records unresolvable targets rather than treating them as empty. */
function bases(file, cls, seen = new Set()) {
  const out = [];
  for (const { name, file: target } of get(file, cls)?.composes ?? []) {
    const key = `${target}::${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!get(target, name)) {
      errors.push(
        `${path.relative(ROOT, file)} .${cls}: composes \`${name}\` from ` +
          `\`${path.relative(ROOT, target)}\`, which does not resolve to a class this gate can read.\n` +
          `  Refusing to report "no violation" for a base whose properties are unknown.`,
      );
      continue;
    }
    out.push({ file: target, cls: name }, ...bases(target, name, seen));
  }
  return out;
}

const violations = [];
let edges = 0;

/** Check D — this class's own @media rule sits below its own doubled rule. */
function checkMediaShadowing(file, cls, entry) {
  const shared = sharedProps(entry.media, entry.doubled);
  if (shared.length === 0) return [];
  return [
    {
      kind: "@media override sits BELOW this class's own doubled rule",
      site: path.relative(ROOT, file),
      cls,
      base: `${path.relative(ROOT, file)} .${cls}.${cls}`,
      shared,
      hint: `double the @media selector too (\`.${cls}.${cls}\`), or the responsive step never applies`,
    },
  ];
}

/** Checks A/B/C — this class against one cross-file base. */
function checkAgainstBase(file, cls, entry, base) {
  const b = get(base.file, base.cls);
  const common = {
    site: path.relative(ROOT, file),
    cls,
    base: `${path.relative(ROOT, base.file)} .${base.cls}`,
  };
  const found = [];

  const tie = sharedProps(entry.plain, b.plain);
  if (tie.length) {
    found.push({ ...common, kind: 'source-order tie', shared: tie, hint: `move these onto \`.${cls}.${cls}\`` });
  }

  const dead = sharedProps(entry.plain, b.doubled);
  if (dead.length) {
    found.push({
      ...common,
      kind: 'base wins ALWAYS (base declares these on a doubled selector) — this override is dead',
      shared: dead,
      hint: 'the base should not double a property its consumers override',
    });
  }

  const bothDoubled = sharedProps(entry.doubled, b.doubled);
  if (bothDoubled.length) {
    found.push({
      ...common,
      kind: 'source-order tie at 0,2,0 (both sides doubled)',
      shared: bothDoubled,
      hint: 'the doubled fix does not stack; resolve at the base',
    });
  }
  return found;
}

for (const [file, p] of parsed) {
  for (const [cls, entry] of p.classes) {
    if (entry.composes.length === 0) continue;
    violations.push(...checkMediaShadowing(file, cls, entry));

    for (const base of bases(file, cls)) {
      edges += 1;
      // Same stylesheet: source order cannot be split by chunking.
      if (base.file === file) continue;
      violations.push(...checkAgainstBase(file, cls, entry, base));
    }
  }
}

if (errors.length > 0 || violations.length > 0) {
  if (errors.length) {
    console.error(`\ncomposes gate: ${errors.length} problem(s) that make the result untrustworthy.\n`);
    for (const e of errors) console.error(`  ${e}`);
  }
  if (violations.length) {
    console.error(`\ncomposes gate: ${violations.length} override(s) whose winner is not deterministic.\n`);
    const ordered = [...violations].sort((x, y) => x.site.localeCompare(y.site) || x.cls.localeCompare(y.cls));
    for (const v of ordered) {
      console.error(`  ${v.site}  .${v.cls}  — ${v.kind}`);
      console.error(`    against ${v.base}`);
      console.error(`    properties: ${v.shared.join(', ')}`);
      console.error(`    fix: ${v.hint}`);
    }
  }
  console.error(
    `\nWhy this matters and how the doubled-selector fix works: scripts/check-composes-overrides.mjs, and #447.\n`,
  );
  process.exit(1);
}

console.log(
  `composes gate: OK — ${files.length} module(s), ${composingFiles} using composes, ` +
    `${edges} composes edge(s) checked, 0 non-deterministic overrides.`,
);
