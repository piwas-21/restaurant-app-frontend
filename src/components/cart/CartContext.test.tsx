import { act, renderHook } from '@testing-library/react';
import { CartProvider, useCart } from './CartContext';
import { basketService } from '@/services/basketService';
import { getRequestSessionId } from '@/utils/apiClient';
import type { BasketDto } from '@/types/basket';

jest.mock('@/services/basketService', () => ({
  basketService: { getBasket: jest.fn() },
}));
jest.mock('@/contexts/SessionContext', () => ({
  useSessionContext: () => ({ sessionId: null, ensureSession: jest.fn() }),
}));
jest.mock('@/hooks/cart/useCartItemMutations', () => ({
  useCartItemMutations: () => ({
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
  }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));

const mockedGetBasket = basketService.getBasket as jest.MockedFunction<typeof basketService.getBasket>;
const mockedGetRequestSessionId = getRequestSessionId as jest.MockedFunction<typeof getRequestSessionId>;

const oldGuestBasket: BasketDto = {
  id: 'basket-old-guest',
  sessionId: 'guest-session-old',
  subTotal: 0,
  tax: 0,
  deliveryFee: 0,
  discount: 0,
  customerDiscount: 0,
  total: 0,
  totalItems: 0,
  items: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe('CartProvider session-scoped basket reads', () => {
  it('does not dispatch an old guest response after the request header identity rotates', async () => {
    let resolveBasket: ((basket: BasketDto) => void) | undefined;
    mockedGetBasket.mockReturnValueOnce(new Promise((resolve) => (resolveBasket = resolve)));
    mockedGetRequestSessionId.mockReturnValueOnce('guest-session-old').mockReturnValue('guest-session-new');

    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    let sync: Promise<boolean> | undefined;
    act(() => {
      sync = result.current.syncBasket();
    });

    await act(async () => {
      resolveBasket?.(oldGuestBasket);
      await expect(sync).resolves.toBe(false);
    });

    expect(result.current.state.basket).toBeNull();
    expect(result.current.state.items).toEqual([]);
    expect(result.current.state.isLoading).toBe(false);
  });

  it('does not start a refresh when the queued operation session is already stale', async () => {
    mockedGetRequestSessionId.mockReturnValue('guest-session-new');
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await expect(result.current.syncBasket('guest-session-old')).resolves.toBe(false);

    expect(mockedGetBasket).not.toHaveBeenCalled();
    expect(result.current.state.basket).toBeNull();
  });
});
