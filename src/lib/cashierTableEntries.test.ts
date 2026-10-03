import { mergeCashierTableEntries } from './cashierTableEntries';
import type { TableDto } from '@/types/reservation';

const table: TableDto = {
  id: '11111111-1111-4111-8111-111111111111',
  tableNumber: '11a',
  maxGuests: 4,
  isActive: true,
  isOutdoor: false,
  positionX: 0,
  positionY: 0,
  readinessState: 'NeedsReset',
  readinessVersion: 7,
};

it('keeps a reset table unavailable for opening, including a reserved table', () => {
  expect(mergeCashierTableEntries([table], [], true)[0].status).toBe('needs-reset');
  expect(mergeCashierTableEntries([{ ...table, isReserved: true }], [], true)[0].status).toBe('needs-reset');
});
it('retains legacy and inactive blockers before reset eligibility', () => {
  expect(mergeCashierTableEntries([{ ...table, isOccupied: true }], [], true)[0].status).toBe('legacy');
  expect(mergeCashierTableEntries([{ ...table, isActive: false }], [], true)[0].status).toBe('closed');
});
it('permits normal opening only after current backend state is ready', () => {
  expect(
    mergeCashierTableEntries([{ ...table, readinessState: 'ReadyForGuests', readinessVersion: 8 }], [], true)[0].status,
  ).toBe('available');
  expect(
    mergeCashierTableEntries([{ ...table, readinessState: undefined, readinessVersion: undefined }], [], true)[0]
      .status,
  ).toBe('available');
});

it('keeps migrated NeedsReset occupancy compatible with disabled rollout', () => {
  expect(mergeCashierTableEntries([table], [], false)[0].status).toBe('available');
  expect(mergeCashierTableEntries([table], [])[0].status).toBe('available');
  expect(mergeCashierTableEntries([{ ...table, isReserved: true }], [], false)[0].status).toBe('reserved');
  expect(mergeCashierTableEntries([table], [], true)[0].status).toBe('needs-reset');
});
