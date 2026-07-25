import { apiClient } from '@/utils/apiClient';
import type { ApiResponse } from '@/types/reservation';
import type { FloorPlanDocument } from '@/types/floorPlan';
import { isLocalId } from '@/lib/floorPlan/itemPlacement';

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

/** Drop a client-minted id, keep a server one. `JSON.stringify` omits undefined. */
const withoutLocalId = <T extends { id?: string }>(entity: T): T =>
  entity.id && isLocalId(entity.id) ? { ...entity, id: undefined } : entity;

/**
 * The document as the API takes it. Anything the editor created carries a
 * **client-minted id** (`local-item-N`), and *every* `Id` on the document DTOs —
 * `FloorPlanItemDto`, `FloorPlanWallDto`, `FloorPlanOpeningDto` — is a `Guid?`.
 * Sending one back is therefore a **model-binding 400, not a new object**, which
 * the UI can only report as "could not save".
 *
 * The server ignores these ids regardless (a save replaces walls, openings and
 * items wholesale and re-mints them), so a locally created object goes up with no
 * id at all — the "new object" shape the DTOs document.
 *
 * **Every id-bearing collection is stripped, not just the one that has bitten us.**
 * Items are all the editor can create today; the wall tool (S7) will mint wall and
 * opening ids into the same trap, and `floorPlanService.test.ts` fails if any
 * `local-` id survives into a payload.
 */
const toWirePayload = (document: FloorPlanDocument): FloorPlanDocument => ({
  ...document,
  items: document.items.map(withoutLocalId),
  walls: document.walls.map((wall) => ({
    ...withoutLocalId(wall),
    openings: wall.openings.map(withoutLocalId),
  })),
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
