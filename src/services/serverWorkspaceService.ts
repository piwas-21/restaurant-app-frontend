import { throwServerRefusal } from '@/utils/apiFormErrors';
import { ApiError, apiClient } from '@/utils/apiClient';
import type {
  DeliverServerTaskRequest,
  ServerTaskBucket,
  ServerTaskFeed,
  ServerTaskFeedApiResponse,
} from '@/types/serverTasks';
import type { ServerFloorSnapshot, ServerFloorSnapshotApiResponse } from '@/types/serverWorkspace';
import type { OrderDto, OrderDtoApiResponse } from '@/types/order';
import { serverTaskFeedSchema } from '@/schemas/serverTask.schema';

const FLOOR_ENDPOINT = '/api/staff/server-workspace/floor';
const TASKS_ENDPOINT = '/api/staff/server-workspace/tasks';

/** Read one repeatable-read floor snapshot; the backend owns all table/session state decisions. */
export async function getServerFloorSnapshot(): Promise<ServerFloorSnapshot> {
  const response = await apiClient.get<ServerFloorSnapshotApiResponse>(FLOOR_ENDPOINT, { requireAuth: true });
  if (response.success !== true || response.data === undefined || response.data === null) {
    throwServerRefusal(response);
  }
  return response.data;
}

export interface GetServerTaskFeedOptions {
  bucket?: ServerTaskBucket;
  cursor?: string | null;
  pageSize?: number;
}

function requireTaskFeed(response: ServerTaskFeedApiResponse): ServerTaskFeed {
  if (response.success !== true || response.data === undefined || response.data === null) {
    throwServerRefusal(response);
  }
  const parsed = serverTaskFeedSchema.safeParse(response.data);
  if (!parsed.success) throw new ApiError(500, '', undefined, 'InvalidServerTaskFeed');
  return parsed.data;
}

/** Reads one server-owned task page. Cursor values are opaque and must be replayed unchanged. */
export async function getServerTaskFeed(options: GetServerTaskFeedOptions = {}): Promise<ServerTaskFeed> {
  const params = new URLSearchParams();
  if (options.bucket) params.set('bucket', options.bucket);
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.pageSize !== undefined) params.set('pageSize', String(options.pageSize));
  const query = params.toString();
  const endpoint = query ? `${TASKS_ENDPOINT}?${query}` : TASKS_ENDPOINT;
  const response = await apiClient.get<ServerTaskFeedApiResponse>(endpoint, {
    requireAuth: true,
  });
  return requireTaskFeed(response);
}

/** Advances a task only with the version the staff member saw. */
export async function deliverServerTask(orderId: string, request: DeliverServerTaskRequest): Promise<OrderDto> {
  const response = await apiClient.post<OrderDtoApiResponse>(
    `${TASKS_ENDPOINT}/${encodeURIComponent(orderId)}/deliver`,
    request,
    { requireAuth: true },
  );
  if (response.success !== true || response.data === undefined || response.data === null) throwServerRefusal(response);
  return response.data;
}

export { FLOOR_ENDPOINT, TASKS_ENDPOINT };
