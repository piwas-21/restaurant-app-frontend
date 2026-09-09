import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The two menu-display layouts (mcdoner partner request) and the boundary between them.
 *
 * The page grew a branch: the tenant's `menuLayout` setting picks between today's tabs
 * tree and the one-page body. Two facts must hold, and both are source-structure facts
 * (jsdom computes neither sticky positioning nor provider stacks — the same reasoning
 * `featuredSpecialPlacement.test.ts` documents):
 *
 *  1. **Tabs is the default and its tree is untouched.** The branch is written
 *     `isOnePage ? <MenuOnePage/> : <today's tree>`; when the setting is absent, unset,
 *     or `tabs` — which is every pre-setting backend and every tenant that never opened
 *     the new control — the page renders the exact tree it rendered before this feature.
 *     The behavioural half of this guarantee is `menuContentBundleGrouping.test.tsx`,
 *     whose pre-existing cases run with the new prop absent.
 *  2. **The one-page branch is fully gated**: it renders only behind
 *     `displaySettings.menuLayout === 'onepage'`, and the tabs data pipeline is stood
 *     down (`usePublicMenu(!isOnePage)`) so the layouts never double-fetch.
 */

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const SOURCE = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
const PAGE_SRC = withoutComments(SOURCE);
const ONE_PAGE = withoutComments(readFileSync(join(__dirname, '../../components/menu/MenuOnePage.tsx'), 'utf8'));
const SETTINGS_HOOK = withoutComments(readFileSync(join(__dirname, '../../hooks/useMenuDisplaySettings.ts'), 'utf8'));

describe('the menu-display layout branch', () => {
  it('reads the tenant settings and gates the one-page body on the onepage value only', () => {
    expect(SOURCE).toContain('useMenuDisplaySettings()');
    expect(SOURCE).toContain("displaySettings.menuLayout === 'onepage'");
    // Anything else — absent field, `tabs`, a read still in flight — is tabs.
    expect(SETTINGS_HOOK).toContain("? 'onepage' : 'tabs'");
  });

  it('is written `isOnePage ? one-page : tabs-tree`, so tabs remains the default branch', () => {
    const gate = PAGE_SRC.indexOf('isOnePage ? (');
    const onePageBody = PAGE_SRC.indexOf('<MenuOnePage');
    const tabsBody = PAGE_SRC.indexOf('<div className={styles.menuLayout}>');
    expect(gate).toBeGreaterThan(-1);
    expect(onePageBody).toBeGreaterThan(gate);
    expect(tabsBody).toBeGreaterThan(onePageBody);
  });

  it('stands the tabs pipeline down only while the one-page layout owns the page', () => {
    // `enabled` is `!isOnePage`: tabs (the default) passes `true` — behaviourally identical
    // to the pre-feature call with no argument.
    expect(PAGE_SRC).toContain('usePublicMenu(!isOnePage)');
    expect(PAGE_SRC).toContain('useOnePageMenu(isOnePage)');
  });

  it("keeps the tabs tree's shape the page's other gates already pin", () => {
    // Byte-identical rendering rests on the same tree the sticky-offset and hero tests
    // assert; both must still find their markers after the branch.
    expect(PAGE_SRC).toContain('<CategoryNav');
    expect(PAGE_SRC).toContain('className={styles.menuLayout}');
    expect(PAGE_SRC).toContain('<MenuContent');
    // The setting reaches the tabs body as the additive prop (default false = today).
    expect(PAGE_SRC).toContain('showBundlesOnAllView={displaySettings.showBundlesOnAllTab}');
    // The one-page body takes the same shared wiring: the page's sheet, its follow-up and
    // the one featured-special slot.
    expect(PAGE_SRC.slice(PAGE_SRC.indexOf('<MenuOnePage'))).toContain('controller={onePage}');
  });

  it('the one-page body renders real sections from the controller, not placeholders', () => {
    expect(ONE_PAGE).toContain('sections.map(');
    expect(ONE_PAGE).toContain('onePageSectionId(category.id)');
    expect(ONE_PAGE).toContain("t('menu_bundles')");
  });
});
