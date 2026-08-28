'use client';

import { useCallback, useState } from 'react';
import { useForm, type FieldValues, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { quickAddItemSchema, type QuickAddItemFormData } from '@/components/admin/product/schemas';
import { submitProductForm } from '@/components/admin/product/productFormUtils';
import { buildQuickAddItemPayload } from '@/utils/quickAddItemPayload';
import { reportProductImageUploadFailure } from '@/utils/productImageFailure';
import { useEditorCategories } from './useEditorCategories';

/** What to do once the row exists: land on its editor, or stay and type the next one (D3). */
export type QuickAddOutcome = 'open' | 'again';

interface UseQuickAddItemOptions {
  /** `Save and open` — the id of the row that now exists, so the caller can navigate to it. */
  onCreated: (productId: string) => void;
  /** `Save and add another` — the modal stays; the list behind it is now stale. */
  onAddedAnother: () => void;
}

/** Frozen so the identity is stable: the editor's staged-photo path does not exist here (D3). */
const NO_IMAGE_FILES: File[] = [];

/**
 * The quick-add create form (MENU-ITEM-EDITOR-REDESIGN-PLAN, slice S3 / decision D3).
 *
 * Three questions — name, price, category — then a POST and the item's own edit page, which is
 * where photos become possible at all. It is deliberately NOT a second create implementation:
 *
 * - the resolver is `quickAddItemSchema`, `.pick()`ed from `createProductSchema`, so every bound
 *   and every message is the full editor's own (see `schemas.ts`);
 * - the payload is built by `buildQuickAddItemPayload`, which fills every field the modal does not
 *   ask for from the create route's own defaults and re-parses the result through the full create
 *   schema;
 * - the write is `submitProductForm`, the same function the editor's create submit called —
 *   including its global-ingredient reconciliation, its `content` seeding for the admin's current
 *   language, and its error mapping.
 *
 * One select drives two fields. The full editor asks for categories (chips) and then a primary one;
 * a single-category item makes those the same answer, so choosing "Pizzas" here sets `categoryIds`
 * AND `primaryCategoryId`. Both are real fields of the full editor — nothing new is invented, which
 * is the strict-subset rule D3 exists to keep.
 */
export function useQuickAddItem({ onCreated, onAddedAnother }: UseQuickAddItemOptions) {
  const { t, i18n } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The same hook, and the same failure sentence, the editor's category chips use.
  const { categories, categoriesError } = useEditorCategories(false);

  const form = useForm<FieldValues>({
    resolver: zodResolver(quickAddItemSchema as never) as Resolver<FieldValues>,
    // `basePrice: ''` and not 0: the approved screen shows an empty box with a `0.00` placeholder,
    // and `z.coerce.number()` reads '' as 0 — the very default `toItemDefaults` seeds. An admin who
    // never touches the price therefore creates exactly the row the full editor would have.
    defaultValues: { name: '', basePrice: '', categoryIds: [], primaryCategoryId: '' },
  });

  const { formState, setValue, watch } = form;
  const selectedCategoryId = (watch('primaryCategoryId') as string | undefined) ?? '';

  const selectCategory = useCallback(
    (categoryId: string) => {
      // Re-validate only once the admin has been shown an error, which is react-hook-form's own
      // `reValidateMode` rule — a first-touch error on a field nobody has submitted is noise.
      const shouldValidate = formState.isSubmitted;
      setValue('categoryIds', categoryId ? [categoryId] : [], { shouldValidate });
      setValue('primaryCategoryId', categoryId, { shouldValidate });
    },
    [setValue, formState.isSubmitted],
  );

  const save = (outcome: QuickAddOutcome) =>
    form.handleSubmit(async (values) => {
      await submitProductForm({
        data: buildQuickAddItemPayload(values as QuickAddItemFormData),
        imageFiles: NO_IMAGE_FILES,
        currentLanguage: i18n.language || 'en',
        detailedIngredients: [],
        // 'creating' | 'uploading' | 'idle' collapses to a boolean: there is nothing to upload.
        setSubmissionStatus: (status) => setIsSubmitting(status !== 'idle'),
        setError: form.setError as never,
        onProductCreated: (productId: string) => {
          if (outcome === 'open') {
            onCreated(productId);
            return;
          }
          onAddedAnother();
          // The modal stays open and empty (D3: menu entry is a batch task), so the caret has to
          // go back to the first field or every subsequent row starts with a mouse click.
          setTimeout(() => form.setFocus('name'), 0);
        },
        onClose: () => {},
        reset: form.reset as never,
        setImageFiles: () => {},
        fallbackMessage: t('unexpected_error', 'An unexpected error occurred.'),
        // Unreachable while `NO_IMAGE_FILES` is empty — required, and wired to the real reporter
        // rather than to a no-op, so it stays correct if this path ever stages a photo.
        onImageUploadFailed: (reason) => reportProductImageUploadFailure(t, 'create', reason),
      });
    });

  return {
    form,
    errors: formState.errors,
    categories,
    categoriesError,
    selectedCategoryId,
    selectCategory,
    isSubmitting,
    saveAndOpen: save('open'),
    saveAndAddAnother: save('again'),
  };
}

export default useQuickAddItem;
