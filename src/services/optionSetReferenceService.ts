import { apiClient } from '@/utils/apiClient';
import type { MenuAuthoringApiResponse } from '@/types/menuAuthoringSearch';
import type { OptionSetKind } from '@/types/optionSet';

export interface OptionSetProductVariation {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

interface ProductVariationResponse {
  readonly isActive?: unknown;
  readonly isAvailable?: unknown;
  readonly isComponent?: unknown;
  readonly variations?: unknown;
}

interface IngredientReferenceResponse {
  readonly isActive?: unknown;
  readonly isArchived?: unknown;
  readonly kind?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function isOptionSetReferenceAvailable(kind: OptionSetKind, referenceId: string): Promise<boolean> {
  if (kind === 'ingredient' || kind === 'sauce') {
    const response = await apiClient.get<MenuAuthoringApiResponse<IngredientReferenceResponse>>(
      `/api/global-ingredients/${encodeURIComponent(referenceId)}`,
      { requireAuth: true },
    );
    const ingredient = response.data;
    const expectedKind = kind === 'sauce' ? 'sauce' : 'ingredient';
    return (
      response.success === true &&
      ingredient?.isActive === true &&
      ingredient.isArchived !== true &&
      (ingredient.kind === undefined || ingredient.kind === expectedKind)
    );
  }

  const response = await apiClient.get<MenuAuthoringApiResponse<ProductVariationResponse>>(
    `/api/Products/${encodeURIComponent(referenceId)}`,
    { requireAuth: true },
  );
  const product = response.data;
  return (
    response.success === true &&
    product?.isActive === true &&
    product.isAvailable === true &&
    (kind !== 'suggestedSide' || product.isComponent !== true)
  );
}

export async function getOptionSetProductVariations(
  productId: string,
  signal?: AbortSignal,
): Promise<OptionSetProductVariation[]> {
  const options = { requireAuth: true, ...(signal ? { signal } : {}) };
  const response = await apiClient.get<MenuAuthoringApiResponse<ProductVariationResponse>>(
    `/api/Products/${encodeURIComponent(productId)}`,
    options,
  );
  if (!response.success || !response.data) throw new Error(response.message || 'Product variations unavailable');
  const rows = response.data.variations;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!isRecord(row) || typeof row.id !== 'string' || typeof row.name !== 'string') return [];
    return [{ id: row.id, name: row.name, isActive: row.isActive === true }];
  });
}
