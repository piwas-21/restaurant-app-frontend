import { act, renderHook, waitFor } from '@testing-library/react';
import {
  getTableOccupancyRecoveryOperation,
  previewTableOccupancyRecovery,
  recoverTableOccupancy,
  TableOccupancyRecoveryTerminalRefusal,
} from '@/services/tableOccupancyRecoveryService';
import { readPendingTableOccupancyRecovery } from '@/lib/pendingTableOccupancyRecovery';
import type { PendingTableOccupancyRecovery, TableOccupancyRecoveryPreview } from '@/types/tableOccupancyRecovery';
import { useTableOccupancyRecovery } from './useTableOccupancyRecovery';

jest.mock('@/services/tableOccupancyRecoveryService', () => {
  const actual = jest.requireActual(
    '@/services/tableOccupancyRecoveryService',
  ) as typeof import('@/services/tableOccupancyRecoveryService');
  return {
    ...actual,
    getTableOccupancyRecoveryOperation: jest.fn(),
    previewTableOccupancyRecovery: jest.fn(),
    recoverTableOccupancy: jest.fn(),
  };
});

const actorId = '11111111-1111-4111-8111-111111111111';
const tableId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const operationId = '44444444-4444-4444-8444-444444444444';
const preview: TableOccupancyRecoveryPreview = {
  tableId,
  tableNumber: '9',
  serviceSessionId: sessionId,
  sessionVersion: 4,
  accountRevision: 7,
  readinessVersion: 2,
  currency: 'CHF',
  previewFingerprint: 'a'.repeat(64),
  orderCount: 0,
  cancelableUnsentCount: 0,
  legacyUnassignedCount: 0,
  routedOrderCount: 0,
  preparingOrderCount: 0,
  readyOrderCount: 0,
  paidOrRefundedOrderCount: 0,
  activePaymentAttemptCount: 0,
  pendingPaymentHandoffCount: 0,
  checkoutAttemptCount: 0,
  preservedOutstandingAmount: 0,
  orders: [],
};

const readback = jest.mocked(getTableOccupancyRecoveryOperation);
const loadPreview = jest.mocked(previewTableOccupancyRecovery);
const recover = jest.mocked(recoverTableOccupancy);

function renderRecovery() {
  return renderHook(() =>
    useTableOccupancyRecovery({
      actorId,
      actorRole: 'Cashier',
      tableId,
      serviceSessionId: sessionId,
      canWrite: true,
      onRecovered: jest.fn(async () => undefined),
    }),
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  jest.clearAllMocks();
  jest.spyOn(crypto, 'randomUUID').mockReturnValue(operationId);
  readback.mockResolvedValue(null);
  loadPreview.mockResolvedValue(preview);
});

afterEach(() => jest.restoreAllMocks());

it('clears the exact stale operation after a no-write refusal and loads a fresh preview', async () => {
  const freshPreview = { ...preview, readinessVersion: 3, previewFingerprint: 'b'.repeat(64) };
  loadPreview.mockResolvedValueOnce(preview).mockResolvedValueOnce(freshPreview);
  recover.mockRejectedValueOnce(new TableOccupancyRecoveryTerminalRefusal('stale_preview'));
  const { result } = renderRecovery();
  await waitFor(() => expect(result.current.stage).toBe('idle'));

  await act(async () => result.current.startPreview());
  act(() => result.current.setReason('Review stale table state'));
  await act(async () => result.current.confirm());

  expect(result.current).toMatchObject({ stage: 'failed', error: 'stale_preview' });
  expect(readPendingTableOccupancyRecovery(actorId, tableId)).toEqual({ status: 'none' });
  await act(async () => result.current.startPreview());
  expect(loadPreview).toHaveBeenCalledTimes(2);
  expect(result.current).toMatchObject({ stage: 'previewed', preview: freshPreview });
});

it('allows a failed preview read to be retried successfully', async () => {
  loadPreview.mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce(preview);
  const { result } = renderRecovery();
  await waitFor(() => expect(result.current.stage).toBe('idle'));

  await act(async () => result.current.startPreview());
  expect(result.current).toMatchObject({ stage: 'failed', error: 'preview_failed' });
  await act(async () => result.current.startPreview());
  expect(result.current).toMatchObject({ stage: 'previewed', preview });
});

it('keeps the exact recovery journal after an unknown transport outcome', async () => {
  recover.mockRejectedValueOnce(new TypeError('connection dropped'));
  const { result } = renderRecovery();
  await waitFor(() => expect(result.current.stage).toBe('idle'));
  expect(result.current.hasPendingOperation).toBe(false);
  await act(async () => result.current.startPreview());
  act(() => result.current.setReason('Review table occupancy'));
  await act(async () => result.current.confirm());

  expect(result.current.stage).toBe('pending');
  expect(result.current.hasPendingOperation).toBe(true);
  expect(readPendingTableOccupancyRecovery(actorId, tableId)).toMatchObject({
    status: 'pending',
    value: { request: { operationId } },
  });
});

it('does not load or replay a journal created under another staff role', async () => {
  const saved: PendingTableOccupancyRecovery = {
    actorId,
    actorRole: 'Admin',
    tableId,
    currency: 'CHF',
    request: {
      operationId,
      serviceSessionId: sessionId,
      expectedReadinessVersion: 2,
      expectedSessionVersion: 4,
      expectedAccountRevision: 7,
      previewFingerprint: 'a'.repeat(64),
      confirmRecovery: true,
      reason: 'Earlier review',
    },
  };
  window.sessionStorage.setItem(`sofra.table-occupancy-recovery.${actorId}.${tableId}`, JSON.stringify(saved));
  const { result } = renderRecovery();
  await waitFor(() => expect(result.current).toMatchObject({ stage: 'unavailable', error: 'role_mismatch' }));
  expect(result.current.hasPendingOperation).toBe(true);
  expect(readback).not.toHaveBeenCalled();
  expect(recover).not.toHaveBeenCalled();
});

it('blocks conflicting writes while the recovery journal cannot be read', async () => {
  window.sessionStorage.setItem(`sofra.table-occupancy-recovery.${actorId}.${tableId}`, '{broken');
  const { result } = renderRecovery();

  await waitFor(() => expect(result.current).toMatchObject({ stage: 'unavailable', error: 'storage_unavailable' }));
  expect(result.current.hasPendingOperation).toBe(true);
  expect(readback).not.toHaveBeenCalled();
});
