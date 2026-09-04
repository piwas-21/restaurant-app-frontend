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

import { createGlobalIngredient, searchGlobalIngredients } from '@/services/globalIngredientService';
import { updateProduct, uploadBulkProductImages } from '@/services/productService';
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
// The partial-success sink: the product was written, its photos were not. Required on both
// functions, so every harness below passes it and the assertions can read what it was told.
const onImageUploadFailed = jest.fn();

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
    onImageUploadFailed,
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
      onImageUploadFailed,
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
 * #536 — the plain description box and the translation row it was copied into.
 *
 * `submitProductForm` copies *Açıklama* into `content[<the admin's UI language>]` on CREATE, and
 * nothing ever re-synced it: the admin edited the plain box, saved, and a guest in that language
 * kept reading the creation-time text. These drive the REAL submit function, because the defect
 * lives in what reaches the wire, not in what the form holds.
 *
 * The `product` argument is the item as FETCHED — the previous base text is the only thing that can
 * tell a snapshot from a translation, and it exists nowhere else at submit time.
 */
describe('submitEditProductForm — a translation that is a copy of the base text (#536)', () => {
  const editWith = async (data: Record<string, unknown>, product: Record<string, unknown>) => {
    await submitEditProductForm({
      data: data as never,
      product,
      imageFiles: [],
      detailedIngredients: [],
      setIsSubmitting: () => {},
      setError,
      onProductUpdated,
      onClose: () => {},
      fallbackMessage: 'translated fallback',
      onImageUploadFailed,
    });

    expect(setError).not.toHaveBeenCalled();
    return (updateProduct as jest.Mock).mock.calls[0][1] as { content?: Record<string, unknown> };
  };

  /** The item as the API sends it, and the form rows seeded from it — one Turkish snapshot. */
  const fetched = { id: 'product-1', name: 'Adana Dürüm', description: 'Acılı dürüm' };
  const withDescription = (description: string) => ({
    ...itemFormData(),
    name: 'Adana Dürüm',
    description,
    content: [{ language: 'tr', name: 'Adana Dürüm', description: 'Acılı dürüm' }],
  });

  it('re-syncs the snapshot so the edit reaches the guest', async () => {
    const payload = await editWith(withDescription('Bol acılı dürüm'), fetched);

    expect(payload.content).toEqual({ tr: { name: 'Adana Dürüm', description: 'Bol acılı dürüm' } });
  });

  it('never touches a translation that the admin actually wrote', async () => {
    const data = {
      ...withDescription('Bol acılı dürüm'),
      content: [{ language: 'fr', name: 'Wrap Adana', description: 'Wrap épicé' }],
    };

    const payload = await editWith(data, fetched);

    expect(payload.content).toEqual({ fr: { name: 'Wrap Adana', description: 'Wrap épicé' } });
  });

  // A save that changes nothing must change nothing — the rule this whole editor is held to.
  it('sends the row back untouched when the base text was not edited', async () => {
    const payload = await editWith(withDescription('Acılı dürüm'), fetched);

    expect(payload.content).toEqual({ tr: { name: 'Adana Dürüm', description: 'Acılı dürüm' } });
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
      onImageUploadFailed,
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
      onImageUploadFailed,
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
      onImageUploadFailed,
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
      onImageUploadFailed,
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
  //
  // Backend #323 does NOT refuse that (it leaves the top-level rule permissive on purpose, and a
  // probe measured 200), so this is not about a 400. The create path used to persist such a row and
  // the update path has always dropped it, which means the row was silently deleted by the next
  // save's full replace. This pins the two paths agreeing.
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

/**
 * Track F / F1b — the half of the photo-upload bug that made it INVISIBLE.
 *
 * The bulk endpoint answers a total rejection with HTTP 200 and `success: false` (backend #398), so
 * nothing throws. Create `console.error`ed that response and edit did not even bind it, so an admin
 * whose photos were all refused — every compressed photo, until frontend #525 stopped sending them
 * as `filename="blob"` — read a plain success and a product with no image.
 */
describe('a product that was written but whose photos were refused', () => {
  const photo = () => new File([new Uint8Array(8)], 'Ali Nazik.jpg', { type: 'image/jpeg' });
  const bulk = uploadBulkProductImages as jest.Mock;
  const onProductCreated = jest.fn();

  const createWithPhoto = () =>
    submitProductForm({
      data: itemFormData() as never,
      imageFiles: [photo()],
      currentLanguage: 'en',
      detailedIngredients: [],
      setSubmissionStatus: () => {},
      setError,
      onProductCreated,
      onClose: () => {},
      fallbackMessage: 'translated fallback',
      reset: () => {},
      setImageFiles: () => {},
      onImageUploadFailed,
    });

  const editWithPhoto = () =>
    submitEditProductForm({
      data: itemFormData() as never,
      product: { id: 'product-1' },
      imageFiles: [photo()],
      detailedIngredients: [],
      setIsSubmitting: () => {},
      setError,
      onProductUpdated,
      onClose: () => {},
      fallbackMessage: 'translated fallback',
      onImageUploadFailed,
    });

  // The exact envelope backend #398 sends when every file was rejected: 200, success:false, one
  // `errors[]` entry per file, each naming the file. `message` is the summary, `errors` the cause.
  const allRefused = {
    success: false,
    message: 'None of the 1 files could be uploaded.',
    data: null,
    errors: ["'blob' — File type not allowed. Allowed types: .jpg, .jpeg, .png, .webp"],
  };

  it.each([
    ['create', () => createWithPhoto()],
    ['edit', () => editWithPhoto()],
  ])("%s: reports the server's per-file reason instead of swallowing it", async (_label, run) => {
    bulk.mockResolvedValueOnce(allRefused);

    await run();

    expect(onImageUploadFailed).toHaveBeenCalledTimes(1);
    expect(onImageUploadFailed).toHaveBeenCalledWith(
      "'blob' — File type not allowed. Allowed types: .jpg, .jpeg, .png, .webp",
    );
  });

  // A refused PHOTO is not a refused PRODUCT: the write already committed, so the run finishes
  // (navigate/refresh) and the form-level error slot — which says "your save failed" — stays empty.
  // On create that is load-bearing: leaving the form open invites a second Save and a duplicate.
  it.each([
    ['create', () => createWithPhoto(), onProductCreated],
    ['edit', () => editWithPhoto(), onProductUpdated],
  ])('%s: still finishes the run and does not set a form-level error', async (_label, run, done) => {
    bulk.mockResolvedValueOnce(allRefused);

    await run();

    expect(done).toHaveBeenCalledTimes(1);
    expect(setError).not.toHaveBeenCalled();
  });

  // `success: true` WITH errors — "Uploaded 1 images. 1 failed.". Checking only `!success` would
  // silently claim a photo that is not there, which is the same defect one size smaller.
  it('reports a PARTIAL upload, which the server still calls a success', async () => {
    bulk.mockResolvedValueOnce({
      success: true,
      message: 'Uploaded 1 images. 1 failed.',
      data: [{ id: 'img-1' }],
      errors: ["'menu.heic' — File type not allowed. Allowed types: .jpg, .jpeg, .png, .webp"],
    });

    await createWithPhoto();

    expect(onImageUploadFailed).toHaveBeenCalledWith(
      "'menu.heic' — File type not allowed. Allowed types: .jpg, .jpeg, .png, .webp",
    );
  });

  it('says nothing when every photo was stored', async () => {
    bulk.mockResolvedValueOnce({ success: true, message: 'Successfully uploaded 1 images', data: [{}], errors: null });

    await createWithPhoto();

    expect(onImageUploadFailed).not.toHaveBeenCalled();
    expect(onProductCreated).toHaveBeenCalledTimes(1);
  });

  // A 413/401/502 or a dead network THROWS rather than resolving. It must not fall through to the
  // caller's catch: that sets a form-level error for a product the server actually saved.
  it.each([
    ['create', () => createWithPhoto(), onProductCreated],
    ['edit', () => editWithPhoto(), onProductUpdated],
  ])('%s: reports a THROWN upload failure the same way', async (_label, run, done) => {
    bulk.mockRejectedValueOnce(new ApiError(413, 'Request body too large'));

    await run();

    expect(onImageUploadFailed).toHaveBeenCalledWith('Request body too large');
    expect(done).toHaveBeenCalledTimes(1);
    expect(setError).not.toHaveBeenCalled();
  });

  // `null` and not a client-authored sentence: the caller owns the translated generic, so the two
  // cases stay distinguishable — a reason the server gave, and no reason at all.
  it('passes null when the server described nothing', async () => {
    bulk.mockResolvedValueOnce({ success: false, message: '   ', errors: [] });

    await createWithPhoto();

    expect(onImageUploadFailed).toHaveBeenCalledWith(null);
  });

  it('does not call the upload endpoint at all when no photo is staged', async () => {
    await submitEditProductForm({
      data: itemFormData() as never,
      product: { id: 'product-1' },
      imageFiles: [],
      detailedIngredients: [],
      setIsSubmitting: () => {},
      setError,
      onProductUpdated,
      onClose: () => {},
      fallbackMessage: 'translated fallback',
      onImageUploadFailed,
    });

    expect(bulk).not.toHaveBeenCalled();
    expect(onImageUploadFailed).not.toHaveBeenCalled();
  });
});

// The round trip the S2 slice has to prove: what the LIBRARY PICKER put on an ingredient is still
// on the ingredient that reaches the write endpoint. Everything between the two is the payload
// builder, and it rebuilds the ingredient list twice (provenance, then the temp-id strip, then a
// translation clean) — three chances to drop a field the form never renders.
describe('a picked library row survives the save', () => {
  const pickedIngredient = {
    // What `toProductIngredient` mints for a row the server has never seen.
    id: 'temp-1735000000000-abc123',
    name: 'Mozzarella',
    isOptional: false,
    maxQuantity: 1,
    price: 0,
    isActive: true,
    displayOrder: 0,
    globalIngredientId: 'g-mozza',
    content: { en: { name: 'Mozzarella' }, fr: { name: 'Mozzarelle' } },
  };

  const saveWith = async (detailedIngredients: unknown[]) => {
    await submitEditProductForm({
      data: itemFormData() as never,
      product: { id: 'product-1' },
      imageFiles: [],
      detailedIngredients: detailedIngredients as never,
      setIsSubmitting: () => {},
      setError,
      onProductUpdated,
      onClose: () => {},
      fallbackMessage: 'translated fallback',
      onImageUploadFailed,
    });

    expect(setError).not.toHaveBeenCalled();
    const [, payload] = (updateProduct as jest.Mock).mock.calls[0];
    return payload.detailedIngredients as Record<string, unknown>[];
  };

  it('reaches PUT /api/Products still carrying its globalIngredientId', async () => {
    const sent = await saveWith([pickedIngredient]);

    expect(sent).toHaveLength(1);
    expect(sent[0].globalIngredientId).toBe('g-mozza');
    expect(sent[0].name).toBe('Mozzarella');
  });

  // A supplied id means "update the row I already own" to ProductIngredientSynchronizer, and an id
  // it does not own is skipped with a warning — so the temp id must be gone while the provenance,
  // which the backend DOES accept on a create, must not be.
  it('arrives without the temp id the editor minted for it', async () => {
    const sent = await saveWith([pickedIngredient]);

    expect(sent[0].id).toBeUndefined();
    expect(sent[0].globalIngredientId).toBe('g-mozza');
  });

  it('keeps the translations the catalog handed over', async () => {
    const sent = await saveWith([pickedIngredient]);

    expect(sent[0].content).toEqual({ en: { name: 'Mozzarella' }, fr: { name: 'Mozzarelle' } });
  });

  // The saving that makes the picker worth building: a row that already knows where it came from
  // costs ZERO round trips per save. A typed-by-hand ingredient used to cost one search — and,
  // before this slice, one search on every save for the rest of the product's life.
  it('is not searched for or re-created, because it already knows its origin', async () => {
    await saveWith([pickedIngredient]);

    expect(searchGlobalIngredients).not.toHaveBeenCalled();
    expect(createGlobalIngredient).not.toHaveBeenCalled();
  });

  // The defect this slice fixes, seen from the payload rather than from the unit: an ingredient
  // typed by hand with no translations used to come back with no id, forever.
  it('links a translation-less ingredient typed by hand, instead of leaving it anonymous', async () => {
    (createGlobalIngredient as jest.Mock).mockResolvedValueOnce({ success: true, data: { id: 'g-new' } });

    const sent = await saveWith([{ id: 'temp-9', name: 'Truffle Oil', price: 0, isActive: true, displayOrder: 1 }]);

    // A row typed with no group of its own resolves to `ingredient` (slice G1) — `undefined` must
    // not reach the wire, where the API has no meaning for a third state.
    expect(createGlobalIngredient).toHaveBeenCalledWith({
      defaultName: 'Truffle Oil',
      translations: [],
      kind: 'ingredient',
    });
    expect(sent[0].globalIngredientId).toBe('g-new');
  });
});
