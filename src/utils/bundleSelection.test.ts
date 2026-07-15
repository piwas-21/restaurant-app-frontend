import {
  buildBundleOption,
  buildDefaultBundleSelection,
  countSectionSelections,
  findBundleOption,
  findBundleSelectionErrors,
  toggleBundleOption,
  updateBundleOption,
} from './bundleSelection';
import { bundleLineUnitPrice } from './linePrice';
import type { DetailedIngredient, MenuSection, MenuSectionItem, SelectedMenuOption } from '@/types/menu';

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

  it('counts options, not their quantities — matching the server gate', () => {
    // BasketItemFactory gates Min/MaxSelection on sectionSelections.Count, so 'b' at quantity 2
    // still counts once.
    expect(countSectionSelections(selected, 's1')).toBe(2);
    expect(countSectionSelections(selected, 'missing')).toBe(0);
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
    // Mirrors the server, which would reject this payload with a 400 (BasketItemFactory gates on
    // sectionSelections.Count).
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
});
