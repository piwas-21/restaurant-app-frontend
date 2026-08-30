import { UseFormSetError, UseFormReset } from 'react-hook-form';
import { FormData, EditFormData } from './schemas';
import { createProduct } from '@/services/menuService';
import { createMenuBundle, updateMenuBundle } from '@/services/menuBundleService';
import { updateProduct, uploadBulkProductImages } from '@/services/productService';
import { withGlobalIngredientProvenance, withoutTemporaryIds } from './globalIngredientReconciliation';
import { serverMessage } from '@/utils/apiFormErrors';

/**
 * Told when the product itself was written but its staged photos were NOT stored. It receives the
 * SERVER's reason (`null` when the server authored none), never a sentence — this module has no
 * `t`, and the sentence is the caller's to translate (`utils/productImageFailure.ts`).
 *
 * REQUIRED, like the categories' `onPartialSuccess` and for the same reason: an optional reporter
 * is one a future caller drops silently, and a dropped one is exactly the defect this closes —
 * RUMI's compressed photos were refused by the backend for weeks while the editor said nothing
 * (Track F / F1b; the reason was `console.error`ed on create and discarded outright on edit).
 */
type ImageUploadFailureReporter = (reason: string | null) => void;

interface SubmitProductFormParams {
  data: FormData;
  imageFiles: File[];
  currentLanguage: string;
  detailedIngredients?: any[];
  setSubmissionStatus: (status: 'idle' | 'creating' | 'uploading') => void;
  setError: UseFormSetError<FormData>;
  /** Receives the NEW id: quick-add (D3) lands the admin on the item's own edit page. */
  onProductCreated: (productId: string) => void;
  onClose: () => void;
  reset: UseFormReset<FormData>;
  setImageFiles: (files: File[]) => void;
  /**
   * Already-translated sentence for a failure the server did not describe. Threaded in rather
   * than resolved here (the CartContext pattern): this module is a plain util with no `t`, and
   * the two literals it used to hold — 'An unexpected error occurred.' and 'Failed to create
   * product' — were the English a non-English admin actually read.
   */
  fallbackMessage: string;
  /** The product was written, its photos were not — see `uploadStagedImages`. */
  onImageUploadFailed: ImageUploadFailureReporter;
}

interface SubmitEditProductFormParams {
  data: EditFormData;
  product: any;
  imageFiles: File[];
  detailedIngredients?: any[];
  setIsSubmitting: (status: boolean) => void;
  setError: UseFormSetError<EditFormData>;
  onProductUpdated: () => void;
  onClose: () => void;
  /** @see SubmitProductFormParams.fallbackMessage — same contract, same reason. */
  fallbackMessage: string;
  /** The product was written, its photos were not — see `uploadStagedImages`. */
  onImageUploadFailed: ImageUploadFailureReporter;
}

type MenuDefinitionInput = NonNullable<FormData['menuDefinition']>;

/**
 * The create/update wire shape for a bundle's menu definition. Extracted from the two byte-identical
 * copies that sat in `submitProductForm` and `submitEditProductForm` (menu-bundles redesign #176,
 * slice 7) — behaviour-identical to both, including the two quirks below, which are preserved rather
 * than reconciled: changing either is a behaviour change, not a move (slice-3 precedent).
 *
 * 1. It strips the SECTION id only — nested item ids pass through untouched. Nothing is broken
 *    today because both bundle modals pre-strip via `stripTemporaryMenuSectionIds`
 *    (src/utils/menuSectionDraft.ts), which handles items too. But a `temp-…` item id is NOT
 *    ignored server-side: `MenuSectionItemDto.Id` is `Guid?`, so STJ fails the conversion and the
 *    request 400s. The unified editor page (PR2d) must pre-strip the same way, or adopt that util
 *    here — this is the landmine that fires if it calls this write path directly.
 * 2. The `section.id === ''` arm is unreachable — `section.id &&` already short-circuits on ''.
 *    An empty-string id therefore survives as '' rather than becoming null.
 *
 * The ':00' padding is load-bearing: `MenuDefinitionDto.StartTime/EndTime` are `TimeSpan?`, which
 * STJ will not parse from the "HH:mm" that `MenuScheduleEditor`'s `<input type="time">` emits.
 */
const toMenuDefinitionPayload = (menuDefinition: MenuDefinitionInput | undefined) => {
  if (!menuDefinition) return undefined;

  const padTime = (time: string | null | undefined) => {
    if (!time) return null;
    return time.length === 5 ? `${time}:00` : time;
  };

  return {
    ...menuDefinition,
    id: menuDefinition.id || null,
    sections:
      menuDefinition.sections?.map((section) => ({
        ...section,
        id: section.id && (section.id.startsWith('temp-') || section.id === '') ? null : section.id,
      })) || [],
    startTime: padTime(menuDefinition.startTime),
    endTime: padTime(menuDefinition.endTime),
  };
};

/**
 * Sends `{}` rather than omitting `content`, mirroring what MenuBundleDetails already sends
 * (`product.content || {}`). The form yields `undefined` once every language row is removed.
 *
 * This comment used to justify that by an asymmetry between the two update commands — that
 * UpdateMenuBundleCommand took `Content` non-null and enumerated it after an UNCONDITIONAL
 * `RemoveRange(product.Descriptions)`, so `{}` meant "delete every description" on the bundle path
 * where it meant "change nothing" on the product path. **That is no longer true, and was already
 * untrue when it was written**: backend #190 gave the bundle handler both guards, and on `main` and
 * `develop` alike it now reads `var contentMap = command.Content ?? new ProductDescriptionsDto();`
 * followed by `if (contentMap.Any()) { RemoveRange(...) }` — verified in both refs, not inferred.
 *
 * So `{}` is neutral on both paths and this call is now belt-and-braces rather than load-bearing.
 * Kept because it matches the sibling caller and costs nothing; do not re-derive a contract from
 * the claim above.
 */
const toMenuBundlePayload = <T extends { content?: unknown }>(productData: T) => ({
  ...productData,
  content: productData.content ?? {},
});

const isBlank = (value: string | null | undefined) => !(value ?? '').trim();

/** One language's entry in a nested `content` map — both fields optional, per `variationSchema`. */
type TranslationEntry = { name?: string | null; description?: string | null };

/**
 * Drops the translation entries the admin never touched — `name` AND `description` both blank —
 * from a nested `content` map.
 *
 * The editor sends a lot of those. `ProductVariations.tsx` registers a name and a description input
 * for EVERY supported language on every variation, inside a `<details>` that hides its children
 * without unmounting them, so all ten register whether or not the panel is ever opened;
 * `ProductIngredientsManager.tsx` seeds seven blank entries on every newly added ingredient. Both
 * reached the API verbatim — measured, not read — and the backend dropped them with an unstated
 * handler guard. Backend #323 replaces that guard with a 400, so they have to stop being sent.
 *
 * It filters on TOUCHED rather than on a blank name, and that difference is the whole point: the
 * variation panel has a description input as well as a name one, and `variationSchema.content`
 * declares both optional, so `{name: '', description: 'Grande portion'}` is a shape an admin can
 * really type and the resolver will pass. Dropping it here would move #323's silent discard from
 * the server to the client. It is sent instead, so that once #323 lands the server refuses it by
 * name — today, still, the server silently skips it, which is the defect #323 is open on.
 *
 * The `!entry` arm keeps a null entry rather than swallowing it, and exists mainly so this function
 * cannot itself throw on one. It is unpinned by tests on purpose: `variationSchema.content` refuses
 * a null value, and although `detailedIngredients` bypass Zod, the global-ingredient prefetch below
 * dereferences `(content as any).name` on every entry and throws on a null before this runs — a
 * pre-existing trap, measured, not fixed here.
 */
const withoutUntouchedTranslations = <T extends { name?: string | null; description?: string | null }>(
  content: Record<string, T> | null | undefined,
): Record<string, T> | undefined => {
  if (!content) return undefined;
  return Object.fromEntries(
    Object.entries(content).filter(([, entry]) => !entry || !(isBlank(entry.name) && isBlank(entry.description))),
  ) as Record<string, T>;
};

/** Applies {@link withoutUntouchedTranslations} to each item's `content`, leaving the rest alone. */
const withCleanedItemTranslations = <T extends { content?: unknown }>(items: T[]): T[] =>
  items.map((item) =>
    item?.content
      ? { ...item, content: withoutUntouchedTranslations(item.content as Record<string, TranslationEntry>) }
      : item,
  );

/**
 * Upload the staged photos for a product that is ALREADY WRITTEN, reporting a failure as a partial
 * success rather than as a failed save.
 *
 * Every branch here used to be silent. The bulk endpoint answers a total rejection with HTTP 200
 * and `success: false` — it is not a throw — and the create path `console.error`ed that while the
 * edit path did not even bind the response, so an admin whose photo was refused (`File 'blob' has
 * invalid extension`, every compressed photo until frontend #525) read a plain success.
 *
 * Three shapes are treated as one failure, deliberately:
 *   - `success: false` — the whole batch was refused;
 *   - `success: true` WITH a non-empty `errors[]` — a partial batch, where saying nothing would
 *     claim photos that are not there. This is also why the check is not `!success` alone: the
 *     handler reports "Uploaded 1 images. 1 failed." as a success;
 *   - a THROW — a 401/413/502 or a dead network never reaches the resolved branch at all. It must
 *     not fall through to the caller's catch either: that sets a form-level error for a product
 *     that WAS saved, and on create leaves the admin on a form whose next Save makes a duplicate.
 *
 * The failure never rolls the product back and never blocks the flow — the write succeeded, and the
 * photos are re-uploadable from the editor's gallery.
 */
const uploadStagedImages = async (
  productId: string,
  imageFiles: File[],
  onImageUploadFailed: ImageUploadFailureReporter,
): Promise<void> => {
  try {
    const response = (await uploadBulkProductImages(productId, imageFiles)) as {
      success: boolean;
      message?: string;
      // Where the per-file cause lives — `serverMessage` prefers it over the `"Operation failed"`
      // default that `message` carries.
      errors?: unknown;
    };
    const reasons = Array.isArray(response.errors)
      ? response.errors.filter((reason): reason is string => typeof reason === 'string' && reason.trim().length > 0)
      : [];
    if (!response.success) {
      onImageUploadFailed(serverMessage(response));
    } else if (reasons.length > 0) {
      // A PARTIAL upload arrives as `success: true`, and `serverMessage` reads `errors[]` only on a
      // DECLARED failure (`asResolvedFailure` requires `success === false`) — so it answers null
      // here and the per-file reason has to be taken directly. `'; '` is its own separator, so the
      // two paths render one server's `errors[]` the same way.
      onImageUploadFailed(reasons.join('; '));
    }
  } catch (error: unknown) {
    console.error('Image upload failed:', error);
    onImageUploadFailed(serverMessage(error));
  }
};

export const submitProductForm = async ({
  data,
  imageFiles,
  currentLanguage,
  detailedIngredients,
  setSubmissionStatus,
  setError,
  onProductCreated,
  onClose,
  reset,
  setImageFiles,
  fallbackMessage,
  onImageUploadFailed,
}: SubmitProductFormParams) => {
  setSubmissionStatus('creating');
  try {
    // Format content for the API
    const content: { [key: string]: { name: string; description: string } } = {};

    // Automatically add the main product data to content using the current user language
    content[currentLanguage] = {
      name: data.name,
      description: data.description || '',
    };

    // Add any additional multilingual content. The name test mirrors the update path's existing
    // filter rather than the "touched" test the NESTED maps use below, and the asymmetry is
    // deliberate: `contentSchema.name` is `min(1)` (schemas.ts), so the resolver already refuses a
    // blank-named top-level row before submit and there is no description-only row to preserve.
    //
    // What it does still catch is a WHITESPACE-only name, which `min(1)` counts as three characters.
    // Backend #323 does NOT refuse that — it deliberately leaves the top-level rule permissive — so
    // this is not about avoiding a 400. It is about not persisting a row that is then lost silently:
    // the row stores fine, the update path's filter omits it from the NEXT save, and the handler's
    // `if (contentMap.Any()) RemoveRange(...)` full replace deletes it, description text and all.
    // Create used to create exactly that row; now the two paths agree.
    data.content?.forEach((item) => {
      if (item.language && item.language !== currentLanguage && item.name?.trim()) {
        content[item.language] = {
          name: item.name,
          description: item.description || '',
        };
      }
    });

    // Provenance + temp-id strip, shared with the edit path below.
    const cleanedIngredients = withoutTemporaryIds(await withGlobalIngredientProvenance(detailedIngredients || []));

    // Format the product data
    const productData = {
      ...data,
      content,
      // `?? ''` because the schema now accepts the `null` the API sends for an absent optional text
      // (`optionalText`, schemas.ts) — the CREATE contract takes `string | undefined`, and the edit
      // path below already coalesces the same field the same way.
      description: data.description ?? '',
      primaryCategoryId: data.primaryCategoryId || null,
      // Same coalesce as the product description above, per row: the create contract's
      // `VariationData.description` is `string | undefined`, and the schema now lets the API's
      // `null` through untouched.
      variations: withCleanedItemTranslations(data.variations || []).map((variation) => ({
        ...variation,
        description: variation.description ?? '',
      })),
      detailedIngredients: withCleanedItemTranslations(cleanedIngredients),
      menuDefinition: toMenuDefinitionPayload(data.menuDefinition),
    };

    let productResponse;
    if (data.menuDefinition) {
      // It's a menu bundle
      productResponse = (await createMenuBundle(productData)) as {
        success: boolean;
        data?: { id: string };
        message?: string;
      };
    } else {
      productResponse = (await createProduct(productData)) as {
        success: boolean;
        data?: { id: string };
        message?: string;
      };
    }
    if (productResponse.success && productResponse.data?.id) {
      if (imageFiles.length > 0) {
        setSubmissionStatus('uploading');
        await uploadStagedImages(productResponse.data.id, imageFiles, onImageUploadFailed);
      }
      onProductCreated(productResponse.data.id);
      onClose();
      reset();
      setImageFiles([]);
    } else {
      setError('root', { message: serverMessage(productResponse) ?? fallbackMessage });
    }
  } catch (error: unknown) {
    console.error('Submit error:', error);
    // This block used to unwrap `error.response.data` — the AXIOS error envelope — and axios is
    // not a dependency here, so its three branches (per-field errors, `title`, `message`) were all
    // dead. What ran was `error.message`, and after #401 a message-less `ApiError` skips that too,
    // landing on the hardcoded English default. `serverMessage` reads what `apiClient` throws;
    // `apiClient` has already flattened a per-field `errors` OBJECT into the array it returns.
    setError('root', { message: serverMessage(error) ?? fallbackMessage });
  } finally {
    setSubmissionStatus('idle');
  }
};

export const submitEditProductForm = async ({
  data,
  product,
  imageFiles,
  detailedIngredients,
  setIsSubmitting,
  setError,
  onProductUpdated,
  onClose,
  fallbackMessage,
  onImageUploadFailed,
}: SubmitEditProductFormParams) => {
  setIsSubmitting(true);
  try {
    const parseNum = (val: any, fallback: number): number => {
      const num = parseFloat(String(val || '').trim());
      return isNaN(num) ? fallback : num;
    };

    // Clean content array and format for API
    const cleanedContentArray = (data.content || [])
      .filter((e: any) => e?.language?.trim() && e?.name?.trim())
      .map((e: any) => ({
        language: String(e.language).trim(),
        name: String(e.name || '').trim(),
        description: (e.description ?? '').toString(),
      }));

    const formattedContent =
      cleanedContentArray.length > 0
        ? cleanedContentArray.reduce((acc: any, curr: any) => {
            acc[curr.language] = {
              name: curr.name,
              description: curr.description,
            };
            return acc;
          }, {})
        : undefined;

    const categoryIds = Array.isArray(data.categoryIds) ? (data.categoryIds.filter(Boolean) as string[]) : [];
    let primaryCategoryId = (data.primaryCategoryId || '') as string;
    if (categoryIds.length > 0 && !categoryIds.includes(primaryCategoryId)) {
      primaryCategoryId = categoryIds[0];
    }

    const cleanedVariations = (data.variations || [])
      .filter((v) => (v?.name || '').trim().length > 0)
      .map((v) => ({
        id: v.id,
        // Carried through deliberately. This map is a WHITELIST, so anything it does not name is
        // dropped on the way to the wire — and `globalVariationId` is a value the API SENDS
        // (`ProductVariationDto`, backend #431) and `productEditorDefaults` seeds straight into the
        // form. Omitting it here is #428's shape on a different field: a PUT that omits a field
        // must not write that field, and this one wrote null on every save of a linked product.
        globalVariationId: v.globalVariationId,
        name: (v.name || '').trim(),
        description: v.description ?? '',
        priceModifier: parseNum(v.priceModifier, 0),
        isActive: v.isActive ?? true,
        displayOrder: Number.isInteger(v.displayOrder as any) ? (v.displayOrder as any) : 0,
        content: withoutUntouchedTranslations(v.content as Record<string, TranslationEntry>),
      }));

    // Provenance + temp-id strip, shared with the create path above.
    const cleanedIngredients = withoutTemporaryIds(await withGlobalIngredientProvenance(detailedIngredients || []));
    const productData = {
      ...data,
      id: product.id,
      name: (data.name || '').trim(),
      description: (data.description ?? '').toString(),
      basePrice: parseNum(data.basePrice, 0),
      preparationTimeMinutes:
        typeof data.preparationTimeMinutes === 'number'
          ? data.preparationTimeMinutes
          : parseInt(String(data.preparationTimeMinutes || '0'), 10) || 0,
      allergens: Array.isArray(data.allergens) ? data.allergens.filter(Boolean) : [],

      categoryIds: categoryIds || [],
      primaryCategoryId: primaryCategoryId || null,
      variations: cleanedVariations,
      content: formattedContent,
      detailedIngredients: withCleanedItemTranslations(cleanedIngredients),
      menuDefinition: toMenuDefinitionPayload(data.menuDefinition),
    } as any;

    // A bundle must be updated through the bundle endpoint, mirroring the create path above.
    // PUT /api/Products requires at least one category (UpdateProductCommandValidator), which a
    // bundle can never satisfy: editMenuBundleSchema has no category field and MenuBundleDto
    // carries none, so this always sent categoryIds: [] and every bundle edit failed with
    // "At least one category is required". PUT /api/Menus takes CategoryIds as optional.
    const response = (await (data.menuDefinition
      ? updateMenuBundle(product.id, toMenuBundlePayload(productData))
      : updateProduct(product.id, productData))) as {
      success: boolean;
      message?: string;
      // `errors` is what `serverMessage` reads below — the backend's one-arg
      // `ApiResponse.Failure("<reason>")` puts the reason there and leaves `message` at
      // "Operation failed". A cast that omitted it told the next reader it was not there.
      errors?: unknown;
    };
    if (response.success) {
      if (imageFiles.length > 0) {
        await uploadStagedImages(product.id, imageFiles, onImageUploadFailed);
      }
      onProductUpdated();
      onClose();
    } else {
      setError('root', { message: serverMessage(response) ?? fallbackMessage });
    }
  } catch (error: unknown) {
    // Was `} catch {` — the error object discarded entirely, then a hardcoded English sentence.
    // Bound here rather than left for the slice that owns this file, because the create path 150
    // lines up sets the SAME `root` error and leaving one of the pair converted is worse than
    // leaving both.
    console.error('Edit submit error:', error);
    setError('root', { message: serverMessage(error) ?? fallbackMessage });
  } finally {
    setIsSubmitting(false);
  }
};
