import { submitEditProductForm } from './productFormUtils';

jest.mock('@/services/productService', () => ({
  updateProduct: jest.fn(async () => ({ success: true })),
  uploadBulkProductImages: jest.fn(async () => ({ success: true })),
}));

jest.mock('@/services/menuService', () => ({
  createProduct: jest.fn(),
  createMenuBundle: jest.fn(),
  updateMenuBundle: jest.fn(async () => ({ success: true })),
}));

jest.mock('@/services/globalIngredientService', () => ({
  createGlobalIngredient: jest.fn(),
  searchGlobalIngredients: jest.fn(async () => ({ success: true, data: [] })),
}));

import { updateProduct } from '@/services/productService';
import { updateMenuBundle } from '@/services/menuService';

/** The shape EditMenuBundleModal builds — editMenuBundleSchema has no category field at all. */
const bundleFormData = (overrides: Record<string, unknown> = {}) => ({
  id: 'bundle-1',
  name: 'Pizza Combo',
  description: 'A combo',
  basePrice: 20,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  type: 'menu',
  preparationTimeMinutes: 15,
  displayOrder: 0,
  content: [{ language: 'en', name: 'Pizza Combo', description: 'A combo' }],
  menuDefinition: { id: 'md-1', isAlwaysAvailable: true, sections: [] },
  ...overrides,
});

/** The shape EditProductModal builds — a plain item never carries a menuDefinition. */
const itemFormData = () => ({
  id: 'product-1',
  name: 'Margherita',
  description: 'A pizza',
  basePrice: 12,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  type: 'mainItem',
  kitchenType: 'None',
  allergens: [],
  categoryIds: ['cat-1'],
  primaryCategoryId: 'cat-1',
  variations: [],
  content: [{ language: 'en', name: 'Margherita', description: 'A pizza' }],
  preparationTimeMinutes: 10,
  suggestedSideItemIds: [],
});

// submitEditProductForm swallows every throw into `catch { setError('root', ...) }`, so a test that
// only inspects mock.calls could pass while the function actually errored. The harness asserts the
// error sink stayed silent and the success callback fired, which makes that impossible.
const setError = jest.fn();
const onProductUpdated = jest.fn();

const submit = async (data: Record<string, unknown>) => {
  await submitEditProductForm({
    data: data as never,
    product: { id: data.id },
    imageFiles: [],
    detailedIngredients: [],
    setIsSubmitting: () => {},
    setError,
    onProductUpdated,
    onClose: () => {},
  });

  expect(setError).not.toHaveBeenCalled();
  expect(onProductUpdated).toHaveBeenCalledTimes(1);
};

beforeEach(() => jest.clearAllMocks());

describe('submitEditProductForm — update endpoint dispatch', () => {
  // Regression: a bundle used to be sent to PUT /api/Products, whose validator requires at least
  // one category. The bundle form has no category field, so it always sent categoryIds: [] and the
  // backend rejected every bundle edit with "At least one category is required".
  it('sends a bundle to the bundle endpoint, not the product endpoint', async () => {
    await submit(bundleFormData());

    expect(updateMenuBundle).toHaveBeenCalledTimes(1);
    expect(updateProduct).not.toHaveBeenCalled();
    expect(updateMenuBundle).toHaveBeenCalledWith('bundle-1', expect.objectContaining({ id: 'bundle-1' }));
  });

  it('still sends a plain item to the product endpoint', async () => {
    await submit(itemFormData());

    expect(updateProduct).toHaveBeenCalledTimes(1);
    expect(updateMenuBundle).not.toHaveBeenCalled();
  });

  // Deliberately NOT named "no longer depends on categories": categoryIds:[] is what the code
  // yields for any input lacking the field, before and after the fix, so it cannot discriminate
  // the dispatch — test 1 does that. What this pins is that the payload the bundle endpoint
  // receives is one UpdateMenuBundleCommand accepts: CategoryIds optional (vs the product
  // command's NotEmpty) and MenuDefinition non-null, which its validator requires.
  it('sends a bundle payload shaped for UpdateMenuBundleCommand', async () => {
    await submit(bundleFormData());

    const [, payload] = (updateMenuBundle as jest.Mock).mock.calls[0];
    expect(payload.categoryIds).toEqual([]);
    expect(payload.primaryCategoryId).toBeNull();
    expect(payload.menuDefinition).toEqual(expect.objectContaining({ id: 'md-1' }));
  });

  // MenuDefinitionDto.StartTime/EndTime are TimeSpan?, which STJ will not parse from "18:00" —
  // MenuScheduleEditor's <input type="time"> emits exactly that. Now that this payload actually
  // reaches the bundle endpoint, the ":00" padding is load-bearing rather than dead code.
  it('pads bundle schedule times to a TimeSpan-parseable shape', async () => {
    await submit(
      bundleFormData({
        menuDefinition: { id: 'md-1', isAlwaysAvailable: false, startTime: '18:00', endTime: '23:30', sections: [] },
      }),
    );

    const [, payload] = (updateMenuBundle as jest.Mock).mock.calls[0];
    expect(payload.menuDefinition.startTime).toBe('18:00:00');
    expect(payload.menuDefinition.endTime).toBe('23:30:00');
  });

  // UpdateMenuBundleCommand.Content is non-null and its handler enumerates it directly, while the
  // product command's is nullable. Removing every language row yields undefined from the form.
  it('sends an empty content map rather than omitting content on a bundle', async () => {
    await submit(bundleFormData({ content: [] }));

    const [, payload] = (updateMenuBundle as jest.Mock).mock.calls[0];
    expect(payload.content).toEqual({});
  });
});
