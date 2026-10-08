import { ApiError, apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import { kitchenBoardCompletionResultSchema, kitchenBoardWorkFeedSchema } from '@/schemas/kitchenBoard.schema';
import type {
  CompleteKitchenBoardWorkApiResponse,
  CompleteKitchenBoardWorkRequest,
  CompleteKitchenBoardWorkResult,
  GetKitchenBoardWorkOptions,
  KitchenBoardWorkFeed,
  KitchenBoardWorkFeedApiResponse,
} from '@/types/kitchenBoard';

const WORK_ENDPOINT = '/api/staff/kitchen-board/work';
const COMPLETE_ENDPOINT = '/api/staff/kitchen-board/orders';

function requireData<T>(response: { success?: boolean; data?: T | null; message?: string }): T {
  if (response.success !== true || response.data === undefined || response.data === null) {
    throwServerRefusal(response);
  }
  return response.data;
}

function sameId(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/** Reads all three independent work streams with the exact cursors returned by the backend. */
export async function getKitchenBoardWork(options: GetKitchenBoardWorkOptions = {}): Promise<KitchenBoardWorkFeed> {
  const params = new URLSearchParams({ pageSize: String(options.pageSize ?? 100) });
  if (options.orders !== null && options.orders !== undefined) params.set('ordersCursor', options.orders);
  if (options.corrections !== null && options.corrections !== undefined)
    params.set('correctionsCursor', options.corrections);
  if (options.completions !== null && options.completions !== undefined)
    params.set('completionsCursor', options.completions);

  const response = await apiClient.get<KitchenBoardWorkFeedApiResponse>(`${WORK_ENDPOINT}?${params.toString()}`, {
    requireAuth: true,
  });
  const data = requireData(response);
  const parsed = kitchenBoardWorkFeedSchema.safeParse(data);
  if (!parsed.success) throw new ApiError(502, '', undefined, 'InvalidKitchenBoardWorkFeed');
  return parsed.data;
}

/** Acknowledges only the exact board work item and versions shown to this staff member. */
export async function completeKitchenBoardWork(
  orderId: string,
  workItemId: string,
  request: CompleteKitchenBoardWorkRequest,
): Promise<CompleteKitchenBoardWorkResult> {
  const response = await apiClient.post<CompleteKitchenBoardWorkApiResponse>(
    `${COMPLETE_ENDPOINT}/${encodeURIComponent(orderId)}/work-items/${encodeURIComponent(workItemId)}/complete`,
    request,
    { requireAuth: true },
  );
  const data = requireData(response);
  const parsed = kitchenBoardCompletionResultSchema.safeParse(data);
  if (
    !parsed.success ||
    !sameId(parsed.data.orderId, orderId) ||
    !sameId(parsed.data.workItemId, workItemId) ||
    parsed.data.kind !== request.kind ||
    parsed.data.accountRevision !== request.expectedAccountRevision ||
    parsed.data.acknowledgedOrderVersion > request.expectedOrderVersion
  ) {
    throw new ApiError(502, '', undefined, 'KitchenBoardCompletionMismatch');
  }
  return parsed.data;
}

export { WORK_ENDPOINT };
