import { renderHook, act } from '@testing-library/react';
import { useReorder } from './useReorder';
import { ApiError } from '@/utils/apiClient';
import type { OrderDto } from '@/types/order';

const mockAddItem = jest.fn();
const mockEnqueueSnackbar = jest.fn();
const mockPush = jest.fn();

jest.mock('@/components/cart/CartContext', () => ({ useCart: () => ({ addItem: mockAddItem }) }));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, values?: Record<string, unknown>) => {
      const text = fallback ?? key;
      if (!values) return text;
      return Object.entries(values).reduce((acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)), text);
    },
  }),
}));

const order = {
  id: 'o1',
  items: [
    { productId: 'p1', quantity: 1 },
    { productId: 'p2', quantity: 2 },
    { productId: 'p3', quantity: 1 },
  ],
} as unknown as OrderDto;

const blocked = (name: string) =>
  new ApiError(
    400,
    `${name} is not available for Delivery. Available for: DineIn, Takeaway.`,
    undefined,
    'OrderTypeNotAvailable',
  );

const setReorderingOrderId = jest.fn();
const renderReorder = () => renderHook(() => useReorder(setReorderingOrderId)).result;

beforeEach(() => {
  jest.clearAllMocks();
  mockAddItem.mockResolvedValue(undefined);
});

describe('useReorder — add what fits, report the rest (gap G5)', () => {
  it('adds every line and routes to the cart when nothing is blocked', async () => {
    const result = renderReorder();

    await act(async () => result.current(order));

    expect(mockAddItem).toHaveBeenCalledTimes(3);
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      'Items added to cart',
      expect.objectContaining({ variant: 'success' }),
    );
    expect(mockPush).toHaveBeenCalledWith('/cart');
  });

  // The old loop was one try/catch around the whole thing, so the FIRST rejection aborted it —
  // later lines that would have fitted were never attempted, and the guest was told nothing about
  // which item was refused.
  it('keeps going past a blocked line and names it', async () => {
    mockAddItem
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(blocked('Dürüm'))
      .mockResolvedValueOnce(undefined);
    const result = renderReorder();

    await act(async () => result.current(order));

    expect(mockAddItem).toHaveBeenCalledTimes(3);
    const [message, options] = mockEnqueueSnackbar.mock.calls[0];
    expect(message).toContain('Added 2 of 3 items.');
    expect(message).toContain('Dürüm is not available for Delivery.');
    expect(options).toEqual(expect.objectContaining({ variant: 'warning' }));
    expect(mockPush).toHaveBeenCalledWith('/cart');
  });

  it('reports one reason per distinct cause, not one per line', async () => {
    mockAddItem
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(blocked('Dürüm'))
      .mockRejectedValueOnce(blocked('Dürüm'));
    const result = renderReorder();

    await act(async () => result.current(order));

    const [message] = mockEnqueueSnackbar.mock.calls[0];
    expect(message.match(/Dürüm is not available/g)).toHaveLength(1);
  });

  it('stays put when nothing could be added — an unchanged cart is not worth a trip', async () => {
    mockAddItem.mockRejectedValue(blocked('Dürüm'));
    const result = renderReorder();

    await act(async () => result.current(order));

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('Dürüm is not available'),
      expect.objectContaining({ variant: 'error' }),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('always clears the spinner, success or failure', async () => {
    mockAddItem.mockRejectedValue(blocked('Dürüm'));
    const result = renderReorder();

    await act(async () => result.current(order));

    expect(setReorderingOrderId).toHaveBeenNthCalledWith(1, 'o1');
    expect(setReorderingOrderId).toHaveBeenLastCalledWith(null);
  });

  it('skips lines with no productId rather than posting an empty add', async () => {
    const withGhost = { id: 'o2', items: [{ productId: 'p1', quantity: 1 }, { quantity: 1 }] } as unknown as OrderDto;
    const result = renderReorder();

    await act(async () => result.current(withGhost));

    expect(mockAddItem).toHaveBeenCalledTimes(1);
  });
});
