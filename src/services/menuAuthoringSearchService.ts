import { apiClient } from '@/utils/apiClient';
import type {
  MenuAuthoringApiResponse,
  MenuAuthoringMatchDecisionRequest,
  MenuAuthoringSearchFilters,
  MenuAuthoringSearchPage,
} from '@/types/menuAuthoringSearch';
import { throwServerRefusal } from '@/utils/apiFormErrors';

function readData<T>(response: MenuAuthoringApiResponse<T>): T {
  if (!response.success || response.data === undefined) {
    throwServerRefusal(response);
  }
  return response.data;
}

export async function searchMenuAuthoring(
  filters: MenuAuthoringSearchFilters,
  signal?: AbortSignal,
): Promise<MenuAuthoringSearchPage> {
  const query = new URLSearchParams({ q: filters.query.trim(), limit: String(filters.limit ?? 24) });
  if (filters.forKind) query.set('forKind', filters.forKind);
  if (filters.cursor) query.set('cursor', filters.cursor);
  const options = { requireAuth: true, ...(signal ? { signal } : {}) };
  return readData(
    await apiClient.get<MenuAuthoringApiResponse<MenuAuthoringSearchPage>>(
      `/api/MenuAuthoring/search?${query.toString()}`,
      options,
    ),
  );
}

export async function recordMenuAuthoringMatchDecision(request: MenuAuthoringMatchDecisionRequest): Promise<void> {
  readData(
    await apiClient.post<MenuAuthoringApiResponse<unknown>>('/api/MenuAuthoring/match-decisions', request, {
      requireAuth: true,
    }),
  );
}
