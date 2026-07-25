import { apiClient } from '@/utils/apiClient';
import type { ApiResponse } from '@/types/reservation';
import type { FloorPlanDocument } from '@/types/floorPlan';
import { isLocalItemId } from '@/lib/floorPlan/palette';

/**
 * Floor-plan document API (FLOOR-PLAN-REVAMP §5.2). `GET` is the anonymous
 * payload the guest map renders; `PUT` is the admin whole-document save with
 * optimistic concurrency on `updatedAt`. Table create/delete/QR stay on the
 * `/api/tables` endpoints — this seam only touches plan geometry.
 */
const BASE = '/api/floorplan';

/** Public read — the default plan the guest map renders. */
export const getFloorPlan = async (): Promise<ApiResponse<FloorPlanDocument>> => {
  return apiClient.get<ApiResponse<FloorPlanDocument>>(BASE);
};

/**
 * The document as the API takes it. An item the editor placed carries a
 * **client-minted id** (`local-item-N`), and `FloorPlanItemDto.Id` is a `Guid?` —
 * so sending one back is a model-binding 400, not a new item. The server ignores
 * item ids regardless (a save replaces walls and items wholesale and re-mints
 * them), so a locally placed item goes up with no id at all. `JSON.stringify`
 * drops the undefined, which is exactly the "new item" shape the DTO documents.
 */
const toWirePayload = (document: FloorPlanDocument): FloorPlanDocument => ({
  ...document,
  items: document.items.map((item) => (item.id && isLocalItemId(item.id) ? { ...item, id: undefined } : item)),
});

/**
 * Admin only — save the whole document. The client echoes the `updatedAt` it
 * loaded; a stale value is rejected server-side with a 409.
 */
export const saveFloorPlan = async (
  id: string,
  document: FloorPlanDocument,
): Promise<ApiResponse<FloorPlanDocument>> => {
  return apiClient.put<ApiResponse<FloorPlanDocument>>(`${BASE}/${id}`, toWirePayload(document), {
    requireAuth: true,
  });
};
