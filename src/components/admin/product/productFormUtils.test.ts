import { submitEditProductForm, submitProductForm } from './productFormUtils';
// Through the ALIAS, so `instanceof ApiError` inside `serverMessages` resolves to the same class.
import { ApiError } from '@/utils/apiClient';

jest.mock('@/services/productService', () => ({
  updateProduct: jest.fn(async () => ({ success: true })),
  uploadBulkProductImages: jest.fn(async () => ({ success: true })),
}));

jest.mock('@/services/menuService', () => ({
  createProduct: jest.fn(async () => ({ success: true, data: { id: 'new-product' } })),
}));
jest.mock('@/services/menuBundleService', () => ({
  createMenuBundle: jest.fn(async () => ({ success: true, data: { id: 'new-bundle' } })),
  updateMenuBundle: jest.fn(async () => ({ success: true })),
}));

jest.mock('@/services/globalIngredientService', () => ({
  createGlobalIngredient: jest.fn(),
  searchGlobalIngredients: jest.fn(async () => ({ success: true, data: [] })),
}));

import { updateProduct } from '@/services/productService';
import { createProduct } from '@/services/menuService';
import { updateMenuBundle, createMenuBundle } from '@/services/menuBundleService';

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
    fallbackMessage: 'translated fallback',
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

// submitProductForm shares toMenuDefinitionPayload with the edit path, and it is the reference the
// edit dispatch was modelled on — but it had no coverage, so the extraction would have been an
// unguarded refactor. These pin the create side of both.
describe('submitProductForm — create endpoint dispatch', () => {
  const create = (data: Record<string, unknown>) =>
    submitProductForm({
      data: data as never,
      imageFiles: [],
      currentLanguage: 'en',
      detailedIngredients: [],
      setSubmissionStatus: () => {},
      setError,
      onProductCreated: () => {},
      onClose: () => {},
      fallbackMessage: 'translated fallback',
      reset: () => {},
      setImageFiles: () => {},
    });

  it('sends a new bundle to the bundle endpoint', async () => {
    await create(bundleFormData());

    expect(createMenuBundle).toHaveBeenCalledTimes(1);
    expect(createProduct).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it('sends a new plain item to the product endpoint', async () => {
    await create(itemFormData());

    expect(createProduct).toHaveBeenCalledTimes(1);
    expect(createMenuBundle).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it('pads schedule times on create too, via the shared menu-definition mapping', async () => {
    await create(
      bundleFormData({
        menuDefinition: {
          id: 'temp-123',
          isAlwaysAvailable: false,
          startTime: '09:15',
          endTime: '11:00',
          sections: [],
        },
      }),
    );

    const [payload] = (createMenuBundle as jest.Mock).mock.calls[0];
    expect(payload.menuDefinition.startTime).toBe('09:15:00');
    expect(payload.menuDefinition.endTime).toBe('11:00:00');
  });
});

/**
 * The failure paths. Both functions used to unwrap `error.response.data` — the AXIOS error
 * envelope, and axios is not a dependency here — so their per-field / `title` / `message` branches
 * were all dead. The two paths then differed: CREATE had a live `else if (error?.message)` tail
 * and did show a server message, while EDIT's `} catch {` discarded the error object outright and
 * always printed a hardcoded English literal. Neither ever read `errors[]` — and the backend's
 * one-argument `ApiResponse.Failure("<reason>")` puts the reason THERE, leaving `message` at its
 * default literal `"Operation failed"` (`ApiResponse.cs:55-63`).
 *
 * Untested before this: the suite only ever drove the success path, so the rewrite would have been
 * an unguarded refactor of the half that only runs when something has gone wrong.
 */
describe('the failure paths surface the server’s reason, or the caller’s translated sentence', () => {
  const rootMessage = () => setError.mock.calls[0][1].message;

  const editFailingWith = async (failure: unknown, thrown = true) => {
    (updateMenuBundle as jest.Mock).mockImplementationOnce(
      thrown
        ? async () => {
            throw failure;
          }
        : async () => failure,
    );
    await submitEditProductForm({
      data: bundleFormData() as never,
      product: { id: 'bundle-1' },
      imageFiles: [],
      detailedIngredients: [],
      setIsSubmitting: () => {},
      setError,
      onProductUpdated,
      onClose: () => {},
      fallbackMessage: 'translated fallback',
    });
  };

  const createFailingWith = async (failure: unknown, thrown = true) => {
    (createMenuBundle as jest.Mock).mockImplementationOnce(
      thrown
        ? async () => {
            throw failure;
          }
        : async () => failure,
    );
    await submitProductForm({
      data: bundleFormData() as never,
      imageFiles: [],
      currentLanguage: 'en',
      detailedIngredients: [],
      setSubmissionStatus: () => {},
      setError,
      onProductCreated: () => {},
      onClose: () => {},
      fallbackMessage: 'translated fallback',
      reset: () => {},
      setImageFiles: () => {},
    });
  };

  it.each([
    ['edit', editFailingWith],
    ['create', createFailingWith],
  ])('%s: shows the per-rule reason a THROWN ApiError carries', async (_label, run) => {
    await run(new ApiError(400, 'Validation failed', ['At least one category is required']));

    expect(rootMessage()).toBe('At least one category is required');
    expect(onProductUpdated).not.toHaveBeenCalled();
  });

  it.each([
    ['edit', editFailingWith],
    ['create', createFailingWith],
  ])("%s: shows the server's summary when there is no per-rule list", async (_label, run) => {
    await run(new ApiError(409, 'That name is taken'));

    expect(rootMessage()).toBe('That name is taken');
  });

  it.each([
    ['edit', editFailingWith],
    ['create', createFailingWith],
  ])('%s: falls back to the translated sentence when the server said nothing', async (_label, run) => {
    // The #401 case: a dead backend now throws `ApiError(0, '')`, and this is the literal that
    // used to be hardcoded English no matter the admin's language.
    await run(new ApiError(0, ''));

    expect(rootMessage()).toBe('translated fallback');
  });

  it.each([
    ['edit', editFailingWith],
    ['create', createFailingWith],
  ])('%s: does not render a client-side throw', async (_label, run) => {
    await run(new TypeError('x.map is not a function'));

    expect(rootMessage()).toBe('translated fallback');
  });

  it.each([
    ['edit', editFailingWith],
    ['create', createFailingWith],
  ])('%s: reads a RESOLVED failure — the shape a handler error arrives in', async (_label, run) => {
    // `Ok(ApiResponse.Failure(...))` resolves rather than throwing, so this never becomes an
    // `ApiError`. It used to be read as `response.message || '<English>'`, which dropped `errors`.
    await run({ success: false, errors: ['Menu definition is required'] }, false);

    expect(rootMessage()).toBe('Menu definition is required');
  });

  it.each([
    ['edit', editFailingWith],
    ['create', createFailingWith],
  ])('%s: falls back for a RESOLVED failure with a blank message', async (_label, run) => {
    await run({ success: false, message: '   ' }, false);

    expect(rootMessage()).toBe('translated fallback');
  });
});

// The admin editor sends a great many translation entries the admin never touched, and backend #323
// turns those from a silent server-side skip into a 400. These pin the client half.
//
// The fixtures are the editor's REAL defaults, not invented ones: ProductVariations.tsx registers a
// name and a description input for all ten LANGUAGE_CODES inside a <details> (which hides its
// children without unmounting them, so they register unopened), and
// ProductIngredientsManager.handleAddIngredient seeds exactly these seven.
describe('untouched translation entries are dropped; entries carrying anything are sent', () => {
  const blank = () => ({ name: '', description: '' });
  const untouchedVariationContent = () =>
    Object.fromEntries(['en', 'tr', 'es', 'ar', 'de', 'fr', 'nl', 'it', 'ru', 'zh'].map((l) => [l, blank()]));
  const seededIngredientContent = () =>
    Object.fromEntries(['en', 'tr', 'de', 'fr', 'it', 'ar', 'es'].map((l) => [l, blank()]));

  const variation = (content: unknown) => ({
    name: 'Large',
    description: '',
    priceModifier: 2,
    isActive: true,
    displayOrder: 0,
    content,
  });
  const ingredient = (content: unknown) => ({ id: 'temp-1', name: 'Cheese', isOptional: false, content });

  const createWith = async (data: Record<string, unknown>, detailedIngredients: unknown[] = []) => {
    await submitProductForm({
      data: data as never,
      imageFiles: [],
      currentLanguage: 'en',
      detailedIngredients: detailedIngredients as never,
      setSubmissionStatus: () => {},
      setError,
      onProductCreated: () => {},
      onClose: () => {},
      fallbackMessage: 'translated fallback',
      reset: () => {},
      setImageFiles: () => {},
    });
    expect(setError).not.toHaveBeenCalled();
    return (createProduct as jest.Mock).mock.calls[0][0];
  };

  const updateWith = async (data: Record<string, unknown>, detailedIngredients: unknown[] = []) => {
    await submitEditProductForm({
      data: { ...itemFormData(), ...data } as never,
      product: { id: 'product-1' },
      imageFiles: [],
      detailedIngredients: detailedIngredients as never,
      setIsSubmitting: () => {},
      setError,
      onProductUpdated,
      onClose: () => {},
      fallbackMessage: 'translated fallback',
    });
    expect(setError).not.toHaveBeenCalled();
    return (updateProduct as jest.Mock).mock.calls[0][1];
  };

  it('create: drops all ten untouched variation entries', async () => {
    const payload = await createWith({ ...itemFormData(), variations: [variation(untouchedVariationContent())] });

    expect(payload.variations[0].content).toEqual({});
  });

  it('create: drops the seven blank entries seeded on a newly added ingredient', async () => {
    const payload = await createWith(itemFormData(), [ingredient(seededIngredientContent())]);

    expect(payload.detailedIngredients[0].content).toEqual({});
  });

  it('update: drops all ten untouched variation entries', async () => {
    const payload = await updateWith({ variations: [variation(untouchedVariationContent())] });

    expect(payload.variations[0].content).toEqual({});
  });

  it('update: drops the seven blank entries seeded on a newly added ingredient', async () => {
    const payload = await updateWith({}, [ingredient(seededIngredientContent())]);

    expect(payload.detailedIngredients[0].content).toEqual({});
  });

  // The point of filtering on TOUCHED rather than on a blank name. Dropping this here would move
  // #323's silent discard from the server to the client; the server answers 400 "A translation's
  // name is required ('fr')" instead.
  it.each([
    ['create', createWith],
    ['update', updateWith],
  ])('%s: SENDS a description-only variation entry so the server can refuse it', async (_label, run) => {
    const content = { ...untouchedVariationContent(), fr: { name: '', description: 'Grande portion' } };

    const payload = await run({ variations: [variation(content)] } as Record<string, unknown>, []);

    expect(payload.variations[0].content).toEqual({ fr: { name: '', description: 'Grande portion' } });
  });

  // NOT covered here, deliberately: a null entry (`{"en": null}`). The filter keeps one rather than
  // swallowing it, but no test pins that, because neither surface can produce one and one of them
  // never reaches the filter at all. `variationSchema.content` is `z.record(z.string(),
  // z.object(...))`, so the resolver refuses a null value; detailedIngredients bypass Zod, but the
  // global-ingredient prefetch above dereferences `(content as any).name` on every entry first and
  // throws on a null — measured, and a pre-existing trap this PR does not touch.

  // Blankness is a trim test, so an entry holding only spaces is untouched and goes. One holding a
  // whitespace name AND a real description is sent, and the server refuses it — #323 asked for
  // IsNullOrWhiteSpace precisely because `name="   "` used to persist.
  it('create: drops an all-whitespace entry but sends a whitespace name that carries a description', async () => {
    const content = { en: { name: '  ', description: '  ' }, fr: { name: '   ', description: 'Grande' } };

    const payload = await createWith({ ...itemFormData(), variations: [variation(content)] });

    expect(payload.variations[0].content).toEqual({ fr: { name: '   ', description: 'Grande' } });
  });

  // The top-level map is NOT filtered on the touched test — see the comment at the create-path
  // forEach. `contentSchema.name` is `min(1)`, so a blank-named row never reaches submit; the row
  // that DOES get through is a whitespace-only name, which `min(1)` counts as three characters.
  // The create path used to forward it verbatim, and backend #323 would answer 400. The update path
  // has always dropped it. This pins the two paths agreeing.
  it.each([
    ['create', createWith],
    ['update', updateWith],
  ])('%s: drops a whitespace-only top-level name that would become a blank one', async (_label, run) => {
    const payload = await run(
      {
        ...itemFormData(),
        content: [
          { language: 'en', name: 'Margherita', description: 'A pizza' },
          { language: 'fr', name: '   ', description: 'Une pizza' },
        ],
      } as Record<string, unknown>,
      [],
    );

    expect(payload.content).toEqual({ en: { name: 'Margherita', description: 'A pizza' } });
  });
});
