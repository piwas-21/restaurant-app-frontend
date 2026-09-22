import { throwServerRefusal } from '@/utils/apiFormErrors';
import { apiClient } from '@/utils/apiClient';
import type { ServerFloorSnapshot, ServerFloorSnapshotApiResponse } from '@/types/serverWorkspace';

const FLOOR_ENDPOINT = '/api/staff/server-workspace/floor';

/** Read one repeatable-read floor snapshot; the backend owns all table/session state decisions. */
export async function getServerFloorSnapshot(): Promise<ServerFloorSnapshot> {
  const response = await apiClient.get<ServerFloorSnapshotApiResponse>(FLOOR_ENDPOINT, { requireAuth: true });
  if (response.success !== true || response.data === undefined || response.data === null) {
    throwServerRefusal(response);
  }
  return response.data;
}

export { FLOOR_ENDPOINT };
