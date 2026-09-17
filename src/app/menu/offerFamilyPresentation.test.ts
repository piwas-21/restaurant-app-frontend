import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MENU_PAGE = readFileSync(join(__dirname, './page.tsx'), 'utf8');

describe('category-offers menu wiring', () => {
  it('keeps category metadata and the All selection when legacy item pipelines are disabled', () => {
    expect(MENU_PAGE).toContain('categories: publicCategories');
    expect(MENU_PAGE).toContain('const categoriesForNav = isOnePage ? onePage.categories : publicCategories;');
    expect(MENU_PAGE).toContain('const isCategoryOffers = displaySettings.bundlePresentationMode ===');
    expect(MENU_PAGE).toContain('usePublicMenu(!isOnePage && !isCategoryOffers)');
    expect(MENU_PAGE).toContain('selectedView,');
  });

  it('passes grouped families to both layout controllers and hides the technical bundle tab', () => {
    expect(MENU_PAGE).toContain('hideBundles={isCategoryOffers}');
    expect(MENU_PAGE).toContain('isOnePage={isOnePage}');
    expect(MENU_PAGE).toContain('offerFamilies={familyProps.offerFamilies}');
    expect(MENU_PAGE).toContain('offerFamiliesState={familyProps.offerFamiliesState}');
  });
});
