import { renderHook, waitFor } from '@testing-library/react';
import { useCheckoutTax } from './useCheckoutTax';
import type { OrderType } from '@/types/order';
import type { BasketDto } from '@/types/basket';

const mockGetTax = jest.fn();
jest.mock('@/services/adminTaxConfigurationService', () => ({
  adminTaxConfigurationService: { getTaxForOrderType: (...a: unknown[]) => mockGetTax(...a) },
}));

const basket = { subTotal: 100, discount: 10, customerDiscount: 5, tax: 7 } as unknown as BasketDto;
const takeaway = 'Takeaway' as OrderType;

beforeEach(() => jest.clearAllMocks());

describe('useCheckoutTax', () => {
  it('derives the display tax from the config rate on the discounted subtotal', async () => {
    mockGetTax.mockResolvedValue({ rate: 10 });
    const { result } = renderHook(() => useCheckoutTax(takeaway, basket));
    // (100 − 10 − 5) * 10% = 8.5
    await waitFor(() => expect(result.current.taxAmount).toBeCloseTo(8.5));
    expect(result.current.taxConfig).toEqual({ rate: 10 });
  });

  it('zeroes the tax when a config is returned but there is no basket', async () => {
    mockGetTax.mockResolvedValue({ rate: 10 });
    const { result } = renderHook(() => useCheckoutTax(takeaway, null));
    await waitFor(() => expect(mockGetTax).toHaveBeenCalled());
    expect(result.current.taxAmount).toBe(0);
  });

  it("falls back to the basket's own tax value when the config fetch throws", async () => {
    mockGetTax.mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useCheckoutTax(takeaway, basket));
    await waitFor(() => expect(result.current.taxAmount).toBe(7));
    expect(result.current.taxConfig).toBeNull();
  });

  it('does not fetch when there is no order type', () => {
    renderHook(() => useCheckoutTax(null, basket));
    expect(mockGetTax).not.toHaveBeenCalled();
  });
});
