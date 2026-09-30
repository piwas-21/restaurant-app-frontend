// Independent public HTTP fixtures: ProductSummary has category names, never category IDs.
import { createServer } from 'node:http';

export const CANONICAL_ORIGIN = 'https://discovery.fixture.test';
export const CATEGORY_ID = '00000000-0000-4000-8000-000000000001';
const translated = (fr, en) => ({
  fr: { name: fr, description: `Description ${fr}` },
  en: { name: en, description: `Description ${en}` },
});
const products = Array.from({ length: 206 }, (_, index) => ({
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name: `Plat français ${index + 1}`,
  description: `Description Plat français ${index + 1}`,
  content: translated(`Plat français ${index + 1}`, `English dish ${index + 1}`),
  sourceLocale: 'fr',
  basePrice: 12,
  isActive: true,
  isAvailable: index !== 205,
  isComponent: false,
  isSpecial: false,
  type: 'mainItem',
  categoryNames: ['Plats de la maison'],
  primaryCategoryName: 'Plats de la maison',
  variations: [],
  images: [],
  allergens: [],
}));
const categories = [
  {
    id: CATEGORY_ID,
    name: 'Plats de la maison',
    description: 'Cuisine de saison',
    sourceLocale: 'fr',
    translations: {
      fr: { name: 'Plats de la maison', description: 'Cuisine de saison' },
      en: { name: 'House dishes', description: 'Seasonal cooking' },
    },
    isActive: true,
  },
];
const bundles = Array.from({ length: 205 }, (_, index) => ({
  id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name: `Formule française ${index + 1}`,
  description: `Description Formule française ${index + 1}`,
  content: translated(`Formule française ${index + 1}`, `English meal ${index + 1}`),
  sourceLocale: 'fr',
  basePrice: 18,
  isActive: true,
  isAvailable: true,
  type: 'menu',
  images: [],
  categoryIds: [CATEGORY_ID],
  primaryCategoryId: CATEGORY_ID,
  menuDefinition: { sections: [] },
}));
const info = {
  id: CATEGORY_ID,
  name: 'Fixture Restaurant',
  addressLine1: '1 rue du Test',
  addressLine2: '',
  city: 'Genève',
  postalCode: '1200',
  country: 'CH',
  email: '',
  website: '',
  latitude: 46.2,
  longitude: 6.1,
  themePaletteKey: 'classic',
  logoUrl: null,
  logoDarkUrl: null,
  interiorImageUrl: null,
  phoneNumbers: [],
  currency: 'CHF',
  menuLayout: 'tabs',
  showMenuBundlesOnAllTab: false,
  bundlePresentationMode: 'legacySeparate',
};

function collection(rows, url, pageKey, sizeKey, scenario) {
  const page = Number(url.searchParams.get(pageKey) ?? 1);
  const pageSize = Number(url.searchParams.get(sizeKey) ?? 100);
  const start = scenario === 'repeated' && page > 1 ? 0 : (page - 1) * pageSize;
  const items = rows.slice(start, start + pageSize);
  if (scenario === 'unknown') return { items };
  return { items, page, pageSize, totalCount: rows.length, totalPages: Math.ceil(rows.length / pageSize) };
}

function restaurantInfo(scenario, state) {
  let menuLayout = 'tabs';
  if (['onepage', 'categories-fail', 'offers-onepage'].includes(scenario)) menuLayout = 'onepage';
  else if (scenario === 'complete') menuLayout = state.completeLayout;
  let bundlePresentationMode = 'legacySeparate';
  if (['offers', 'offers-onepage'].includes(scenario)) bundlePresentationMode = 'categoryOffers';
  else if (scenario === 'complete') bundlePresentationMode = state.completePresentation;
  return { ...info, menuLayout, bundlePresentationMode };
}
const fixtureError = (status, message) => ({ fixtureError: true, status, message });
function landing(scenario, state) {
  if (scenario === 'complete' && state.landingFailure) return fixtureError(503, 'Temporary landing outage');
  const authored = {
    en: {
      heroEyebrow: null,
      welcomeTitle: 'Authored English welcome',
      welcomeBody: null,
      storyTitle: null,
      storyBody: null,
    },
  };
  return { backgroundMode: 'default', backgroundImageUrl: null, content: scenario === 'override' ? authored : {} };
}
function productRows(scenario) {
  if (scenario !== 'missing') return products;
  return products.map((row, index) => (index === 204 ? { ...row, content: { fr: row.content.fr } } : row));
}
function catalog(url) {
  const rows = [
    ...products.slice(0, 205),
    {
      ...products[0],
      id: '10000000-0000-4000-8000-000000000207',
      name: 'Hors catégorie',
      content: translated('Hors catégorie', 'Uncategorized offer'),
    },
  ].map((row, index) => ({
    id: row.id,
    anchor: { ...row, productId: row.id, kind: 'product', price: row.basePrice },
    categoryIds: index < 205 ? [CATEGORY_ID] : [],
    menuOffers: [],
    startingPrice: row.basePrice,
    visibleInAll: true,
    anchorScheduleAvailable: true,
  }));
  const categoryId = url.searchParams.get('categoryId');
  const selected = categoryId ? rows.filter((row) => row.categoryIds.includes(categoryId)) : rows;
  return collection(selected, url, 'page', 'pageSize', 'complete');
}
const endpoints = {
  '/api/restaurant-info': ({ scenario, state }) => restaurantInfo(scenario, state),
  '/api/restaurant-info/landing': ({ scenario, state }) => landing(scenario, state),
  '/api/WorkingHours': () => [
    {
      id: CATEGORY_ID,
      dayOfWeek: 'Monday',
      openTime: '23:47:00',
      closeTime: '23:59:00',
      isActive: false,
      isClosed: false,
    },
  ],
  '/api/tenant/modules': () => ({ modules: [], enforced: false }),
  '/api/Categories': ({ scenario, url }) =>
    scenario === 'categories-fail'
      ? fixtureError(503, 'Temporary category outage')
      : collection(categories, url, 'PageNumber', 'PageSize', 'complete'),
  '/api/Products': ({ scenario, url }) => collection(productRows(scenario), url, 'Page', 'PageSize', scenario),
  '/api/Menus': ({ scenario, url }) =>
    collection(['bundles', 'onepage'].includes(scenario) ? bundles : [], url, 'page', 'pageSize', 'complete'),
  '/api/Catalog': ({ url }) => catalog(url),
};
function fixtureData(path, context) {
  const endpoint = endpoints[path];
  if (endpoint) return endpoint(context);
  if (path.startsWith('/api/Tables/validate-qr/'))
    return { isValid: true, tableId: CATEGORY_ID, tableNumber: '7', maxGuests: 4, isOutdoor: false };
  return fixtureError(404, 'Fixture endpoint absent');
}

export async function startFixtureApi() {
  const calls = [];
  const state = { completeLayout: 'tabs', completePresentation: 'legacySeparate', landingFailure: false };
  const server = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Language, Accept-Language, X-Session-Id',
    );
    if (request.method === 'OPTIONS') {
      response.writeHead(204).end();
      return;
    }
    const url = new URL(request.url, 'http://fixture.test');
    const [scenario, ...segments] = url.pathname.slice(1).split('/');
    const path = `/${segments.join('/')}`;
    calls.push({ scenario, path, query: url.search });
    const data = fixtureData(path, { scenario, url, state });
    const body = data.fixtureError ? { success: false, message: data.message } : { success: true, data };
    response
      .writeHead(data.fixtureError ? data.status : 200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    calls,
    setLandingFailure: (failed) => {
      state.landingFailure = failed;
    },
    setCompletePresentation: (presentation) => {
      state.completePresentation = presentation;
    },
    setCompleteLayout: (layout) => {
      state.completeLayout = layout;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
