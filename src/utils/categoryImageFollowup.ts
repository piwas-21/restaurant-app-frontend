import { uploadCategoryImage } from '@/services/categoryService';
import type { CategoryApiResponse } from '@/lib/categoryFormErrors';

type TranslateFallback = (key: string, fallback: string) => string;

/** A successful create response without an id cannot truthfully count as a successful image save. */
export async function uploadCreatedCategoryImage(
  categoryId: string | undefined,
  imageFile: File | undefined,
  translate: TranslateFallback,
): Promise<CategoryApiResponse> {
  if (!imageFile) return { success: true };
  if (!categoryId) {
    return { success: false, errors: [translate('category_image_no_id', 'the new category could not be identified')] };
  }
  return (await uploadCategoryImage(categoryId, imageFile)) as CategoryApiResponse;
}
