import {
  clearPendingTableReadiness,
  persistPendingTableReadiness,
  readPendingTableReadiness,
} from './pendingTableReadiness';
import type { PendingTableReadiness } from '@/types/tableReadiness';

const descriptor: PendingTableReadiness = {
  actorId: '11111111-1111-4111-8111-111111111111',
  actorRole: 'Server',
  tableId: '22222222-2222-4222-8222-222222222222',
  request: { operationId: '33333333-3333-4333-8333-333333333333', expectedReadinessVersion: 7 },
};
const read = () => readPendingTableReadiness(descriptor.actorId, descriptor.actorRole, descriptor.tableId);

beforeEach(() => sessionStorage.clear());
afterEach(() => jest.restoreAllMocks());

it('preserves exactly the original operation, actor role and table', () => {
  expect(read()).toEqual({ status: 'none' });
  expect(persistPendingTableReadiness(descriptor)).toBe(true);
  expect(read()).toEqual({ status: 'pending', value: descriptor });
  expect(persistPendingTableReadiness(descriptor)).toBe(true);
  expect(
    persistPendingTableReadiness({ ...descriptor, request: { ...descriptor.request, expectedReadinessVersion: 8 } }),
  ).toBe(false);
  expect(
    clearPendingTableReadiness({ ...descriptor, request: { ...descriptor.request, expectedReadinessVersion: 8 } }),
  ).toBe(false);
  expect(clearPendingTableReadiness(descriptor)).toBe(true);
  expect(read()).toEqual({ status: 'none' });
});

it('cannot mount an operation under a different actor, role or table', () => {
  expect(persistPendingTableReadiness(descriptor)).toBe(true);
  expect(readPendingTableReadiness(descriptor.actorId, 'Cashier', descriptor.tableId)).toEqual({ status: 'none' });
  expect(readPendingTableReadiness(descriptor.tableId, descriptor.actorRole, descriptor.tableId)).toEqual({
    status: 'none',
  });
  expect(readPendingTableReadiness(descriptor.actorId, descriptor.actorRole, descriptor.actorId)).toEqual({
    status: 'none',
  });
});

it.each([
  'invalid JSON',
  JSON.stringify({ ...descriptor, request: { ...descriptor.request, expectedReadinessVersion: 0 } }),
  JSON.stringify({ ...descriptor, actorRole: 'Cashier' }),
  JSON.stringify({ ...descriptor, tableId: descriptor.actorId }),
  JSON.stringify({ ...descriptor, guestName: 'unexpected' }),
])('blocks damaged or rebound storage (%s)', (raw) => {
  sessionStorage.setItem(`sofra.table-readiness.${descriptor.actorId}.Server.${descriptor.tableId}`, raw);
  expect(read()).toEqual({ status: 'unavailable' });
  expect(persistPendingTableReadiness(descriptor)).toBe(false);
  expect(clearPendingTableReadiness(descriptor)).toBe(false);
});

it('blocks inaccessible storage without losing the original descriptor', () => {
  expect(persistPendingTableReadiness(descriptor)).toBe(true);
  const failing = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(read()).toEqual({ status: 'unavailable' });
  expect(clearPendingTableReadiness(descriptor)).toBe(false);
  failing.mockRestore();
  expect(read()).toEqual({ status: 'pending', value: descriptor });
});
