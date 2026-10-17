import { apiClient } from '@/utils/apiClient';
// Captured from disposable CI; the fingerprint uses a deterministic fixture value.
import capturedPreview from './__fixtures__/tableOccupancyRecoveryPreview.json';
import {
  previewTableOccupancyRecovery,
  recoverTableOccupancy,
  getTableOccupancyRecoveryOperation,
} from './tableOccupancyRecoveryService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
const get = jest.mocked(apiClient.get);
const post = jest.mocked(apiClient.post);
const request = {
  operationId: '44444444-4444-4444-8444-444444444444',
  serviceSessionId: capturedPreview.serviceSessionId,
  expectedReadinessVersion: 12,
  expectedSessionVersion: 2,
  expectedAccountRevision: 2,
  previewFingerprint: capturedPreview.previewFingerprint,
  confirmRecovery: true as const,
  reason: 'Review retained visit',
};
beforeEach(() => jest.clearAllMocks());

it('accepts the actual backend preview with a zero saved fee and keeps its financial evidence', async () => {
  get.mockResolvedValue({ success: true, data: capturedPreview });
  await expect(previewTableOccupancyRecovery(capturedPreview.tableId)).resolves.toEqual(capturedPreview);
  expect(post).not.toHaveBeenCalled();
});

it('accepts a legacy preview that omits the optional saved fee', async () => {
  const { originalBillChargeAmount: _fee, ...legacyOrder } = capturedPreview.orders[0];
  const legacy = { ...capturedPreview, orders: [legacyOrder] };
  get.mockResolvedValue({ success: true, data: legacy });
  await expect(previewTableOccupancyRecovery(capturedPreview.tableId)).resolves.toEqual(legacy);
});

it('preserves a positive saved fee in both the recovery result and its operation readback', async () => {
  const operation = {
    operationId: request.operationId,
    tableId: capturedPreview.tableId,
    serviceSessionId: capturedPreview.serviceSessionId,
    reason: request.reason,
    recordedAt: '2026-10-17T00:00:00Z',
    visitReleasedAt: '2026-10-17T00:00:00Z',
    readinessState: 'NeedsReset',
    readinessVersion: 13,
    sessionVersion: 3,
    accountRevision: 3,
    cancelledUnsentCount: 0,
    archivedLegacyCount: 0,
    retainedPriorVisitCount: 1,
    preservedPaidAmount: 0,
    preservedOutstandingAmount: 20,
    orders: [{ ...capturedPreview.orders[0], originalBillChargeAmount: 5, originalRemainingAmount: 20 }],
  };
  post.mockResolvedValue({ success: true, data: operation });
  get.mockResolvedValue({ success: true, data: operation });
  await expect(recoverTableOccupancy(capturedPreview.tableId, request)).resolves.toEqual(operation);
  await expect(getTableOccupancyRecoveryOperation(capturedPreview.tableId, request.operationId)).resolves.toEqual(
    operation,
  );
});

it.each([-1, '5', Number.POSITIVE_INFINITY])('rejects malformed fee evidence (%s)', async (fee) => {
  get.mockResolvedValue({
    success: true,
    data: { ...capturedPreview, orders: [{ ...capturedPreview.orders[0], originalBillChargeAmount: fee }] },
  });
  await expect(previewTableOccupancyRecovery(capturedPreview.tableId)).rejects.toThrow();
});

it('continues rejecting unexpected order fields', async () => {
  get.mockResolvedValue({
    success: true,
    data: { ...capturedPreview, orders: [{ ...capturedPreview.orders[0], unexpected: true }] },
  });
  await expect(previewTableOccupancyRecovery(capturedPreview.tableId)).rejects.toThrow();
});
