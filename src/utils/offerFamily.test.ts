import { effectiveOrderablePriceChoices, mapCatalogOfferFamilyDto, toCatalogItemFromOfferFamily } from './offerFamily';

const dto = {
  id: 'family-tacos',
  anchor: {
    productId: 'tacos',
    kind: 'product' as const,
    name: 'Tacos 1 Viande',
    basePrice: '8.00',
    categoryIds: ['ignored-on-anchor'],
    variations: [{ id: 'single', name: '1 viande', priceModifier: '1.00', isActive: true }],
  },
  menuOffers: [
    {
      productId: 'menu-tacos',
      kind: 'bundle' as const,
      price: 12,
      parentVariationId: null,
      scheduleAvailable: false,
      availability: { canOrder: true, reason: 'Available' as const, allowedOrderTypes: [] },
    },
  ],
  categoryIds: ['tacos-category'],
  startingPrice: '8',
};

describe('offer-family mapper', () => {
  it('maps the backend ProductSummaryDto JSON shape without dropping type, base price, or gallery', () => {
    const backendJson = {
      id: 'sandwich',
      name: 'Sandwich Kebab',
      description: 'Freshly grilled.',
      basePrice: 9.5,
      imageUrl: null,
      isActive: true,
      isAvailable: true,
      isSpecial: false,
      hideBaseProduct: false,
      isComponent: false,
      type: 'mainItem',
      ingredients: ['beef'],
      detailedIngredients: [],
      allergens: ['gluten'],
      categoryNames: ['Mains'],
      images: [
        { id: 'image-secondary', url: '/secondary.jpg', altText: null, isPrimary: false, sortOrder: 2 },
        {
          id: 'image-primary',
          url: '/primary.jpg',
          cardUrl: '/primary-card.webp',
          altText: 'Kebab sandwich',
          isPrimary: true,
          sortOrder: 1,
        },
      ],
      content: { en: { name: 'Sandwich Kebab', description: 'Freshly grilled.' } },
      primaryCategoryName: 'Mains',
      variationCount: 1,
      variations: [{ id: 'regular', name: 'Regular', priceModifier: 0, isActive: true, displayOrder: 1 }],
      suggestedSideItems: [],
      availability: { canOrder: true, reason: 'Available', allowedOrderTypes: ['Takeaway'] },
    };

    const family = mapCatalogOfferFamilyDto({
      id: 'family-sandwich',
      anchor: backendJson,
      menuOffers: [
        {
          productId: 'menu-sandwich',
          parentVariationId: 'regular',
          price: 12.5,
          availability: { canOrder: true, reason: 'Available', allowedOrderTypes: ['Takeaway'] },
          scheduleAvailable: true,
          allergens: ['gluten'],
        },
      ],
      categoryIds: ['cat-mains'],
      startingPrice: 9.5,
    });

    expect(family?.anchor).toMatchObject({
      kind: 'product',
      price: 9.5,
      imageUrl: '/primary-card.webp',
      imageCount: 2,
      isActive: true,
    });
    expect(family?.anchor.images).toEqual([
      { url: '/primary.jpg', cardUrl: '/primary-card.webp', alt: 'Kebab sandwich' },
      { url: '/secondary.jpg', alt: 'Sandwich Kebab' },
    ]);
    expect(family?.menuOffers[0]).toMatchObject({
      productId: 'menu-sandwich',
      offerMode: 'meal',
      name: '',
      parentVariationId: 'regular',
    });
  });

  it('recognises a ProductSummaryDto menu type as a bundle anchor', () => {
    const family = mapCatalogOfferFamilyDto({
      id: 'standalone-menu',
      anchor: { id: 'standalone-menu', name: 'Family Menu', type: 'menu', basePrice: 15 },
    });
    expect(family?.anchor).toMatchObject({ kind: 'bundle', isBundle: true });
  });

  it('keeps the anchor card and menu target as separate operational identities', () => {
    const family = mapCatalogOfferFamilyDto(dto);

    expect(family?.id).toBe('family-tacos');
    expect(family?.anchor.id).toBe('tacos');
    expect(family?.anchor.offerFamily).toBeUndefined();
    expect(family?.anchor.price).toBe(8);
    expect(family?.menuOffers[0]).toMatchObject({
      productId: 'menu-tacos',
      kind: 'bundle',
      name: '',
      price: 12,
      scheduleAvailable: false,
    });
    expect(family?.variationOptions).toEqual([{ id: 'single', name: '1 viande', price: 9 }]);
  });

  it('attaches the family only to the card view-model', () => {
    const family = mapCatalogOfferFamilyDto(dto);
    expect(family).not.toBeNull();
    const card = toCatalogItemFromOfferFamily(family!);

    expect(card.id).toBe('family-tacos');
    expect(card.price).toBe(8);
    expect(card.priceIsFrom).toBe(true);
    expect(card.offerFamily?.menuOffers[0].productId).toBe('menu-tacos');
  });

  it('keeps a family card actionable when only its linked menu is available', () => {
    const family = mapCatalogOfferFamilyDto({
      id: 'family-fallback',
      anchor: {
        id: 'dish',
        name: 'Dish',
        type: 'mainItem',
        basePrice: 8,
        isAvailable: false,
        availability: { canOrder: false, reason: 'Unavailable', allowedOrderTypes: ['Takeaway'] },
      },
      menuOffers: [
        {
          productId: 'menu-dish',
          price: 11,
          availability: { canOrder: true, reason: 'Available', allowedOrderTypes: ['Takeaway'] },
          scheduleAvailable: true,
        },
      ],
    });

    const card = toCatalogItemFromOfferFamily(family!);
    expect(card.isAvailable).toBe(true);
    expect(card.availability?.canOrder).toBe(true);
  });

  it('preserves the backend All-view visibility verdict without changing category placement data', () => {
    const family = mapCatalogOfferFamilyDto({ ...dto, visibleInAll: false });

    expect(family?.visibleInAll).toBe(false);
    expect(family?.categoryIds).toEqual(['tacos-category']);
  });

  it('blocks a standalone bundle anchor when its schedule verdict is false', () => {
    const family = mapCatalogOfferFamilyDto({
      id: 'family-standalone-menu',
      anchor: { id: 'standalone-menu', name: 'Lunch Menu', type: 'menu', basePrice: 14, isAvailable: true },
      anchorScheduleAvailable: false,
    });

    const card = toCatalogItemFromOfferFamily(family!);
    expect(card.isAvailable).toBe(false);
    expect(card.availability).toMatchObject({ canOrder: false, reason: 'Unavailable' });
  });

  it('rejects malformed anchors while accepting name-free menu target rows', () => {
    expect(mapCatalogOfferFamilyDto({ id: 'missing-name', anchor: { productId: 'product' } })).toBeNull();
    expect(
      mapCatalogOfferFamilyDto({
        id: 'missing-target-name',
        anchor: { productId: 'product', name: 'Dish', price: 5 },
        menuOffers: [{ productId: 'menu', kind: 'bundle', price: 7 }],
      })?.menuOffers,
    ).toMatchObject([{ productId: 'menu', kind: 'bundle', name: '' }]);
  });

  it('marks the card as from when the base and one active variation are both orderable', () => {
    const family = mapCatalogOfferFamilyDto({
      id: 'family-base-and-one-variation',
      anchor: {
        id: 'dish',
        name: 'Dish',
        basePrice: 8,
        isActive: true,
        isAvailable: true,
        variations: [{ id: 'large', name: 'Large', priceModifier: 2, isActive: true }],
      },
      startingPrice: 8,
    });

    expect(family).not.toBeNull();
    expect(effectiveOrderablePriceChoices(family!)).toEqual([8, 10]);
    expect(toCatalogItemFromOfferFamily(family!).priceIsFrom).toBe(true);
  });

  it('does not let inactive variations or unavailable menu targets create a from label', () => {
    const family = mapCatalogOfferFamilyDto({
      id: 'family-one-effective-choice',
      anchor: {
        id: 'dish',
        name: 'Dish',
        basePrice: 8,
        isActive: true,
        isAvailable: true,
        variations: [{ id: 'inactive', name: 'Inactive', priceModifier: 1, isActive: false }],
      },
      menuOffers: [
        {
          productId: 'menu',
          price: 12,
          scheduleAvailable: false,
          availability: { canOrder: false, allowedOrderTypes: ['Takeaway'] },
        },
      ],
      startingPrice: 8,
    });

    expect(family).not.toBeNull();
    expect(effectiveOrderablePriceChoices(family!)).toEqual([8]);
    expect(toCatalogItemFromOfferFamily(family!).priceIsFrom).toBe(false);
  });

  it('treats a hidden base plus one active variation as one effective price, not from', () => {
    const family = mapCatalogOfferFamilyDto({
      id: 'family-hidden-base-one-variation',
      anchor: {
        id: 'dish',
        name: 'Dish',
        basePrice: 8,
        hideBaseProduct: true,
        isActive: true,
        isAvailable: true,
        variations: [{ id: 'large', name: 'Large', priceModifier: 2, isActive: true }],
      },
      startingPrice: 10,
    });

    expect(family).not.toBeNull();
    expect(effectiveOrderablePriceChoices(family!)).toEqual([10]);
    expect(toCatalogItemFromOfferFamily(family!).priceIsFrom).toBe(false);
  });
});
