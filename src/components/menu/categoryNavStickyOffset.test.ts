import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression gate for the empty strip above the sticky category nav on mobile.
 *
 * The bar hardcoded `top: 130px` at both mobile breakpoints, with the comment
 * "80px header + 50px TableBanner". `TableBanner` renders `null` unless the guest arrived by
 * scanning a table QR, so on every ordinary mobile visit the page reserved 50px for a banner that
 * was not there and the bar floated with a gap above it.
 *
 * jsdom computes no sticky positioning and no cascade, so there is nothing to observe by rendering:
 * the defect lives entirely in the relationship between a stylesheet constant and a conditional
 * component. This asserts that relationship at the source level — the same approach
 * `featuredSpecialPlacement.test.ts` takes to the banner's position in the tree — and, crucially,
 * pins the *shape* of the fix (a variable both sides agree on) rather than the number, so a future
 * header-height change cannot reintroduce a second hardcoded total.
 */

/**
 * Comments are stripped before anything is counted. Both files being checked here EXPLAIN this
 * defect in prose, quoting the old `top: 130px` and the old 50px assumption while doing so — so a
 * gate reading the raw text fails on the documentation of the very thing it is checking for. (It
 * did, twice, while this file was being written.)
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const NAV_CSS = withoutComments(readFileSync(join(__dirname, 'CategoryNav.module.css'), 'utf8'));
const OFFSET_HOOK = withoutComments(readFileSync(join(__dirname, '../../hooks/menu/useStickyNavOffset.ts'), 'utf8'));
const MENU_PAGE = readFileSync(join(__dirname, '../../app/menu/page.tsx'), 'utf8');
const TABLE_BANNER = readFileSync(join(__dirname, '../TableBanner.tsx'), 'utf8');

describe('sticky category-nav offset', () => {
  it('is computed from a banner variable, not a hardcoded header+banner total', () => {
    const sticky = /\.stickyNav\s*\{[^}]*\}/.exec(NAV_CSS)?.[0];
    expect(sticky).toBeDefined();
    expect(sticky).toContain('--menu-banner-offset');
    expect(sticky).toMatch(/top:\s*calc\(/);
  });

  it('never re-hardcodes the banner allowance at any breakpoint', () => {
    // The exact number that was wrong, and the pattern that produced it: any `top` on this bar
    // that is a bare pixel literal is the bug coming back.
    expect(NAV_CSS).not.toContain('130px');
    // The lookbehind is load-bearing: a bare /top:/ also matches `margin-top`, so the first draft
    // of this gate failed on the notice line's `margin-top: 2px`.
    const hardcodedTops = NAV_CSS.match(/(?<![\w-])top:\s*\d+px/g) ?? [];
    expect(hardcodedTops).toEqual([]);
  });

  it('has exactly one declaration of the offset, so breakpoints cannot disagree', () => {
    const declarations = NAV_CSS.match(/top:\s*calc\(/g) ?? [];
    expect(declarations).toHaveLength(1);
  });

  it('is fed from the same context that decides whether the banner renders', () => {
    // The banner's own condition — if this changes, the hook's gate has to change with it.
    expect(TABLE_BANNER).toContain('if (!hasTableContext)');
    expect(OFFSET_HOOK).toContain('useTableContext');
    expect(OFFSET_HOOK).toContain('hasTableContext');
  });

  it('MEASURES the banner rather than asserting a height', () => {
    // The original defect was a stale constant (50px for a banner that is 64px at 390px wide and
    // varies with padding, font and wrapping). A fresher constant would drift the same way, so the
    // gate is on the mechanism: the offset comes from the element's own box.
    expect(OFFSET_HOOK).toContain('ResizeObserver');
    expect(OFFSET_HOOK).toContain('getBoundingClientRect');
    expect(OFFSET_HOOK).toMatch(/'--menu-banner-offset':\s*`\$\{bannerHeight\}px`/);
    // No hardcoded banner height anywhere in the hook. The header's own 80px is fine — the header
    // is a fixed-height bar, and both stickies read it from one place.
    expect(OFFSET_HOOK).not.toContain('50px');
  });

  it('sticks the banner below the header, so the reserved band is actually occupied', () => {
    // Reserving space for the banner is only half the fix: the banner used to stick at `top: 0`,
    // behind the fixed header, so the band rendered empty even when a banner existed.
    const bannerCss = withoutComments(readFileSync(join(__dirname, '../TableBanner.module.css'), 'utf8'));
    const top = /\.banner\.top\s*\{[^}]*\}/.exec(bannerCss)?.[0];
    expect(top).toBeDefined();
    expect(top).toContain('--menu-header-offset');
    expect(top).not.toMatch(/top:\s*0\s*;/);
    // The banner has to carry the marker the hook measures, or the height silently stays 0.
    expect(TABLE_BANNER).toContain('STICKY_BANNER_ATTR');
  });

  it('is actually applied to the menu page root', () => {
    // The hook can be correct and still change nothing if the page stops passing it through.
    expect(MENU_PAGE).toContain('useStickyNavOffset');
    expect(MENU_PAGE).toMatch(/style=\{stickyNavOffset\}/);
  });
});
