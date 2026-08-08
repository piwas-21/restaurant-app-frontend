import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Every `styles.x` the menu section's components name is a class its stylesheet actually declares.
 *
 * Written because two of them were not, and both shipped.
 *
 *   - `MenuSectionStatus.tsx` read `styles.loading` from `MenuSectionStatus.module.css` while the
 *     rule sat in `MenuSkeletonRows.module.css`, a module it does not import (introduced and caught
 *     inside S10).
 *   - `MenuContent.tsx` has read `styles.categorySection` since long before this slice, and
 *     `MenuContent.module.css` has never declared it. The menu grid's `<section>` — the element
 *     every E2E test addresses — has been rendering `class="undefined"` in production.
 *
 * NOTHING else can see this class of defect, which is why it survived:
 *
 *   - `jest.config.js` maps CSS modules to `identity-obj-proxy`, so `styles.anythingAtAll` is a
 *     truthy string in every test. A rendering assertion written against a class name passes
 *     whether the rule exists or not — proven by writing one first and watching it stay green
 *     through a mutation that pointed the class at a name nobody had written.
 *   - Next types a CSS module as an index signature, so `tsc --noEmit` is clean for any key.
 *   - ESLint has no rule for it, and the screenshot gate cannot see a class that styles nothing.
 *
 * Scoped to the menu section's own components. Repo-wide the same scan finds dangling references in
 * ~17 more files (cashier, admin, account, the cookie banner) — real, and a different slice's work.
 * The house idiom for that is a script with a baseline, as `check-file-length.sh` and
 * `check-locale-parity.mjs` both use; this is the slice boundary, not a claim the rest is clean.
 */

const COMPONENTS = [
  'MenuContent.tsx',
  'MenuSectionStatus.tsx',
  'MenuSkeletonRows.tsx',
  '../../templates/craft/surfaces/CraftMenuSectionStatus.tsx',
];

/** `import x from './y.module.css'` → `{ x: '<abs path>' }`. Relative specifiers only. */
function cssImports(source: string, fromDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, binding, spec] of source.matchAll(/import\s+(\w+)\s+from\s+'(\.[^']*\.module\.css)'/g)) {
    out[binding] = resolve(fromDir, spec);
  }
  return out;
}

/** Class selectors a stylesheet declares, comments stripped so a commented-out rule does not count. */
function declaredClasses(css: string): Set<string> {
  return new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.([A-Za-z][\w-]*)/g)].map(([, name]) => name));
}

describe('menu section CSS-module bindings', () => {
  const cases = COMPONENTS.flatMap((rel) => {
    const file = join(__dirname, rel);
    // Comments stripped, and not as tidiness: `MenuContent.tsx` explains a REMOVED
    // `styles.categorySection` in a JSX comment, so an unstripped scan reports the very reference
    // this slice deleted as still live. The same shape that has bitten the CSS readers three times.
    const source = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    return Object.entries(cssImports(source, dirname(file))).map(([binding, cssPath]) => {
      const used = [...source.matchAll(new RegExp(`\\b${binding}\\.([A-Za-z]\\w*)`, 'g'))].map(([, name]) => name);
      return { rel, binding, cssPath, used: [...new Set(used)] };
    });
  });

  /** An empty corpus would pass every assertion below — the failure mode this whole file guards. */
  it('finds the bindings it is supposed to be checking', () => {
    expect(cases.length).toBeGreaterThanOrEqual(4);
    expect(cases.flatMap((c) => c.used).length).toBeGreaterThanOrEqual(20);
  });

  it.each(cases.map((c) => [`${c.rel} ${c.binding}`, c] as const))('%s resolves every class it names', (_label, c) => {
    const declared = declaredClasses(readFileSync(c.cssPath, 'utf8'));
    expect(c.used.filter((name) => !declared.has(name))).toEqual([]);
  });
});
