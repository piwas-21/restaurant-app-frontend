import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where the Chef's Special banner sits in the menu page's tree.
 *
 * Reported as "the Shopping Basket section goes up and not aligned with featured product section".
 * That was a layout consequence, not a styling one: `.menuLayout` is a grid with
 * `align-items: start`, and the banner was rendered INSIDE `.menuMain`, the left column. So the
 * basket rail's top edge aligned with the *banner*, and the menu grid — the thing a guest actually
 * reads alongside their basket — started one banner-height lower.
 *
 * A source-structure assertion rather than a render test, deliberately. Rendering `MenuPage`
 * requires the full provider stack (auth, cart, order type, table, checkout, modules, i18n) plus a
 * featured special in the fixture; a test carrying all of that would be asserting its own mocks.
 * The defect is purely "which parent is this element under", and that is exactly what this reads.
 *
 * ⚠️ Known limit: this is text, not layout. It cannot catch someone reintroducing the misalignment
 * a different way — e.g. by giving `.menuLayout` a first row the rail also aligns to. It catches the
 * regression that actually happened.
 */
const SOURCE = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

/** The slice of JSX between two markers, so "before/after" questions are answerable. */
function indexOfOrThrow(needle: string): number {
  const at = SOURCE.indexOf(needle);
  if (at === -1) throw new Error(`marker not found in menu/page.tsx: ${needle}`);
  return at;
}

describe('Chef’s Special placement on the menu page', () => {
  it('renders the banner BEFORE the two-column layout opens', () => {
    expect(indexOfOrThrow('<FeaturedSpecialComponent')).toBeLessThan(indexOfOrThrow('className={styles.menuLayout}'));
  });

  it('does not render the banner inside the left column', () => {
    const layoutStart = indexOfOrThrow('className={styles.menuLayout}');
    expect(SOURCE.slice(layoutStart).includes('<FeaturedSpecialComponent')).toBe(false);
  });

  it('still renders the menu grid and the basket rail as the two columns', () => {
    // Guards the other direction: hoisting the banner must not have taken the grid or the rail with
    // it, which would "align" them by deleting one of them.
    const layoutStart = indexOfOrThrow('className={styles.menuLayout}');
    const layout = SOURCE.slice(layoutStart);
    expect(layout).toContain('styles.menuMain');
    expect(layout).toContain('styles.menuSidebarColumn');
    expect(layout).toContain('<MenuContent');
    expect(layout).toContain('<OrderFlowSidebar');
  });
});

describe('Chef’s Special banner markup', () => {
  const BANNER = readFileSync(join(__dirname, '../../components/menu/FeaturedSpecial.tsx'), 'utf8');

  // The hero was tall because of a 400px photo and thin because its copy was COMMENTED OUT rather
  // than deleted — description, price label and the whole ingredients block. That is the "takes too
  // much space" half of the report.
  it('carries no commented-out JSX', () => {
    expect(BANNER).not.toMatch(/\{\/\*\s*\{special\./);
    expect(BANNER).not.toMatch(/\{\/\*\s*<span className=\{styles\.priceLabel\}/);
  });

  it('renders the description it used to hide', () => {
    expect(BANNER).toContain('styles.featuredSpecialDescription');
  });

  // CLAUDE.md §5 rule 10.
  it('is a default-exported function, not a React.FC const', () => {
    expect(BANNER).toContain('export default function FeaturedSpecial');
    expect(BANNER).not.toContain('React.FC<FeaturedSpecialProps>');
  });
});
