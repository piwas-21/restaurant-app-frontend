import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

/**
 * The "four footers, not two" guard.
 *
 * The trap this exists for: the chrome HIDES its footer on the home page and each template's
 * home page composes its OWN footer, so the tenant site has FOUR public footers, not the two
 * a reader of `SOFRA-PARTNER-PLAN §11g` would count. Shipping the credit into two of them
 * makes it appear on the menu page and vanish on the home page — the most visited page of a
 * restaurant's site — and nothing in a screenshot or a unit test of the component itself
 * would connect the symptom to the cause.
 *
 * So this test does not name the four files: it ENUMERATES every `<footer>` in `src/` and
 * requires each one to render `<PartnerCredit />`, minus a single explicit exclusion. A fifth
 * public footer added next year fails here on the day it is added.
 */

const SRC = resolve(__dirname, '..');

/**
 * The staff/admin chrome. Deliberately excluded: partner attribution is a PUBLIC credit aimed
 * at a diner, and `/admin`, `/cashier`, `/server` and `/kitchen-staff` are the restaurant's
 * own back office. Remove this entry, not the assertion, if that decision is ever reversed.
 */
const EXCLUDED = ['app/app-internal-layout.tsx'];

function footerFiles(): string[] {
  const out = execFileSync('grep', ['-rl', '--include=*.tsx', '<footer', SRC], { encoding: 'utf8' });
  return (
    out
      .split('\n')
      .filter(Boolean)
      .map((p) => p.slice(SRC.length + 1))
      // This file quotes the tag it searches for, and a test that asserts about ITSELF passes
      // vacuously — it contains both strings by construction.
      .filter((f) => !f.includes('.test.'))
      .sort()
  );
}

describe('partner credit render sites', () => {
  const files = footerFiles();

  it('finds every footer in the tree, not a hand-written list', () => {
    // Positive control: the scan must actually see the two sites the plan DID name, or an
    // empty/short result below would read as "all footers covered".
    expect(files).toEqual(expect.arrayContaining(['templates/classic/chrome/CustomerChrome.tsx']));
    expect(files).toEqual(expect.arrayContaining(['templates/craft/chrome/CraftFooter.tsx']));
    // …and the two the plan did NOT: the home pages that compose their own footer.
    expect(files).toEqual(expect.arrayContaining(['templates/classic/HomePage.tsx']));
    expect(files).toEqual(expect.arrayContaining(['templates/craft/HomePage.tsx']));
  });

  it.each(footerFiles().filter((f) => !EXCLUDED.includes(f)))('%s renders <PartnerCredit />', (file) => {
    const source = readFileSync(join(SRC, file), 'utf8');
    expect(source).toContain("import PartnerCredit from '@/components/PartnerCredit';");
    expect(source).toContain('<PartnerCredit />');
  });

  it('excludes only the staff/admin chrome, and only on purpose', () => {
    expect(EXCLUDED).toEqual(['app/app-internal-layout.tsx']);
    expect(files).toEqual(expect.arrayContaining(EXCLUDED));
  });
});
