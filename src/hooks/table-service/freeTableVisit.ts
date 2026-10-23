import {
  closeTableServiceSession,
  getTableServiceSession,
  releaseTableServiceSession,
} from '@/services/tableServiceSessionService';
import type { TableServiceSessionDto } from '@/types/order';

/** Release occupancy first; finalizing a settled bill must never undo a committed release. */
export async function freeTableVisit(
  serviceSessionId: string,
  expectedVersion: number,
): Promise<TableServiceSessionDto> {
  const released = await releaseTableServiceSession(serviceSessionId, { expectedVersion, markReady: true });
  if (released.status !== 'Open' || !released.isTableReleased || !released.canClose) return released;
  try {
    return await closeTableServiceSession(serviceSessionId, { expectedVersion: released.version });
  } catch (_reason: unknown) {
    // CanClose is a projection. The close endpoint rechecks pending payment/kitchen evidence.
    // On refusal or lost response, keep the released bill accessible and read its actual state.
    try {
      return await getTableServiceSession(serviceSessionId);
    } catch (_refreshReason: unknown) {
      return released;
    }
  }
}
