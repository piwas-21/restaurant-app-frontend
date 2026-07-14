import { toCatalogItemFromProduct, toCatalogItemFromBundle } from './catalogItem';
import type { MenuItem, MenuBundleItem, MenuDefinition, MenuSection } from '@/types/menu';

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
      price: 12.5,
      isBundle: false,
      allergens: ['gluten'],
      isSpecial: true,
      isAvailable: true,
    });
  });

  it('falls back to the first image when there is no flat image', () => {
    const result = toCatalogItemFromProduct({ ...base, image: '', images: [{ url: 'first.jpg', alt: '' }] });
    expect(result.imageUrl).toBe('first.jpg');
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
});
