'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
}

export interface EditCategoryValues {
  name: string;
  description?: string;
  isActive: boolean;
  displayOrder: number;
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
  const save = async (values: EditCategoryValues, imageFile?: File): Promise<boolean> => {
    if (!category) return false;

    setIsSubmitting(true);
    const updateFailed = t('category_update_failed', 'Failed to update the category');
    // Steps that failed AFTER the details were saved; reported through the page on close.
    const partial: string[] = [];

    try {
      const updateData = {
        id: category.id,
        name: values.name,
        description: values.description,
        isActive: values.isActive,
        // Echoed back unchanged, NOT edited here. `UpdateCategoryCommand` is a full-replace PUT
        // that assigns AvailableOrderTypes unconditionally, so omitting it would clear the
        // category's channel restriction on every unrelated rename (plan §9.1). The channel
        // matrix in restaurant settings stays the only writer.
        availableOrderTypes: category.availableOrderTypes ?? null,
      };
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
