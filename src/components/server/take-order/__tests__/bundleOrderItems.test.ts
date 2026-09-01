import { buildBundleOrderItem, buildBundleChildItems } from '../bundleOrderItems';
import { buildOrderItems } from '../orderItems';
import { buildWaiterBundleDefaultSelection } from '../waiterBundleSelection';
import { toggleBundleOption } from '@/utils/bundleSelection';
import type { MenuBundleItem, MenuSection } from '@/types/menu';
import type { Product } from '@/services/serverService';

const menuParent: Product = {
  id: 'menu-sandwich-kebab',
  name: 'Menu Sandwich Kebab',
  basePrice: 12,
  isActive: true,
  isAvailable: true,
  type: 'menu',
};

const sandwichSection: MenuSection = {
  id: 'plat',
  name: 'Plat',
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  displayOrder: 0,
  items: [
    {
      id: 'sandwich-row',
      productId: 'sandwich-kebab',
      productName: 'Sandwich Kebab',
      additionalPrice: 0,
      displayOrder: 0,
      isDefault: false,
      detailedIngredients: [
        {
          id: 'lettuce',
          name: 'Lettuce',
          isActive: true,
          isOptional: false,
          price: 0,
          isIncludedInBasePrice: true,
          displayOrder: 0,
          maxQuantity: 1,
        },
        {
          id: 'onion',
          name: 'Onion',
          isActive: true,
          isOptional: true,
          price: 0,
          isIncludedInBasePrice: true,
          displayOrder: 1,
          maxQuantity: 1,
        },
        {
          id: 'samurai',
          name: 'Samurai sauce',
          kind: 'sauce',
          isActive: true,
          isOptional: true,
          price: 1,
          isIncludedInBasePrice: false,
          displayOrder: 2,
          maxQuantity: 1,
        },
      ],
    },
  ],
};
const drinkSection: MenuSection = {
  id: 'drink',
  name: 'Boisson',
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  displayOrder: 1,
  items: [
    {
      id: 'coke-row',
      productId: 'coke',
      productName: 'Coca-Cola',
      additionalPrice: 0,
      displayOrder: 0,
      isDefault: true,
    },
  ],
};
const dessertSection: MenuSection = {
  id: 'dessert',
  name: 'Dessert',
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  displayOrder: 2,
  items: [
    {
      id: 'baklava-row',
      productId: 'baklava',
      productName: 'Baklava',
      additionalPrice: 1.5,
      displayOrder: 0,
      isDefault: true,
    },
  ],
};
const bundle: MenuBundleItem = {
  id: menuParent.id,
  name: menuParent.name,
  basePrice: 12,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  displayOrder: 0,
  menuDefinition: {
    id: 'definition',
    isAlwaysAvailable: true,
    availableMonday: true,
    availableTuesday: true,
    availableWednesday: true,
    availableThursday: true,
    availableFriday: true,
    availableSaturday: true,
    availableSunday: true,
    sections: [sandwichSection, drinkSection, dessertSection],
  },
};

describe('waiter bundle order mapping', () => {
  it('posts Menu Sandwich Kebab as its product parent with Plat, drink, dessert and child recipe choices', () => {
    const selectedOptions = buildWaiterBundleDefaultSelection(bundle.menuDefinition.sections).map((option) =>
      option.itemId === 'sandwich-kebab'
        ? {
            ...option,
            selectedIngredients: ['lettuce', 'samurai'],
            ingredientQuantities: { lettuce: 1, onion: 0, samurai: 1 },
            specialInstructions: 'well grilled',
          }
        : option,
    );
    const line = buildBundleOrderItem(menuParent, bundle, {
      selectedOptions,
      quantity: 2,
      specialInstructions: 'table side',
      unitPrice: 14.5,
    });

    expect(buildOrderItems([line])).toEqual([
      {
        productId: 'menu-sandwich-kebab',
        quantity: 2,
        unitPrice: 14.5,
        specialInstructions: 'table side',
        childItems: [
          {
            productId: 'sandwich-kebab',
            quantity: 2,
            unitPrice: 0,
            specialInstructions: 'well grilled',
            selectedIngredientIds: ['lettuce', 'samurai'],
            ingredientQuantities: { lettuce: 1, onion: 0, samurai: 1 },
            kind: 'BundleChild',
          },
          {
            productId: 'coke',
            quantity: 2,
            unitPrice: 0,
            specialInstructions: undefined,
            selectedIngredientIds: undefined,
            ingredientQuantities: undefined,
            kind: 'BundleChild',
          },
          {
            productId: 'baklava',
            quantity: 2,
            unitPrice: 1.5,
            specialInstructions: undefined,
            selectedIngredientIds: undefined,
            ingredientQuantities: undefined,
            kind: 'BundleChild',
          },
        ],
      },
    ]);
  });

  it('does not flatten a multi-choice Plat negative control', () => {
    const multiPlat: MenuSection = {
      ...sandwichSection,
      items: [sandwichSection.items[0], { ...sandwichSection.items[0], id: 'plate-2', productId: 'plate-2' }],
      maxSelection: 2,
    };
    expect(buildWaiterBundleDefaultSelection([multiPlat])).toEqual([]);
  });

  it('keeps the chosen Tacos meat and posts it as the menu child', () => {
    const meat: MenuSection = {
      id: 'meat',
      name: 'Viande',
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      displayOrder: 0,
      items: [
        {
          id: 'chicken-row',
          productId: 'chicken',
          productName: 'Chicken',
          additionalPrice: 0,
          displayOrder: 0,
          isDefault: true,
        },
        {
          id: 'beef-row',
          productId: 'beef',
          productName: 'Beef',
          additionalPrice: 1,
          displayOrder: 1,
          isDefault: false,
        },
      ],
    };
    const chosen = toggleBundleOption(meat, buildWaiterBundleDefaultSelection([meat]), 'beef');
    expect(chosen).toEqual([{ sectionId: 'meat', itemId: 'beef', quantity: 1 }]);
    expect(buildBundleChildItems({ sections: [meat], selectedOptions: chosen }, 1)).toEqual([
      {
        productId: 'beef',
        quantity: 1,
        unitPrice: 1,
        specialInstructions: undefined,
        selectedIngredientIds: undefined,
        ingredientQuantities: undefined,
        kind: 'BundleChild',
      },
    ]);
  });
});
