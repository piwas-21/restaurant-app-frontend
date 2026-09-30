import { act, renderHook } from '@testing-library/react';
import { useTenantLocaleRouter } from './useTenantLocaleRouter';

let mockPathname = '/ar/menu';
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRefresh = jest.fn();
const mockBack = jest.fn();
const mockForward = jest.fn();
const mockRouter = {
  push: mockPush,
  replace: mockReplace,
  refresh: mockRefresh,
  back: mockBack,
  forward: mockForward,
};

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
}));

describe('useTenantLocaleRouter', () => {
  beforeEach(() => {
    mockPathname = '/ar/menu';
    jest.clearAllMocks();
  });

  it('keeps its command object stable until the active path changes', () => {
    const { result, rerender } = renderHook(() => useTenantLocaleRouter());
    const initial = result.current;

    rerender();
    expect(result.current).toBe(initial);

    mockPathname = '/fr/cart';
    rerender();
    expect(result.current).not.toBe(initial);
    expect(result.current.href('/checkout/review')).toBe('/fr/checkout/review');
  });

  it('pushes a route in the current locale without adding an undefined options argument', () => {
    const { result } = renderHook(() => useTenantLocaleRouter());

    act(() => result.current.push('/cart'));

    expect(mockPush).toHaveBeenCalledWith('/ar/cart');
  });
});
