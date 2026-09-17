import { apiClient } from '@/utils/apiClient';

/** The narrow relationship write intentionally does not replace menu sections. */
export interface OfferParentLink {
  parentOfferProductId: string;
  parentOfferVariationId?: string | null;
}

export interface OfferParentLinkResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Links an existing menu bundle to its commercial parent.
 *
 * API contract: `PATCH /api/Menus/{menuId}/offer-parent` accepts only the two parent ids; the URL
 * supplies the menu id. Keeping this in one service makes the eventual backend route change local and,
 * more importantly, prevents the migration UI from using the full bundle PUT.
 */
export async function linkMenuOffer(menuId: string, parent: OfferParentLink): Promise<OfferParentLinkResponse> {
  return (await apiClient.patch(`/api/Menus/${menuId}/offer-parent`, parent)) as OfferParentLinkResponse;
}

/** Clears presentation linkage without deleting the menu or rewriting its formula. */
export async function unlinkMenuOffer(menuId: string): Promise<OfferParentLinkResponse> {
  return (await apiClient.delete(`/api/Menus/${menuId}/offer-parent`)) as OfferParentLinkResponse;
}
