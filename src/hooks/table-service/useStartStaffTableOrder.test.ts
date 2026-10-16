import { act, renderHook } from '@testing-library/react';
import { useStartStaffTableOrder } from './useStartStaffTableOrder';
import type { TableServiceSessionDto } from '@/types/order';

const mockPush = jest.fn();
jest.mock('@/hooks/useTenantLocaleRouter', () => ({ useTenantLocaleRouter: () => ({ push: mockPush }) }));
const session = { tableId: 'table/7', tableLabel: '7', serviceSessionId: 'visit/1' } as TableServiceSessionDto;
beforeEach(() => jest.clearAllMocks());

it.each(['server', 'cashier'] as const)(
  'opens an authoritative visit before routing the %s composer and blocks duplicate taps',
  async (role) => {
    let finish!: (value: TableServiceSessionDto) => void;
    const open = jest.fn(
      () =>
        new Promise<TableServiceSessionDto>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useStartStaffTableOrder(role, open));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.startOrder('table/7');
      void result.current.startOrder('table/7');
    });
    expect(open).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(result.current.isStarting).toBe(true);
    await act(async () => {
      finish(session);
      await pending;
    });
    const href = mockPush.mock.calls[0][0] as string;
    expect(href).toContain(role === 'server' ? '/server/tables/table%2F7/order?' : '/cashier/new?');
    expect(new URLSearchParams(href.slice(href.indexOf('?') + 1)).get('serviceSessionId')).toBe('visit/1');
    expect(result.current.isStarting).toBe(false);
  },
);

it('keeps a refused start on the floor and shows a localized failure without navigating', async () => {
  const open = jest.fn().mockRejectedValue(new Error('Table already occupied'));
  const { result } = renderHook(() => useStartStaffTableOrder('server', open));
  await act(async () => {
    await result.current.startOrder('7');
  });
  expect(mockPush).not.toHaveBeenCalled();
  expect(result.current.error).toBe('cashier.tables.open_failed');
  expect(result.current.isStarting).toBe(false);
});

it('does not redirect a staff member who left the floor before the visit opened', async () => {
  let finish!: (value: TableServiceSessionDto) => void;
  const open = jest.fn(
    () =>
      new Promise<TableServiceSessionDto>((resolve) => {
        finish = resolve;
      }),
  );
  const { result, unmount } = renderHook(() => useStartStaffTableOrder('server', open));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.startOrder('table/7');
  });
  unmount();
  await act(async () => {
    finish(session);
    await pending;
  });
  expect(open).toHaveBeenCalledTimes(1);
  expect(mockPush).not.toHaveBeenCalled();
});
