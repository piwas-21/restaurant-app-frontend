import { mapCatalogOfferFamilyDto, toCatalogItemFromOfferFamily } from './offerFamily';

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
  it('keeps the anchor card and menu target as separate operational identities', () => {
    const family = mapCatalogOfferFamilyDto(dto);

    expect(family?.id).toBe('family-tacos');
    expect(family?.anchor.id).toBe('tacos');
    expect(family?.anchor.offerFamily).toBeUndefined();
    expect(family?.anchor.price).toBe(8);
    expect(family?.menuOffers[0]).toMatchObject({
      productId: 'menu-tacos',
      kind: 'bundle',
      name: 'menu-tacos',
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

  it('rejects malformed anchors while accepting name-free menu target rows', () => {
    expect(mapCatalogOfferFamilyDto({ id: 'missing-name', anchor: { productId: 'product' } })).toBeNull();
    expect(
      mapCatalogOfferFamilyDto({
        id: 'missing-target-name',
        anchor: { productId: 'product', name: 'Dish', price: 5 },
        menuOffers: [{ productId: 'menu', kind: 'bundle', price: 7 }],
      })?.menuOffers,
    ).toMatchObject([{ productId: 'menu', kind: 'bundle', name: 'menu' }]);
  });
});
