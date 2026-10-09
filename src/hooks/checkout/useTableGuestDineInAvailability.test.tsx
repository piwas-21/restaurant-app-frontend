import { renderHook } from '@testing-library/react';
import type { TableGuestVisitContextValue } from '@/contexts/TableGuestVisitContext';
import { useTableGuestDineInAvailability } from './useTableGuestDineInAvailability';

let mockVisit: Pick<TableGuestVisitContextValue, 'phase' | 'visit'>;
let mockStoredState = true;

jest.mock('@/contexts/TableGuestVisitContext', () => ({
  useTableGuestVisit: () => mockVisit,
}));

jest.mock('@/services/tableGuestVisitStorage', () => ({
  hasStoredTableGuestState: () => mockStoredState,
}));

jest.mock('./useEnabledOrderTypes', () => ({
  useEnabledOrderTypes: () => ({
    enabled: [],
    loading: false,
    confirmed: false,
    refresh: jest.fn().mockResolvedValue(null),
  }),
}));

describe('useTableGuestDineInAvailability blocker copy', () => {
  beforeEach(() => {
    mockVisit = { phase: 'loading', visit: null };
    mockStoredState = true;
  });

  it.each([
    ['ended', 'table_guest_ended_detail'],
    ['storageUnavailable', 'table_guest_storage_help'],
    ['unavailable', 'table_guest_unavailable_detail'],
    ['loading', 'loading'],
  ] as const)('selects the %s phase copy without claiming the visit is saved', (phase, messageKey) => {
    mockVisit = { phase, visit: null };

    const { result } = renderHook(() => useTableGuestDineInAvailability());

    expect(result.current.visitBound).toBe(true);
    expect(result.current.blockerMessageKey).toBe(messageKey);
  });
});
