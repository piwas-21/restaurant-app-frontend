import {
  buildBundleOption,
  buildDefaultBundleSelection,
  buildGuestDefaultBundleSelection,
  bundleOptionKey,
  countSectionSelections,
  findBundleOption,
  findBundleSelectionErrors,
  toggleBundleOption,
  updateBundleOption,
} from './bundleSelection';
import { bundleLineUnitPrice } from './linePrice';
import type {
  DetailedIngredient,
  MenuSection,
  MenuSectionItem,
  ProductCustomizationGroup,
  SelectedMenuOption,
} from '@/types/menu';
import { OrderType } from '@/types/order';

const ing = (over: Partial<DetailedIngredient> & { id: string }): DetailedIngredient => ({
  name: over.id,
  isOptional: true,
  price: 0,
  isIncludedInBasePrice: false,
  isActive: true,
  displayOrder: 0,
  maxQuantity: 1,
  ...over,
});

const item = (over: Partial<MenuSectionItem> & { productId: string }): MenuSectionItem => ({
  id: `si-${over.productId}`,
  productName: over.productId,
  additionalPrice: 0,
  displayOrder: 0,
  isDefault: false,
  ...over,
});

const section = (over: Partial<MenuSection> & { id: string }): MenuSection => ({
  name: over.id,
  displayOrder: 0,
  isRequired: false,
  minSelection: 0,
  maxSelection: 1,
  items: [],
  ...over,
});

describe('buildBundleOption — base-recipe seeding', () => {
  it('seeds the base recipe so the option starts at the advertised price', () => {
    const burger = item({
      productId: 'burger',
      detailedIngredients: [
        ing({ id: 'patty', isOptional: false, price: 5 }),
        ing({ id: 'cheese', price: 2, isIncludedInBasePrice: true }),
        ing({ id: 'bacon', price: 3 }),
      ],
    });

    const option = buildBundleOption('s1', burger);

    expect(option).toEqual({
      sectionId: 's1',
      itemId: 'burger',
      quantity: 1,
      selectedIngredients: ['patty', 'cheese'],
      ingredientQuantities: { patty: 1, cheese: 1 },
    });
  });

  it('seeded options price at exactly base + additionalPrice (customization delta 0)', () => {
    const burger = item({
      productId: 'burger',
      additionalPrice: 4,
      detailedIngredients: [
        ing({ id: 'patty', isOptional: false, price: 5 }),
        ing({ id: 'cheese', price: 2, isIncludedInBasePrice: true }),
      ],
    });
    const sections = [section({ id: 's1', items: [burger] })];

    const unitPrice = bundleLineUnitPrice({
      basePrice: 20,
      sections,
      selectedOptions: [buildBundleOption('s1', burger)],
    });

    expect(unitPrice).toBe(24);
  });

  it('omits the selection when the payload carries no ingredients for the child', () => {
    expect(buildBundleOption('s1', item({ productId: 'coke' }))).toEqual({
      sectionId: 's1',
      itemId: 'coke',
      quantity: 1,
    });
    expect(buildBundleOption('s1', item({ productId: 'coke', detailedIngredients: [] }))).toEqual({
      sectionId: 's1',
      itemId: 'coke',
      quantity: 1,
    });
  });

  it('carries a variation-linked child into SelectedMenuOptionDto payload shape', () => {
    expect(
      buildBundleOption(
        'main',
        item({ productId: 'burger', productVariationId: 'large-portion', productVariationPriceModifier: 2.5 }),
      ),
    ).toEqual({
      sectionId: 'main',
      itemId: 'burger',
      productVariationId: 'large-portion',
      productVariationPriceModifier: 2.5,
      quantity: 1,
    });
  });

  it('omits blocked defaults from customization groups on MenuDefinition section children', () => {
    const childGroup: ProductCustomizationGroup = {
      id: 'child-side',
      name: 'Side choice',
      displayOrder: 1,
      isRequired: false,
      minSelection: 0,
      maxSelection: 2,
      includedFreeUnits: 0,
      isActive: true,
      content: {},
      ingredientOptions: [],
      productOptions: [
        {
          id: 'blocked-member',
          optionProductId: 'unavailable-side',
          optionProductName: 'Unavailable side',
          additionalPrice: 0,
          displayOrder: 1,
          isDefault: true,
          optionProductIsActive: true,
          optionProductIsAvailable: true,
          availability: { canOrder: false, reason: 'WrongOrderType', allowedOrderTypes: [OrderType.Takeaway] },
        },
        {
          id: 'browse-member',
          optionProductId: 'browse-side',
          optionProductName: 'Browse side',
          additionalPrice: 0,
          displayOrder: 2,
          isDefault: true,
          optionProductIsActive: true,
          optionProductIsAvailable: true,
          availability: { canOrder: true, reason: 'Available', allowedOrderTypes: [OrderType.Takeaway] },
        },
      ],
    };

    const option = buildBundleOption('bundle-main', item({ productId: 'wrap', customizationGroups: [childGroup] }));

    expect(option.customizationSelections).toEqual([
      { groupId: 'child-side', options: [{ kind: 1, optionId: 'browse-member', quantity: 1 }] },
    ]);
  });
});

describe('buildDefaultBundleSelection', () => {
  it('picks the isDefault items, capped at maxSelection', () => {
    const sections = [
      section({
        id: 's1',
        maxSelection: 2,
        items: [
          item({ productId: 'a', isDefault: true }),
          item({ productId: 'b', isDefault: true }),
          item({ productId: 'c', isDefault: true }),
          item({ productId: 'd' }),
        ],
      }),
      section({ id: 's2', items: [item({ productId: 'e' })] }),
    ];

    expect(buildDefaultBundleSelection(sections).map((o) => o.itemId)).toEqual(['a', 'b']);
  });

  it('keeps blocked defaults for staff while guest validation rejects the fixed Plat', () => {
    const fixedPlat = section({
      id: 'plat',
      name: 'Plat',
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      items: [
        item({
          productId: 'burger',
          availability: {
            canOrder: false,
            reason: 'WrongOrderType',
            allowedOrderTypes: [OrderType.Takeaway],
            inheritsOrderTypes: true,
          },
        }),
      ],
    });

    expect(buildDefaultBundleSelection([fixedPlat]).map((option) => option.itemId)).toEqual(['burger']);

    const selected = buildGuestDefaultBundleSelection([fixedPlat]);

    expect(selected).toEqual([]);
    expect(findBundleSelectionErrors([fixedPlat], selected)).toEqual([{ sectionId: 'plat', minSelection: 1 }]);
  });
});

describe('toggleBundleOption', () => {
  const single = section({
    id: 'drink',
    maxSelection: 1,
    items: [item({ productId: 'coke' }), item({ productId: 'fanta' })],
  });
  const multi = section({
    id: 'sides',
    maxSelection: 2,
    items: [item({ productId: 'fries' }), item({ productId: 'salad' }), item({ productId: 'soup' })],
  });

  it('replaces the selection in a single-choice section (radio)', () => {
    const first = toggleBundleOption(single, [], 'coke');
    const second = toggleBundleOption(single, first, 'fanta');

    expect(second.map((o) => o.itemId)).toEqual(['fanta']);
  });

  it('leaves an already-selected radio option — and its customization — untouched', () => {
    const selected: SelectedMenuOption[] = [
      { sectionId: 'drink', itemId: 'coke', quantity: 1, specialInstructions: 'no ice' },
    ];

    expect(toggleBundleOption(single, selected, 'coke')).toEqual(selected);
  });

  it('adds and removes in a multi-choice section (checkbox)', () => {
    const added = toggleBundleOption(multi, [], 'fries');
    expect(added.map((o) => o.itemId)).toEqual(['fries']);
    expect(toggleBundleOption(multi, added, 'fries')).toEqual([]);
  });

  it('ignores a toggle past maxSelection rather than evicting an earlier pick', () => {
    const atCap = toggleBundleOption(multi, toggleBundleOption(multi, [], 'fries'), 'salad');
    const beyond = toggleBundleOption(multi, atCap, 'soup');

    expect(beyond.map((o) => o.itemId)).toEqual(['fries', 'salad']);
  });

  it('ignores an itemId that is not in the section', () => {
    expect(toggleBundleOption(single, [], 'nope')).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const selected: SelectedMenuOption[] = [{ sectionId: 'drink', itemId: 'coke', quantity: 1 }];
    toggleBundleOption(single, selected, 'fanta');

    expect(selected.map((o) => o.itemId)).toEqual(['coke']);
  });
});

describe('updateBundleOption / findBundleOption / countSectionSelections', () => {
  const selected: SelectedMenuOption[] = [
    { sectionId: 's1', itemId: 'a', quantity: 1 },
    { sectionId: 's1', itemId: 'b', quantity: 2 },
    { sectionId: 's2', itemId: 'c', quantity: 1 },
  ];

  it('patches only the addressed option', () => {
    const next = updateBundleOption(selected, 's1', 'b', { specialInstructions: 'extra hot' });

    expect(findBundleOption(next, 's1', 'b')?.specialInstructions).toBe('extra hot');
    expect(findBundleOption(next, 's1', 'a')?.specialInstructions).toBeUndefined();
  });

  it('composes quantity deltas while keeping selection, instructions and other options', () => {
    const initial: SelectedMenuOption[] = [
      {
        sectionId: 's1',
        itemId: 'a',
        quantity: 1,
        selectedIngredients: ['salsa'],
        ingredientQuantities: { salsa: 1, cheese: 2 },
        specialInstructions: 'Keep separate',
      },
      selected[1],
    ];
    const chosen = updateBundleOption(initial, 's1', 'a', { selectedIngredients: ['mayo'] });
    const cleared = updateBundleOption(chosen, 's1', 'a', { ingredientQuantities: { salsa: 0 } });
    const next = updateBundleOption(cleared, 's1', 'a', { ingredientQuantities: { mayo: 1 } });

    expect(next[0]).toEqual({
      ...initial[0],
      selectedIngredients: ['mayo'],
      ingredientQuantities: { salsa: 0, cheese: 2, mayo: 1 },
    });
    expect(next[1]).toBe(initial[1]);
    expect(initial[0].ingredientQuantities).toEqual({ salsa: 1, cheese: 2 });
    expect(chosen[0].ingredientQuantities).toBe(initial[0].ingredientQuantities);
  });

  it('creates a quantities map for an option without one and preserves other patch semantics', () => {
    const next = updateBundleOption(selected, 's1', 'a', { ingredientQuantities: { salsa: 0 } });
    expect(next[0].ingredientQuantities).toEqual({ salsa: 0 });
    const withNote = updateBundleOption(next, 's1', 'a', { specialInstructions: 'No salt' });
    const clearedNote = updateBundleOption(withNote, 's1', 'a', { specialInstructions: undefined });
    expect(clearedNote[0].specialInstructions).toBeUndefined();
    expect(clearedNote[0].ingredientQuantities).toEqual({ salsa: 0 });
  });

  it('counts distinct options by default and portions in a repeatable section', () => {
    expect(countSectionSelections(selected, 's1')).toBe(2);
    expect(countSectionSelections(selected, 's1', true)).toBe(3);
    expect(countSectionSelections(selected, 'missing')).toBe(0);
  });

  it('keeps same-product options with different variations independently selectable and customizable', () => {
    const regular = item({ id: 'regular', productId: 'drink', productVariationId: null });
    const large = item({
      id: 'large',
      productId: 'drink',
      productVariationId: 'large',
      productVariationPriceModifier: 2,
    });
    const sectionWithVariations = section({ id: 'drinks', maxSelection: 2, items: [regular, large] });
    const withRegular = toggleBundleOption(sectionWithVariations, [], regular.productId, regular.productVariationId);
    const both = toggleBundleOption(sectionWithVariations, withRegular, large.productId, large.productVariationId);

    expect(both).toHaveLength(2);
    expect(findBundleOption(both, 'drinks', 'drink', null)?.productVariationId).toBeNull();
    expect(findBundleOption(both, 'drinks', 'drink', 'large')?.productVariationId).toBe('large');

    const updated = updateBundleOption(both, 'drinks', 'drink', { specialInstructions: 'extra ice' }, 'large');
    expect(findBundleOption(updated, 'drinks', 'drink', 'large')?.specialInstructions).toBe('extra ice');
    expect(findBundleOption(updated, 'drinks', 'drink', null)?.specialInstructions).toBeUndefined();
    expect(bundleOptionKey('drinks', 'drink', null)).not.toBe(bundleOptionKey('drinks', 'drink', 'large'));
  });
});

describe('findBundleSelectionErrors — required-group gating', () => {
  const sections = [
    section({ id: 'required', isRequired: true, minSelection: 1, maxSelection: 1 }),
    section({ id: 'optional', isRequired: false, minSelection: 1, maxSelection: 1 }),
  ];

  it('flags a required section that has not met minSelection', () => {
    expect(findBundleSelectionErrors(sections, [])).toEqual([{ sectionId: 'required', minSelection: 1 }]);
  });

  it('never flags a section that is not required', () => {
    const errors = findBundleSelectionErrors(sections, [{ sectionId: 'required', itemId: 'x', quantity: 1 }]);

    expect(errors).toEqual([]);
  });

  it('needs minSelection distinct options — a single option at quantity 2 does not satisfy it', () => {
    const twoOf = [section({ id: 'required', isRequired: true, minSelection: 2, maxSelection: 2 })];

    expect(findBundleSelectionErrors(twoOf, [{ sectionId: 'required', itemId: 'x', quantity: 2 }])).toEqual([
      { sectionId: 'required', minSelection: 2 },
    ]);
    expect(
      findBundleSelectionErrors(twoOf, [
        { sectionId: 'required', itemId: 'x', quantity: 1 },
        { sectionId: 'required', itemId: 'y', quantity: 1 },
      ]),
    ).toEqual([]);
  });

  it('accepts two or three portions of one meat only when the section allows repeats', () => {
    const meats = section({
      id: 'meat',
      isRequired: true,
      minSelection: 3,
      maxSelection: 3,
      allowRepeatedItems: true,
      items: [item({ productId: 'kebab' }), item({ productId: 'chicken' })],
    });
    const kebab = [{ sectionId: 'meat', itemId: 'kebab', quantity: 3 }];
    expect(findBundleSelectionErrors([meats], kebab)).toEqual([]);
    expect(findBundleSelectionErrors([meats], [{ ...kebab[0], quantity: 2 }])).toHaveLength(1);
    expect(toggleBundleOption(meats, kebab, 'chicken')).toEqual(kebab);
    const mixed = [
      { ...kebab[0], quantity: 1 },
      { sectionId: 'meat', itemId: 'chicken', quantity: 2 },
    ];
    expect(findBundleSelectionErrors([meats], mixed)).toEqual([]);
  });
});
