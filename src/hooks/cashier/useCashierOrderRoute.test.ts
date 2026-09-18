import { act, renderHook } from '@testing-library/react';
import { useCashierOrderRoute } from './useCashierOrderRoute';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockParams = new URLSearchParams('status=Ready');

jest.mock('next/navigation', () => ({
  usePathname: () => '/cashier/orders',
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockParams,
}));

describe('useCashierOrderRoute', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
  });

  it('pushes selection for a deep link and replaces only the selection on close', () => {
    const { result } = renderHook(() => useCashierOrderRoute());

    expect(result.current.selectedOrderId).toBeNull();
    act(() => result.current.navigateWithOrder('order-7'));
    expect(mockPush).toHaveBeenCalledWith('/cashier/orders?status=Ready&order=order-7');

    act(() => result.current.clearOrder());
    expect(mockReplace).toHaveBeenCalledWith('/cashier/orders?status=Ready');
  });

  it('routes collection as a focused task and can return to the same ticket', () => {
    const { result } = renderHook(() => useCashierOrderRoute());

    act(() => result.current.navigateToCollection('order/7'));
    expect(mockPush).toHaveBeenCalledWith('/cashier/collection?order=order%2F7');

    act(() => result.current.navigateToOrder('order/7'));
    expect(mockPush).toHaveBeenLastCalledWith('/cashier/orders?order=order%2F7');

    act(() => result.current.navigateToOrders());
    expect(mockPush).toHaveBeenLastCalledWith('/cashier/orders');
  });
});
