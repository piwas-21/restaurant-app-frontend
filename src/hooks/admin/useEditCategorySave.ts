'use client';

import { useState } from 'react';
import { omitNewBlankCategoryTranslations, type CategoryTranslations } from '@/types/categoryTranslations';
import { useTranslation } from 'react-i18next';
import type { TranslationOwnerMetadataWrite } from '@/types/translationMetadata';
import { reorderCategory, updateCategory, uploadCategoryImage } from '@/services/categoryService';
import {
  applyCategoryFailure,
  reasonOr,
  type CategoryApiResponse,
  type SetCategoryError,
} from '@/lib/categoryFormErrors';

/** Only the fields the save reads; the modal owns the rest of the form. */
export interface EditableCategory {
  id: string;
  displayOrder: number;
  availableOrderTypes?: number | null;
  translations?: CategoryTranslations;
  sourceLocale?: string | null;
  translationMetadata?: { expectedContentVersion?: string };
}

export interface EditCategoryValues {
  name: string;
  /** `string | null` for the reason `CategoryData.description` is — the wire sends both (#642). */
  description?: string | null;
  translations?: CategoryTranslations;
  sourceLocale?: string | null;
  isActive: boolean;
  isHiddenFromAllTab: boolean;
  displayOrder: number;
}

function buildUpdateData(
  category: EditableCategory,
  values: EditCategoryValues,
  translationMetadata?: TranslationOwnerMetadataWrite,
) {
  const translations = omitNewBlankCategoryTranslations(
    values.translations ?? category.translations ?? {},
    category.translations ?? {},
  );
  const sourceLocale = values.sourceLocale !== undefined ? values.sourceLocale : category.sourceLocale;
  return {
    id: category.id,
    name: values.name,
    description: values.description,
    isActive: values.isActive,
    // The PUT replaces the whole row, so echo fields owned by other controls.
    isHiddenFromAllTab: values.isHiddenFromAllTab,
    availableOrderTypes: category.availableOrderTypes ?? null,
    ...(category.translations !== undefined || Object.keys(translations).length > 0 ? { translations } : {}),
    // A blank native select is not evidence that an omitted legacy source locale was cleared.
    ...(sourceLocale !== undefined && !(category.sourceLocale === undefined && sourceLocale === null)
      ? { sourceLocale }
      : {}),
    ...(translationMetadata ? { translationMetadata } : {}),
  };
}

/**
 * The three-request save behind `EditCategoryModal`: update, then reorder, then image.
 *
 * Extracted for the reason CLAUDE.md §4 gives — the modal was 205 LOC against a 200 limit, and the
 * overflow was the *explanation* of the E9 fixes rather than new behaviour. The alternative was
 * baselining the file, which the plan explicitly rules out ("decompose, never baseline your own
 * overflow"). `use[A-Z]*.ts` under `src/**` is itself gated at 200, so this is not a way of hiding
 * the lines somewhere the checker cannot see.
 *
 * Steps 2 and 3 are separate requests against a category that step 1 already wrote, so their
 * failures are PARTIAL successes, not failures: they accumulate and go to `onPartialSuccess`
 * instead of the form. The reasoning for that — and why the modal's own `setError('root')` could
 * never paint — is in the partial-success note in `categoryFormErrors`.
 */
export function useEditCategorySave(
  category: EditableCategory | null,
  setFormError: SetCategoryError,
  onPartialSuccess: (message: string) => void,
) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Resolves `true` when the category was written, i.e. when the modal should close. */
  const save = async (
    values: EditCategoryValues,
    imageFile?: File,
    translationMetadata?: TranslationOwnerMetadataWrite,
  ): Promise<boolean> => {
    if (!category) return false;

    setIsSubmitting(true);
    const updateFailed = t('category_update_failed', 'Failed to update the category');
    // Steps that failed AFTER the details were saved; reported through the page on close.
    const partial: string[] = [];

    try {
      const updateData = buildUpdateData(category, values, translationMetadata);
      const categoryResponse = (await updateCategory(category.id, updateData)) as CategoryApiResponse;

      if (!categoryResponse.success) {
        applyCategoryFailure(categoryResponse, updateFailed, setFormError);
        return false;
      }

      if (values.displayOrder !== category.displayOrder) {
        const reorderResponse = (await reorderCategory(category.id, values.displayOrder)) as CategoryApiResponse;
        if (!reorderResponse.success) {
          partial.push(
            t('category_updated_reorder_failed', 'Category details updated, but the reorder failed: {{reason}}', {
              reason: reasonOr(reorderResponse, t('category_reorder_failed_generic', 'the new order was rejected')),
            }),
          );
        }
      }

      if (imageFile) {
        const imageResponse = (await uploadCategoryImage(category.id, imageFile)) as CategoryApiResponse;
        if (!imageResponse.success) {
          partial.push(
            t('category_updated_image_failed', 'Category updated, but the image upload failed: {{reason}}', {
              reason: reasonOr(imageResponse, t('category_image_failed_generic', 'the image was rejected')),
            }),
          );
        }
      }

      if (partial.length > 0) onPartialSuccess(partial.join(' '));
      return true;
    } catch (err) {
      // Refusals reach here too, not just transport failures — `ValidationBehavior` throws for
      // validator failures and `[RequireAdmin]` for a stale session. See `categoryFormErrors`.
      applyCategoryFailure(err, updateFailed, setFormError);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { save, isSubmitting };
}

export default useEditCategorySave;
