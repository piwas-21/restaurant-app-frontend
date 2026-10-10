import {
  persistPendingTableOccupancyRecovery,
  readPendingTableOccupancyRecovery,
} from './pendingTableOccupancyRecovery';
import type { PendingTableOccupancyRecovery } from '@/types/tableOccupancyRecovery';

const saved: PendingTableOccupancyRecovery = {
  actorId: '11111111-1111-4111-8111-111111111111',
  actorRole: 'Cashier',
  tableId: '22222222-2222-4222-8222-222222222222',
  currency: 'CHF',
  request: {
    operationId: '33333333-3333-4333-8333-333333333333',
    serviceSessionId: '44444444-4444-4444-8444-444444444444',
    expectedReadinessVersion: 2,
    expectedSessionVersion: 4,
    expectedAccountRevision: 7,
    previewFingerprint: 'a'.repeat(64),
    confirmRecovery: true,
    reason: 'Stale table occupancy',
  },
};

beforeEach(() => window.sessionStorage.clear());

it('fails closed when the saved operation belongs to a different staff role', () => {
  expect(persistPendingTableOccupancyRecovery(saved)).toBe(true);
  expect(readPendingTableOccupancyRecovery(saved.actorId, saved.tableId, 'Server')).toEqual({
    status: 'role_mismatch',
  });
  expect(readPendingTableOccupancyRecovery(saved.actorId, saved.tableId, 'Cashier')).toEqual({
    status: 'pending',
    value: saved,
  });
});
