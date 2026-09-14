import { customizationGroupSchema } from './schemas';

const group = (overrides: Record<string, unknown> = {}) => ({
  name: 'Viande',
  displayOrder: 0,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  includedFreeUnits: 1,
  isActive: true,
  content: {},
  ingredientOptions: [{ productIngredientId: 'meat', displayOrder: 0, isDefault: false }],
  productOptions: [],
  ...overrides,
});

describe('customizationGroupSchema', () => {
  it('accepts valid required and optional boundaries', () => {
    expect(customizationGroupSchema.safeParse(group()).success).toBe(true);
    expect(customizationGroupSchema.safeParse(group({ isRequired: false, minSelection: 0 })).success).toBe(true);
  });

  it.each([
    group({ name: ' ' }),
    group({ minSelection: -1 }),
    group({ minSelection: 2, maxSelection: 1 }),
    group({ maxSelection: 2 }),
    group({ includedFreeUnits: 2 }),
    group({ minSelection: 0 }),
  ])('rejects invalid metadata or cardinality', (candidate) => {
    expect(customizationGroupSchema.safeParse(candidate).success).toBe(false);
  });
});
