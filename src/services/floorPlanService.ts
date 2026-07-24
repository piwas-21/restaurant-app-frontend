import { apiClient } from '@/utils/apiClient';
import type { ApiResponse } from '@/types/reservation';
import type { FloorPlanDocument } from '@/types/floorPlan';

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
 * Admin only — save the whole document. The client echoes the `updatedAt` it
 * loaded; a stale value is rejected server-side with a 409.
 */
export const saveFloorPlan = async (
  id: string,
  document: FloorPlanDocument,
): Promise<ApiResponse<FloorPlanDocument>> => {
  return apiClient.put<ApiResponse<FloorPlanDocument>>(`${BASE}/${id}`, document, {
    requireAuth: true,
  });
};
