import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where the Chef's Special hero sits in the menu page's tree.
 *
 * It used to sit ABOVE the whole layout, and that was right at the time: `.menuLayout` was a
 * two-column grid with `align-items: start`, so a hero inside the left column aligned the basket
 * rail's top edge with the HERO and started the menu grid one hero-height lower.
 *
 * The rail is gone (it is a slide-over now), and with it that reason. The hero is the grid's FIRST
 * CELL, spanning two columns — where `stitch_classic_restaurant_design_system` puts it
 * (`lg:col-span-2`) — so the promoted dish sits among the dishes it promotes instead of pushing
 * every one of them a hero-height down the page.
 *
 * A source-structure assertion rather than a render test, deliberately. Rendering `MenuPage`
 * requires the full provider stack (auth, cart, order type, table, checkout, modules, i18n) plus a
 * featured special in the fixture; a test carrying all of that would be asserting its own mocks.
 * The question is purely "which parent is this element under", and that is exactly what this reads.
 *
 * ⚠️ Known limit: this is text, not layout. It cannot catch someone reintroducing a misalignment a
 * different way. It catches the regressions that actually happened.
 */
const SOURCE = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
const LIST = readFileSync(join(__dirname, '../../components/menu/MenuList.tsx'), 'utf8');
const CONTENT_CSS = readFileSync(join(__dirname, '../../components/menu/MenuContent.module.css'), 'utf8');

describe('Chef’s Special placement on the menu page', () => {
  it('hands the hero to the grid as a slot, not as a band above it', () => {
    // The page still resolves the template SURFACE — classic ships one hero, craft ships
    // `CraftFeaturedSpecial` — and passes the ELEMENT down. Resolving it inside `MenuList` would
    // bundle craft's module into classic's build (T4).
    expect(SOURCE).toContain("surfaceOr('FeaturedSpecial'");
    expect(SOURCE).toMatch(/featuredSlot=\{[\s\S]*?<FeaturedSpecialComponent/);
    // …and it is the ONLY place the hero is rendered: a second, page-level copy would put the
    // promoted dish on screen twice.
    expect(SOURCE.match(/<FeaturedSpecialComponent/g)).toHaveLength(1);
  });

  it('renders the hero inside the grid, as its first cell', () => {
    expect(LIST).toContain('featuredSlot');
    // Ahead of the dishes, in the same <ul>.
    expect(LIST.indexOf('{featuredSlot &&')).toBeLessThan(LIST.indexOf('{items.map('));
    expect(LIST).toContain('styles.featuredCell');
  });

  it('spans two columns, and cannot conjure a phantom one where there is only a single track', () => {
    const css = CONTENT_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/\.featuredCell\s*\{[^}]*grid-column:\s*span 2/);
    // `span 2` against a ONE-column grid does not clamp — it creates an implicit second column and
    // tears the layout in half. Both narrow bands must therefore opt out.
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.featuredCell\s*\{[^}]*grid-column:\s*1 \/ -1/);
    expect(css).toMatch(/@media \(max-width: 600px\)[\s\S]*?\.featuredCell\s*\{[^}]*grid-column:\s*auto/);
  });

  it('has no basket rail left on the page to align anything against', () => {
    // The defect this file was opened for was an alignment between the hero and the rail. Both
    // halves of that are gone: the rail is a slide-over opened from the sticky bar.
    expect(SOURCE).not.toContain('<OrderFlowSidebar');
    expect(SOURCE).not.toContain('menuSidebarColumn');
    expect(SOURCE).toContain('<CartSheet');
    // Opened by the FLOATING cart button, which is the page's only cart entry point — a second
    // copy in the sticky bar did the same job from the other corner and is gone.
    expect(SOURCE).toContain('<FloatingCartButton');
    expect(SOURCE).not.toContain('<MenuBasketButton');
  });
});

describe('Chef’s Special banner markup', () => {
  const BANNER = readFileSync(join(__dirname, '../../components/menu/FeaturedSpecial.tsx'), 'utf8');
  // The name + description + Details column was extracted for length (§4) on 2026-08-09. Read as
  // one string, because what these cases are about is the RENDERED hero, and splitting a component
  // in two must not be able to make an assertion about it pass by moving the code out of view.
  const COPY = readFileSync(join(__dirname, '../../components/menu/FeaturedSpecialCopy.tsx'), 'utf8');
  const HERO = `${BANNER}\n${COPY}`;

  // The hero was tall because of a 400px photo and thin because its copy was COMMENTED OUT rather
  // than deleted — description, price label and the whole ingredients block.
  it('carries no commented-out JSX', () => {
    expect(HERO).not.toMatch(/\{\/\*\s*\{special\./);
    expect(HERO).not.toMatch(/\{\/\*\s*<span className=\{styles\.priceLabel\}/);
  });

  it('renders the description it used to hide', () => {
    expect(HERO).toContain('styles.featuredSpecialDescription');
  });

  it('shares the ONE add button rather than keeping a hand-synchronised copy', () => {
    // Three sets of rules used to draw this control — the grid card's, this hero's, and a third for
    // the mobile disc — kept in step by comments in each file pointing at the other two. They had
    // already drifted on `min-height` by the time they were merged.
    expect(BANNER).toContain('<AddToOrderButton');
    expect(BANNER).toContain('variant="solid"');
    expect(BANNER).not.toContain('styles.featuredSpecialAddButton');
  });

  // CLAUDE.md §5 rule 10.
  it('is a default-exported function, not a React.FC const', () => {
    expect(BANNER).toContain('export default function FeaturedSpecial');
    expect(BANNER).not.toContain('React.FC<FeaturedSpecialProps>');
  });
});
