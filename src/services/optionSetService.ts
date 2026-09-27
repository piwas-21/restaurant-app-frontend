import { apiClient } from '@/utils/apiClient';
import type {
  OptionSetApiResponse,
  OptionSetDetail,
  OptionSetListFilters,
  OptionSetPage,
  OptionSetWriteRequest,
} from '@/types/optionSet';
import type {
  OptionSetMaterializationPreview,
  OptionSetMaterializationRequest,
  OptionSetMaterializationResult,
} from '@/types/optionSetMaterialization';
import type { MenuAuthoringApiResponse } from '@/types/menuAuthoringSearch';
import { throwServerRefusal } from '@/utils/apiFormErrors';

const API = '/api/OptionSets';

function readData<T>(response: OptionSetApiResponse<T>): T {
  if (!response.success || response.data === undefined) {
    throwServerRefusal(response);
  }
  return response.data;
}

export async function searchOptionSets(
  filters: OptionSetListFilters = {},
  signal?: AbortSignal,
): Promise<OptionSetPage> {
  const query = new URLSearchParams();
  if (filters.kind) query.set('kind', filters.kind);
  if (filters.query?.trim()) query.set('q', filters.query.trim());
  if (filters.cursor) query.set('cursor', filters.cursor);
  query.set('limit', String(filters.limit ?? 24));
  const options = { requireAuth: true, ...(signal ? { signal } : {}) };
  return readData(await apiClient.get<OptionSetApiResponse<OptionSetPage>>(`${API}?${query.toString()}`, options));
}

export async function getOptionSet(id: string): Promise<OptionSetDetail> {
  return readData(
    await apiClient.get<OptionSetApiResponse<OptionSetDetail>>(`${API}/${encodeURIComponent(id)}`, {
      requireAuth: true,
    }),
  );
}

export async function createOptionSet(request: OptionSetWriteRequest): Promise<OptionSetDetail> {
  return readData(await apiClient.post<OptionSetApiResponse<OptionSetDetail>>(API, request, { requireAuth: true }));
}

export async function updateOptionSet(
  id: string,
  version: number,
  request: OptionSetWriteRequest,
): Promise<OptionSetDetail> {
  const config = { requireAuth: true, headers: { 'If-Match': `"${version}"` } };
  return readData(
    await apiClient.put<OptionSetApiResponse<OptionSetDetail>>(`${API}/${encodeURIComponent(id)}`, request, config),
  );
}

export async function previewOptionSetAttachments(
  id: string,
  request: OptionSetMaterializationRequest,
): Promise<OptionSetMaterializationPreview> {
  return readData(
    await apiClient.post<OptionSetApiResponse<OptionSetMaterializationPreview>>(
      `${API}/${encodeURIComponent(id)}/preview`,
      request,
      { requireAuth: true },
    ),
  );
}

export async function applyOptionSetAttachments(
  id: string,
  request: OptionSetMaterializationRequest,
): Promise<OptionSetMaterializationResult> {
  return readData(
    await apiClient.post<OptionSetApiResponse<OptionSetMaterializationResult>>(
      `${API}/${encodeURIComponent(id)}/apply`,
      request,
      { requireAuth: true },
    ),
  );
}

export async function getOptionSetMaterializationEnabled(): Promise<boolean> {
  const response = await apiClient.get<MenuAuthoringApiResponse<{ optionSetMaterializationEnabled?: unknown }>>(
    '/api/tenant/features',
    { requireAuth: true },
  );
  return response.success === true && response.data?.optionSetMaterializationEnabled === true;
}
