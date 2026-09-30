import { auditMenuLocaleCoverage } from './publicMenuCoverage';
import type { ApiCategory } from '@/types/menu';
import type { MenuBundleDto, ProductDto } from '@/hooks/publicMenu/types';
import type { CatalogOfferFamily } from '@/types/menu/offerFamily';

const category = (overrides: Partial<ApiCategory> = {}): ApiCategory => ({
  id: 'category-1',
  name: 'Soup',
  sourceLocale: 'fr',
  translations: { en: { name: 'Soup' } },
  ...overrides,
});

const product = (overrides: Partial<ProductDto> = {}): ProductDto => ({
  id: 'product-1',
  name: 'Soupe du jour',
  description: 'Soupe maison',
  content: {
    fr: { name: 'Soupe du jour', description: 'Soupe maison' },
    en: { name: 'Soup of the day', description: 'Homemade soup' },
  },
  ...overrides,
});

const bundle = (overrides: Partial<MenuBundleDto> = {}): MenuBundleDto => ({
  id: 'bundle-1',
  name: 'Menu midi',
  description: 'Entrée et plat',
  content: {
    fr: { name: 'Menu midi', description: 'Entrée et plat' },
    en: { name: 'Lunch menu', description: 'Starter and main' },
  },
  ...overrides,
});

const offerFamily = (overrides: Partial<CatalogOfferFamily> = {}): CatalogOfferFamily => ({
  id: 'family-1',
  anchor: {
    kind: 'product',
    id: 'product-1',
    name: 'Saucisse maison',
    description: 'Saucisse locale',
    sourceLocale: 'fr',
    content: { en: { name: 'House sausage' } },
    price: 12,
    isBundle: false,
  },
  menuOffers: [],
  categoryIds: ['category-1'],
  startingPrice: 12,
  ...overrides,
});

describe('auditMenuLocaleCoverage', () => {
  it('covers only locales with required active category, product, and bundle text', () => {
    const report = auditMenuLocaleCoverage(
      { categories: [category()], products: [product()], bundles: [bundle()] },
      { candidates: ['fr', 'en'], defaultLocale: 'fr' },
    );

    expect(report.locales).toEqual(['fr', 'en']);
    expect(report.byLocale).toEqual([
      expect.objectContaining({ locale: 'fr', complete: true, itemCount: 2 }),
      expect.objectContaining({ locale: 'en', complete: true, itemCount: 2 }),
    ]);
  });

  it('does not let the configured default override an explicit sourceLocale', () => {
    const report = auditMenuLocaleCoverage(
      { categories: [category({ sourceLocale: 'en' })], products: [product()], bundles: [] },
      { candidates: ['fr', 'en'], defaultLocale: 'fr' },
    );

    expect(report.locales).toEqual(['en']);
    expect(report.byLocale[0]).toMatchObject({ complete: false, missingCategories: 1 });
  });

  it('uses default-locale source text when the API has no explicit source locale', () => {
    const report = auditMenuLocaleCoverage(
      {
        categories: [category({ sourceLocale: null, translations: undefined })],
        products: [product({ content: undefined })],
        bundles: [],
      },
      { candidates: ['fr', 'en'], defaultLocale: 'fr' },
    );

    expect(report.locales).toEqual(['fr']);
  });

  it('requires a translated body only when the source entity has a body', () => {
    const report = auditMenuLocaleCoverage(
      {
        categories: [category()],
        products: [product({ description: null, content: { en: { name: 'Soup of the day' } } })],
        bundles: [],
      },
      { candidates: ['en'], defaultLocale: 'fr' },
    );

    expect(report.locales).toEqual(['en']);
  });

  it('excludes inactive, unavailable, and internal component records from coverage', () => {
    const report = auditMenuLocaleCoverage(
      {
        categories: [category()],
        products: [
          product(),
          product({ id: 'inactive', isActive: false }),
          product({ id: 'component', isComponent: true }),
        ],
        bundles: [bundle({ id: 'unavailable', isAvailable: false })],
      },
      { candidates: ['en'], defaultLocale: 'fr' },
    );

    expect(report.byLocale[0]).toMatchObject({ complete: true, itemCount: 1 });
  });

  it('audits the text rendered by category-offer families, including offering-only catalogues', () => {
    const report = auditMenuLocaleCoverage(
      {
        categories: [category()],
        products: [],
        bundles: [],
        offerFamilies: [offerFamily()],
      },
      { candidates: ['fr', 'en'], defaultLocale: 'fr', sourceDataKnown: true },
    );

    expect(report.locales).toEqual(['fr']);
    expect(report.byLocale).toEqual([
      expect.objectContaining({ locale: 'fr', complete: true, itemCount: 1 }),
      expect.objectContaining({ locale: 'en', complete: false, missingOfferText: 1 }),
    ]);
  });

  it('fails closed when any API collection is unavailable or the catalogue is empty', () => {
    expect(
      auditMenuLocaleCoverage(
        { categories: null, products: [product()], bundles: [] },
        { candidates: ['fr'], defaultLocale: 'fr' },
      ),
    ).toMatchObject({ known: false, locales: [] });
    expect(
      auditMenuLocaleCoverage(
        { categories: [], products: [], bundles: [] },
        { candidates: ['fr'], defaultLocale: 'fr' },
      ).locales,
    ).toEqual([]);
  });
});
