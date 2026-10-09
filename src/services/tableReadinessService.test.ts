import { apiClient } from '@/utils/apiClient';
import { lookupTableReadiness, markTableReady } from './tableReadinessService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
const get = jest.mocked(apiClient.get);
const post = jest.mocked(apiClient.post);
const tableId = '11111111-1111-4111-8111-111111111111';
const request = { operationId: '22222222-2222-4222-8222-222222222222', expectedReadinessVersion: 4 };
const data = { tableId, operationId: request.operationId, readinessState: 'ReadyForGuests', readinessVersion: 5 };
beforeEach(() => jest.clearAllMocks());

it('uses staff authorization and validates the original ready request', async () => {
  post.mockResolvedValue({ success: true, data, errors: null });
  await expect(markTableReady(tableId, request)).resolves.toEqual({ kind: 'succeeded', outcome: data });
  expect(post).toHaveBeenCalledWith(`/api/Tables/${tableId}/ready`, request, {
    requireAuth: true,
    signOutOn401: false,
  });
});

it('reads the same staff-owned outcome without posting', async () => {
  get.mockResolvedValue({ success: true, data });
  await expect(lookupTableReadiness(tableId, request)).resolves.toMatchObject({ kind: 'succeeded' });
  expect(get).toHaveBeenCalledWith(`/api/Tables/${tableId}/ready/operations/${request.operationId}`, {
    requireAuth: true,
    signOutOn401: false,
  });
  expect(post).not.toHaveBeenCalled();
});

it.each([
  { ...data, tableId: request.operationId },
  { ...data, operationId: tableId },
  { ...data, readinessVersion: 6 },
  { ...data, readinessState: 'NeedsReset' },
  { ...data, readinessVersion: 5.5 },
])('rejects mismatched/malformed success evidence', async (wrong) => {
  get.mockResolvedValue({ success: true, data: wrong });
  await expect(lookupTableReadiness(tableId, request)).rejects.toThrow();
});

it.each([
  'TableReadinessVersionStale',
  'TableReadinessVisitOpen',
  'TableServiceSessionAmbiguous',
  'TableServiceTableInactive',
  'TableReadinessNotAvailable',
])('accepts recorded terminal refusal %s', async (errorCode) => {
  get.mockResolvedValue({ success: false, errorCode, data: null });
  await expect(lookupTableReadiness(tableId, request)).resolves.toEqual({
    kind: 'refused',
    code: errorCode,
    terminal: true,
  });
});

it.each([
  'TableReadinessOperationNotFound',
  'TableReadinessFeatureDisabled',
  'TableReadinessOperationMismatch',
  undefined,
])('retains unknown or non-journal refusal %s', async (errorCode) => {
  get.mockResolvedValue({ success: false, errorCode });
  await expect(lookupTableReadiness(tableId, request)).resolves.toMatchObject({ kind: 'refused', terminal: false });
});
