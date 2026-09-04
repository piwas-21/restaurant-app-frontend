import {
  toCatalogItemFromProduct,
  toCatalogItemFromBundle,
  toBundleItemFromDetail,
  toCatalogItemFromFeaturedSpecial,
} from './catalogItem';
import { FALLBACK_IMAGE } from './imageHelpers';
import type {
  DetailedProduct,
  MenuItem,
  MenuBundleItem,
  MenuDefinition,
  MenuSection,
  FeaturedSpecial,
} from '@/types/menu';
import { OrderType } from '@/types/order';

const content = (name: string, description = '') => ({ en: { name, description, ingredient: '' } });

const emptyAvailability = {
  isAlwaysAvailable: true,
  availableMonday: true,
  availableTuesday: true,
  availableWednesday: true,
  availableThursday: true,
  availableFriday: true,
  availableSaturday: true,
  availableSunday: true,
};

const menuDefinition = (sections: MenuSection[]): MenuDefinition => ({ id: 'md1', ...emptyAvailability, sections });

describe('toCatalogItemFromProduct', () => {
  const base: MenuItem = {
    id: 'p1',
    name: 'Margherita',
    description: 'Classic',
    content: content('Margherita', 'Classic'),
    price: 12.5,
    image: 'pizza.jpg',
    dietaryTags: [],
    allergens: ['gluten'],
    isSpecial: true,
    isAvailable: true,
  };

  it('maps a product to a non-bundle CatalogItem', () => {
    expect(toCatalogItemFromProduct(base)).toEqual({
      kind: 'product',
      id: 'p1',
      name: 'Margherita',
      description: 'Classic',
      content: base.content,
      imageUrl: 'pizza.jpg',
      imageCount: undefined,
      price: 12.5,
      priceIsFrom: false,
      isBundle: false,
      priceEditability: 'editable',
      allergens: ['gluten'],
      isSpecial: true,
      isAvailable: true,
      detailedIngredients: undefined,
      ingredients: undefined,
      dietaryTags: [],
    });
  });

  // Track F / F2 — with the base row hidden, `basePrice` is a price nobody can buy.
  describe('a product whose base row is hidden', () => {
    const dessert: MenuItem = {
      ...base,
      price: 6,
      hideBaseProduct: true,
      variations: [
        { name: 'Revani', isActive: true, priceModifier: 2, displayOrder: 1 },
        { name: 'Sütlaç', isActive: true, priceModifier: 0.5, displayOrder: 2 },
      ],
    };

    it('prices the card from the cheapest active variation and says so', () => {
      const item = toCatalogItemFromProduct(dessert);

      expect(item.price).toBe(6.5);
      expect(item.priceIsFrom).toBe(true);
    });

    it('goes back to the plain base price when every variation is inactive', () => {
      // The degrade: with nothing active the base row is offered again, so the base price is once
      // more the price of the thing on sale — and a "from" prefix would then be a lie.
      const item = toCatalogItemFromProduct({
        ...dessert,
        variations: dessert.variations?.map((v) => ({ ...v, isActive: false })),
      });

      expect(item.price).toBe(6);
      expect(item.priceIsFrom).toBe(false);
    });

    it('leaves a product that did not ask for it untouched', () => {
      const item = toCatalogItemFromProduct({ ...dessert, hideBaseProduct: false });

      expect(item.price).toBe(6);
      expect(item.priceIsFrom).toBe(false);
    });
  });

  it('marks a variation-priced product as NOT inline-price-editable (its card price is a "from" value)', () => {
    const withVariations: MenuItem = {
      ...base,
      variations: [{ name: 'Large', isActive: true, priceModifier: 3, displayOrder: 1 }],
    };

    expect(toCatalogItemFromProduct(withVariations).priceEditability).toBe('variations');
  });

  // A combo used to leave the field UNSET, which reads as `undefined` — also `!== 'editable'`, but
  // with no reason attached, so the card rendered nothing at all. That was half of the reported
  // "some menu items have no edit-price button".
  it('marks a combo as locked-because-bundle rather than leaving it unset', () => {
    const bundle = toCatalogItemFromBundle({
      id: 'b1',
      name: 'Lunch deal',
      basePrice: 19,
      images: [],
    } as never);

    expect(bundle.priceEditability).toBe('bundle');
  });

  it('carries the card summary fields a product renders', () => {
    const result = toCatalogItemFromProduct({
      ...base,
      images: [
        { url: 'a.jpg', alt: '' },
        { url: 'b.jpg', alt: '' },
      ],
      ingredients: ['tomato', 'basil'],
      dietaryTags: ['vegetarian'],
      detailedIngredients: [{ id: 'i1', name: 'Tomato', isOptional: false, price: 0, isActive: true, displayOrder: 1 }],
    });

    expect(result.imageCount).toBe(2);
    expect(result.ingredients).toEqual(['tomato', 'basil']);
    expect(result.dietaryTags).toEqual(['vegetarian']);
    expect(result.detailedIngredients).toHaveLength(1);
  });

  it('falls back to the first image when there is no flat image', () => {
    const result = toCatalogItemFromProduct({ ...base, image: '', images: [{ url: 'first.jpg', alt: '' }] });
    expect(result.imageUrl).toBe('first.jpg');
  });

  it('falls back to the placeholder when the item has no image at all', () => {
    expect(toCatalogItemFromProduct({ ...base, image: '', images: [] }).imageUrl).toBe(FALLBACK_IMAGE);
  });
});

describe('toCatalogItemFromBundle', () => {
  const bundle: MenuBundleItem = {
    id: 'b1',
    name: 'Lunch Combo',
    description: 'Pick a main + drink',
    content: { en: { name: 'Lunch Combo', description: 'Pick a main + drink' } },
    basePrice: 15,
    images: [{ url: 'combo.jpg', alt: '' }],
    isActive: true,
    isAvailable: true,
    isSpecial: false,
    displayOrder: 1,
    menuDefinition: menuDefinition([
      {
        id: 's1',
        name: 'Main',
        displayOrder: 1,
        isRequired: true,
        minSelection: 1,
        maxSelection: 1,
        items: [
          { id: 'i1', productId: 'pizza', productName: 'Pizza', additionalPrice: 2, displayOrder: 1, isDefault: true },
          { id: 'i2', productId: 'salad', productName: 'Salad', additionalPrice: 0, displayOrder: 2, isDefault: false },
        ],
      },
      {
        id: 's2',
        name: 'Drink',
        displayOrder: 2,
        isRequired: true,
        minSelection: 1,
        maxSelection: 1,
        items: [
          { id: 'i3', productId: 'cola', productName: 'Cola', additionalPrice: 0, displayOrder: 1, isDefault: true },
        ],
      },
    ]),
  };

  it('maps a bundle to a bundle CatalogItem with the basePrice as the "from" price', () => {
    const result = toCatalogItemFromBundle(bundle);
    expect(result.kind).toBe('bundle');
    expect(result.isBundle).toBe(true);
    expect(result.price).toBe(15);
    expect(result.imageUrl).toBe('combo.jpg');
  });

  it('previews only the default option names', () => {
    expect(toCatalogItemFromBundle(bundle).bundleItemNames).toEqual(['Pizza', 'Cola']);
  });

  it('omits the preview list when no defaults have names', () => {
    const noNames: MenuBundleItem = {
      ...bundle,
      menuDefinition: menuDefinition([
        {
          ...bundle.menuDefinition.sections[0],
          items: [{ id: 'i1', productId: 'pizza', additionalPrice: 2, displayOrder: 1, isDefault: true }],
        },
      ]),
    };
    expect(toCatalogItemFromBundle(noNames).bundleItemNames).toBeUndefined();
  });

  it('falls back to the placeholder when the bundle has no images', () => {
    expect(toCatalogItemFromBundle({ ...bundle, images: [] }).imageUrl).toBe(FALLBACK_IMAGE);
  });

  // §9.2. This one line is what makes both card surfaces dim a blocked combo: MenuCard and
  // CraftMenuCard read `CatalogItem.availability`, so dropping it here silently returns bundles to
  // rendering as fully orderable — with every other assertion in this file still green.
  it('carries the bundle verdict onto the card view-model', () => {
    const blocked: MenuBundleItem = {
      ...bundle,
      availability: { canOrder: false, reason: 'WrongOrderType', allowedOrderTypes: [OrderType.Takeaway] },
    };

    expect(toCatalogItemFromBundle(blocked).availability).toEqual(blocked.availability);
  });

  it('leaves it undefined when the bundle carries none — unrestricted, not blocked', () => {
    expect(toCatalogItemFromBundle(bundle).availability).toBeUndefined();
  });
});

describe('toBundleItemFromDetail', () => {
  const detail: DetailedProduct = {
    id: 'b1',
    name: 'Lunch Combo',
    description: 'Pick a main',
    basePrice: 15,
    isActive: true,
    isAvailable: true,
    isSpecial: true,
    preparationTimeMinutes: 10,
    type: 'menu',
    ingredients: [],
    allergens: [],
    displayOrder: 3,
    content: { en: { name: 'Lunch Combo', description: 'Pick a main' } },
    images: [{ url: 'combo.jpg', alt: '' }],
    categories: [],
    variations: [],
    suggestedSideItems: [],
    menuDefinition: menuDefinition([]),
  };

  it('re-reads a menu-type product detail as a bundle the bundle sheet can drive', () => {
    const result = toBundleItemFromDetail(detail);

    expect(result).toEqual({
      id: 'b1',
      name: 'Lunch Combo',
      description: 'Pick a main',
      basePrice: 15,
      content: { en: { name: 'Lunch Combo', description: 'Pick a main' } },
      menuDefinition: detail.menuDefinition,
      images: [{ url: 'combo.jpg', alt: '' }],
      isActive: true,
      isAvailable: true,
      isSpecial: true,
      preparationTimeMinutes: 10,
      displayOrder: 3,
      // Added by #702: this producer omitted the bundle's own allergens, so the by-id path served
      // a labelled combo unlabelled. The fixture's `allergens` is `[]`, so the exhaustive shape
      // below is what pins the field's PRESENCE — `bundleAllergenChain.test.ts` pins its value.
      allergens: [],
    });
  });

  it('normalises a locale with no description rather than widening the bundle contract', () => {
    const result = toBundleItemFromDetail({ ...detail, content: { de: { name: 'Mittagsmenü' } } });

    expect(result?.content).toEqual({ de: { name: 'Mittagsmenü', description: '' } });
  });

  it('returns null for a plain product — nothing to route', () => {
    expect(toBundleItemFromDetail({ ...detail, type: 'mainItem' })).toBeNull();
  });

  it('returns null for a menu-type product with no definition to render', () => {
    expect(toBundleItemFromDetail({ ...detail, menuDefinition: undefined })).toBeNull();
  });
});

/**
 * The featured banner's mapper. Only `priceEditability` gets real scrutiny — it is the field that
 * decides whether an admin is offered a write, and the banner's payload does not carry enough to
 * derive it the way a card does.
 *
 * A combo is not its own type: it is a `type: 'menu'` product, and nothing in the backend's
 * `SetFeaturedSpecialCommand` stops one being featured. Guessing "no variations ⇒ plain product"
 * would therefore route a combo to the product price endpoint, whose validator accepts `>= 0` where
 * the combo's own editor requires `> 0`.
 */
describe('toCatalogItemFromFeaturedSpecial', () => {
  const special = {
    id: 'f1',
    name: 'Adana Kebab',
    description: 'Charcoal-grilled',
    basePrice: 16.5,
    featuredDate: '2026-08-01',
    preparationTimeMinutes: 22,
    variations: [],
    suggestedSideItems: [],
    detailedIngredients: [],
    type: 'mainItem',
  } as unknown as FeaturedSpecial;

  it('maps a plain product with no variations as editable', () => {
    const result = toCatalogItemFromFeaturedSpecial(special);

    expect(result.priceEditability).toBe('editable');
    expect(result.kind).toBe('product');
    expect(result.isBundle).toBe(false);
    expect(result.price).toBe(16.5);
  });

  it('refuses a variation product, naming variations — the card price is a derived "from" value', () => {
    const result = toCatalogItemFromFeaturedSpecial({
      ...special,
      variations: [{ id: 'v1', name: 'Single', priceModifier: 0, finalPrice: 16.5, isActive: true, displayOrder: 1 }],
    } as unknown as FeaturedSpecial);

    expect(result.priceEditability).toBe('variations');
  });

  it('refuses a featured COMBO — the case the banner could not see before backend #285', () => {
    const result = toCatalogItemFromFeaturedSpecial({ ...special, type: 'menu' } as unknown as FeaturedSpecial);

    expect(result.priceEditability).toBe('bundle');
    expect(result.kind).toBe('bundle');
    expect(result.isBundle).toBe(true);
  });

  it('refuses when the backend sent no type at all, rather than assuming a plain product', () => {
    // The additive-field ordering case: a frontend released ahead of backend #285. Assuming
    // `'editable'` here is exactly the wrong guess — it is the combo that gets written wrongly.
    const result = toCatalogItemFromFeaturedSpecial({ ...special, type: undefined } as unknown as FeaturedSpecial);

    expect(result.priceEditability).toBe('unknownKind');
  });

  it('prefers the variations refusal over the unknown-kind one — it is the provable statement', () => {
    const result = toCatalogItemFromFeaturedSpecial({
      ...special,
      type: undefined,
      variations: [{ id: 'v1', name: 'Single', priceModifier: 0, finalPrice: 16.5, isActive: true, displayOrder: 1 }],
    } as unknown as FeaturedSpecial);

    expect(result.priceEditability).toBe('variations');
  });
  it('treats a special with no variations array at all as having none', () => {
    // The banner's DTO declares `variations` required, but an older backend can omit it — and
    // `undefined.length` is the difference between a refusal and a crash.
    const result = toCatalogItemFromFeaturedSpecial({
      ...special,
      variations: undefined,
    } as unknown as FeaturedSpecial);

    expect(result.priceEditability).toBe('editable');
  });
});

describe('the nullish arms the mappers lean on', () => {
  it('bundle: a section with no items list contributes nothing rather than throwing', () => {
    const result = toCatalogItemFromBundle({
      id: 'b9',
      name: 'Combo',
      basePrice: 12,
      menuDefinition: menuDefinition([{ id: 's1', name: 'Main' } as unknown as MenuSection]),
    } as unknown as MenuBundleItem);

    expect(result.bundleItemNames).toBeUndefined();
  });

  it('detail: a locale entry with no description is normalised, not widened', () => {
    const result = toBundleItemFromDetail({
      id: 'd1',
      type: 'menu',
      name: 'Combo',
      basePrice: 12,
      content: undefined,
      menuDefinition: menuDefinition([]),
    } as unknown as DetailedProduct);

    expect(result?.content).toEqual({});
  });
});
