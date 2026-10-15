import { renderHook } from '@testing-library/react';
import { useCashierTableWorkspaceActions } from './useCashierTableWorkspaceActions';

const mockPush = jest.fn();
jest.mock('@/hooks/useTenantLocaleRouter', () => ({ useTenantLocaleRouter: () => ({ push: mockPush }) }));

type Args = Parameters<typeof useCashierTableWorkspaceActions>;
function setup(
  openSession = jest.fn().mockResolvedValue({ serviceSessionId: 'visit-2', tableId: 'table-1', tableLabel: '01' }),
) {
  const entry = { table: { tableNumber: '01' } } as Args[0];
  const tables = { openSession } as unknown as Args[1];
  const route = { navigateToSession: jest.fn() } as unknown as Args[2];
  const setRecovered = jest.fn();
  return {
    ...renderHook(() => useCashierTableWorkspaceActions(entry, tables, route, setRecovered)),
    openSession,
    route,
  };
}

beforeEach(() => jest.clearAllMocks());

it('opens the composer using the returned visit and stable table identity in one action', async () => {
  const view = setup();
  await view.result.current.openSession();
  expect(view.openSession).toHaveBeenCalledWith('01');
  expect(mockPush).toHaveBeenCalledWith(
    '/cashier/new?channel=DineIn&table=01&tableId=table-1&serviceSessionId=visit-2',
  );
  expect(view.route.navigateToSession).not.toHaveBeenCalled();
});

it('keeps staff on the table if the visit could not be opened', async () => {
  const view = setup(jest.fn().mockRejectedValue(new Error('table changed')));
  await expect(view.result.current.openSession()).rejects.toThrow('table changed');
  expect(mockPush).not.toHaveBeenCalled();
});
