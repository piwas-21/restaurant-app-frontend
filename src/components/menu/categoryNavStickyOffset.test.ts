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
const PAGE_CSS = withoutComments(readFileSync(join(__dirname, '../../app/styles/MenuPage.module.css'), 'utf8'));
const OFFSET_HOOK = withoutComments(readFileSync(join(__dirname, '../../hooks/menu/useStickyNavOffset.ts'), 'utf8'));
const MENU_PAGE = readFileSync(join(__dirname, '../../app/menu/page.tsx'), 'utf8');
const MENU_CONTENT = readFileSync(join(__dirname, 'MenuContent.tsx'), 'utf8');
const TABLE_BANNER = readFileSync(join(__dirname, '../TableBanner.tsx'), 'utf8');

/** The offset of a marker in the menu page's source, so "before/after" questions are answerable. */
function pageIndexOf(needle: string): number {
  const at = MENU_PAGE.indexOf(needle);
  if (at === -1) throw new Error(`marker not found in menu/page.tsx: ${needle}`);
  return at;
}

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

/**
 * The bar is page chrome, not a widget in the article column (S11).
 *
 * It used to render inside `MenuContent`, which sits in the LEFT cell of `.menuLayout`
 * (`minmax(0, 1fr) 360px`). A sticky bar with a background, a hairline and a shadow therefore
 * painted across 775px of a 1280px frame and stopped dead under the basket rail. Same class of
 * defect as the one `featuredSpecialPlacement.test.ts` guards, and read the same way: which parent
 * an element is under is a source-structure fact, and jsdom computes neither sticky nor cascade.
 */
describe('the category bar is page chrome, not a column widget', () => {
  it('renders OUTSIDE the two-column layout', () => {
    // Assert the bar is on the page BEFORE asserting where it is not. "Not inside the layout" is
    // equally true of a page that does not render it at all — which is what this looked like
    // before the hoist, and the first draft of this test passed against that source.
    expect(pageIndexOf('<CategoryNav')).toBeGreaterThan(0);
    const layoutStart = pageIndexOf('className={styles.menuLayout}');
    expect(MENU_PAGE.slice(layoutStart).includes('<CategoryNav')).toBe(false);
  });

  it('renders above everything else on the page, including the hero (D7)', () => {
    // Nav-first is the decision: below the promotion, a phone guest scrolled the whole thing before
    // the tabs appeared and then watched them jump when it scrolled past.
    //
    // The hero is no longer a strip BETWEEN the two — it is the grid's first cell, handed down as
    // `featuredSlot` — so the old three-way ordering collapses to "the bar comes before the
    // layout", and the hero's own position is `featuredSpecialPlacement.test.ts`'s subject.
    expect(pageIndexOf('<CategoryNav')).toBeLessThan(pageIndexOf('className={styles.menuLayout}'));
    expect(pageIndexOf('<CategoryNav')).toBeLessThan(pageIndexOf('<FeaturedSpecialComponent'));
    expect(pageIndexOf('<FeaturedSpecialComponent')).toBeGreaterThan(pageIndexOf('className={styles.menuLayout}'));
  });

  it('is not rendered by the column component it was lifted out of', () => {
    // The other direction: nothing stops someone re-adding it where it used to be, which would
    // render two bars rather than fail visibly.
    expect(MENU_CONTENT).not.toContain('<CategoryNav');
  });

  it('cancels the page gutter with the same variable the page publishes', () => {
    const container = /\.menuContainer\s*\{[^}]*\}/.exec(PAGE_CSS)?.[0];
    expect(container).toBeDefined();
    expect(container).toContain('--menu-page-gutter:');
    // The page box has to reach the viewport edge for the bar to, which means cancelling the
    // shell's own inset. Shape, not number: a negative inline margin, whatever the shell insets by.
    expect(container).toMatch(/margin-inline:\s*-/);

    const sticky = /\.stickyNav\s*\{[^}]*\}/.exec(NAV_CSS)?.[0];
    expect(sticky).toMatch(/margin-inline:\s*calc\(-1 \* var\(--menu-page-gutter/);
    expect(sticky).toMatch(/padding-inline:\s*var\(--menu-page-gutter/);
    // globals.css caps EVERY element at `max-width: 100%` below 768px. A class outranks the
    // universal selector, and without this the negative margins only shift the bar inline-start.
    expect(sticky).toContain('max-width: none');

    // The page box has to be able to reach the edge too. `width: 98%` put its 2% slack on ONE side,
    // which left the bar 56.97px short of the right edge at 1280px — measured. Both declarations
    // are load-bearing and neither is obvious from the other.
    expect(container).toContain('width: auto');
    expect(container).toContain('max-width: none');
  });

  /**
   * The shell inset is a CROSS-FILE coupling, and the shape-only assertion above cannot see it: a
   * shell that changed to `2rem` would leave the page inset 16px a side with this gate green.
   * Both templates inset by the same 1rem today, and the bar's negative margin is written to match.
   */
  it('cancels an inset that matches what the chrome actually applies', () => {
    const classicChrome = readFileSync(join(__dirname, '../../templates/classic/chrome/CustomerChrome.tsx'), 'utf8');
    const craftChrome = readFileSync(join(__dirname, '../../templates/craft/chrome/chrome.module.css'), 'utf8');

    // Classic insets its <main> inline; craft does it in CSS. Both are 1rem, which is what
    // `.menuContainer`'s `margin-inline: -1rem` exists to cancel.
    expect(classicChrome).toMatch(/padding:\s*isHomePage \? '0' : '1rem'/);
    expect(craftChrome).toMatch(/padding:\s*1rem/);

    const menuContainer = /\.menuContainer\s*\{[^}]*\}/.exec(PAGE_CSS)?.[0];
    expect(menuContainer).toMatch(/margin-inline:\s*-1rem/);
  });

  it('never re-hardcodes the page gutter at a breakpoint', () => {
    // The bar reads one variable. A breakpoint that narrows the container's padding without
    // narrowing that variable makes the bar overflow the page by the difference on each side.
    const blocks = PAGE_CSS.match(/\.menuContainer\s*\{[^}]*\}/g) ?? [];
    expect(blocks.length).toBeGreaterThan(1);
    for (const block of blocks) {
      if (!block.includes('padding')) continue;
      expect(block).toMatch(/padding:[^;]*var\(--menu-page-gutter\)/);
    }
  });
});

/**
 * The basket rail sticks below the bar (S6).
 *
 * Since S11 made the bar page-wide chrome it spans the rail's column too, and the rail's `top: 1rem`
 * cleared neither it nor the header: measured at 1280px, 91.3px of the rail — heading included —
 * scrolled underneath. The screenshot suite shoots an unscrolled `fullPage`, so none of this is
 * visible to it; these are the only automated assertions the offset has.
 */
describe('basket rail sticky offset', () => {
  const RAIL_CSS = withoutComments(readFileSync(join(__dirname, '../order/OrderFlowSidebar.module.css'), 'utf8'));
  const CRAFT_RAIL_CSS = withoutComments(
    readFileSync(join(__dirname, '../../templates/craft/surfaces/CraftOrderFlowSidebar.module.css'), 'utf8'),
  );
  const NAV_SHELL = readFileSync(join(__dirname, 'CategoryNavShell.tsx'), 'utf8');

  it('publishes the bar height the rail reads', () => {
    expect(OFFSET_HOOK).toMatch(/'--menu-nav-offset':\s*`\$\{navHeight\}px`/);
    // The bar has to carry the marker, or the height silently stays 0 and the rail keeps the bug.
    expect(NAV_SHELL).toContain('STICKY_NAV_ATTR');
  });

  /**
   * The nav mounts AFTER this hook — `MenuPage` returns `null` until it has a selected view — and
   * React then REPLACES the node rather than resizing it. A `ResizeObserver` alone survives neither:
   * the first published `0px` forever, the second `45px` against a live 66.8px bar. Both were
   * shipped and caught by measuring the running page, so the mechanism is pinned here.
   */
  it('keeps tracking the bar when it mounts late or is replaced', () => {
    expect(OFFSET_HOOK).toContain('MutationObserver');
    // Identity comparison, not a "have we got one yet" flag — the latter is exactly the one-shot
    // version that published the stale 45px.
    expect(OFFSET_HOOK).toContain('el === tracked');
  });

  /**
   * Each template reads ITS OWN header height. `--menu-header-offset` is published as a flat 80px
   * for both, and craft's header is 76px — so craft takes `--craft-header-h`, the variable
   * `CraftCategoryNav.module.css` already sticks its own bar to. Pinned per template because the
   * first draft gave craft the shared 80px and put the pad 4px off the bar it sits against.
   */
  it.each([
    ['classic', () => RAIL_CSS, '--menu-header-offset'],
    ['craft', () => CRAFT_RAIL_CSS, '--craft-header-h'],
  ])('%s rail clears its own header AND the bar, from variables', (_name, css, headerVar) => {
    const sidebar = /\.sidebar\s*\{[^}]*\}/.exec(css())?.[0];
    expect(sidebar).toBeDefined();
    expect(sidebar).toContain('position: sticky');
    expect(sidebar).toContain(headerVar);
    expect(sidebar).toContain('--menu-nav-offset');
    // `top: 1rem` was the whole defect: a bare literal that clears nothing.
    expect(sidebar).not.toMatch(/(?<![\w-])top:\s*[\d.]+(px|rem)\s*;/);
  });

  it('does not give craft the classic template’s header constant', () => {
    // 80px vs craft's 76px. The shared variable is right for classic and wrong here.
    expect(CRAFT_RAIL_CSS).not.toContain('--menu-header-offset');
  });

  /**
   * The rail is GONE from /menu, and with it the whole class of sticky-offset problem this block
   * was written about.
   *
   * The original defect: `.menuLayout` set `align-items: start`, which shrink-wrapped the rail's
   * cell to exactly the rail's own height (measured 369.6px for a 369.6px rail), so a `position:
   * sticky` with zero travel had never stuck at any offset. The fix was `align-self: stretch` on
   * the cell. Both are now moot — the basket is a slide-over opened from the sticky bar
   * (`CartSheet`), which is a dialog and does not stick to anything.
   *
   * Asserted as an ABSENCE rather than deleted, so re-adding a rail to this page cannot quietly
   * reintroduce a cell with no travel: the rules would have to come back with it, and this fails
   * the moment one does without the other.
   */
  it('has no rail column left to stick, and no orphan rules pretending otherwise', () => {
    expect(/\.menuSidebarColumn\s*\{/.exec(PAGE_CSS)).toBeNull();
    expect(PAGE_CSS).not.toContain('align-items: start');
    expect(MENU_PAGE).not.toContain('<OrderFlowSidebar');
    // The replacement is the FLOATING cart button, and the property that makes it a replacement is
    // that it renders at every count — the rail's own guarantee. A second copy briefly lived in
    // this bar doing the same job from the other corner; it is gone, and the sticky bar is back to
    // being only a category bar.
    expect(MENU_PAGE).toContain('<FloatingCartButton');
    expect(MENU_PAGE).not.toContain('<MenuBasketButton');
    expect(readFileSync(join(__dirname, 'FloatingCartButton.tsx'), 'utf8')).not.toContain('itemCount === 0');
  });
});
