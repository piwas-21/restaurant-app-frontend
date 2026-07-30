import { apiClient } from '@/utils/apiClient';
import type { ApiResponse } from '@/types/order';
import type { SetupChecklistDto } from '@/types/setupChecklist';

/** First-run setup checklist (SOFRA-ONBOARDING-PLAN O4). Admin only, throughout. */
const BASE = '/api/admin/setup-checklist';

export const getSetupChecklist = async () => apiClient.get<ApiResponse<SetupChecklistDto>>(BASE, { requireAuth: true });

/**
 * Mark a step done, or undo it.
 *
 * Carries the desired state rather than toggling, so a request retried after a flaky
 * connection lands on the same answer instead of flipping back. The API answers 400 for
 * a DERIVED step (`menu`, `staff`) — those are done when the data says so, and cannot
 * be asserted.
 */
export const setSetupStepDone = async (key: string, isDone: boolean) =>
  apiClient.put<ApiResponse<boolean>>(`${BASE}/steps/${encodeURIComponent(key)}`, { isDone }, { requireAuth: true });

/** Hide the checklist, or bring it back. Reversible — it is resumable. */
export const setSetupChecklistDismissed = async (isDismissed: boolean) =>
  apiClient.put<ApiResponse<boolean>>(`${BASE}/dismissed`, { isDismissed }, { requireAuth: true });
