import { act, renderHook, waitFor } from '@testing-library/react';
import { useCashierNewSale } from './useCashierNewSale';
import { reviewCounterSale } from './newSaleReview';
import { getProductById } from '@/services/menuService';
import { OrderType, type OrderDto } from '@/types/order';
import { readCashierNewSaleDraft } from '@/lib/cashierNewSaleDraft';

const mockReview = reviewCounterSale as jest.Mock;
const mockGetDetail = getProductById as jest.Mock;

jest.mock('@/hooks/checkout/useEnabledOrderTypes', () => ({
  useEnabledOrderTypes: () => ({
    enabled: ['DineIn', 'Takeaway', 'Delivery'],
    loading: false,
  }),
}));
jest.mock('./newSaleReview', () => ({ reviewCounterSale: jest.fn() }));
jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));

const quote: Partial<OrderDto> = { id: 'q-1', total: 7 };

const detail = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  data: { id: 'product-1', name: 'Espresso', basePrice: 3.5, ...overrides },
});

beforeEach(() => {
  window.sessionStorage.clear();
  jest.clearAllMocks();
  mockReview.mockResolvedValue({ status: 'refused', error: 'refused by server' });
});

async function renderSale() {
  const onCreated = jest.fn();
  const rendered = renderHook(() => useCashierNewSale({ onCreated }));
  await waitFor(() => expect(rendered.result.current.channel).toBe(OrderType.Takeaway));
  return { ...rendered, onCreated };
}

describe('useCashierNewSale — catalog tap', () => {
  it('adds a simple product on tap and merges a second tap into quantity', async () => {
    mockGetDetail.mockResolvedValueOnce(detail()).mockResolvedValueOnce(detail());
    const { result } = await renderSale();

    await act(async () => {
      await result.current.tapProduct({ id: 'product-1', name: 'Espresso' } as never);
      await result.current.tapProduct({ id: 'product-1', name: 'Espresso' } as never);
    });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(2);
    expect(result.current.lines[0].product.id).toBe('product-1');
  });

  it('opens the shared sheet for a product with choices and confirms its result', async () => {
    mockGetDetail.mockResolvedValueOnce(
      detail({ variations: [{ id: 'v1', name: 'Large', priceModifier: 1, isActive: true }] }),
    );
    const { result } = await renderSale();

    await act(async () => {
      await result.current.tapProduct({ id: 'product-1', name: 'Espresso' } as never);
    });
    expect(result.current.sheetProduct).not.toBeNull();

    await act(async () => {
      result.current.confirmCustomization({
        productId: 'product-1',
        variationId: 'v1',
        variationName: 'Large',
        addedIngredients: [],
        removedIngredients: [],
        selectedIngredientIds: [],
        ingredientQuantities: {},
        sideItems: [],
        finalPrice: 4.5,
      });
    });

    expect(result.current.sheetProduct).toBeNull();
    expect(result.current.lines[0].variationName).toBe('Large');
    expect(result.current.lines[0].unitPrice).toBe(4.5);
  });

  it('surfaces an unavailable product instead of adding a line', async () => {
    mockGetDetail.mockResolvedValueOnce({ success: false });
    const { result } = await renderSale();

    await act(async () => {
      await result.current.tapProduct({ id: 'product-1', name: 'Espresso' } as never);
    });

    expect(result.current.lines).toHaveLength(0);
    expect(result.current.error).toBe('cashier.new_sale.product_unavailable');
  });

  it('surfaces a detail fetch failure instead of adding a line', async () => {
    mockGetDetail.mockRejectedValueOnce(new TypeError('down'));
    const { result } = await renderSale();

    await act(async () => {
      await result.current.tapProduct({ id: 'product-1', name: 'Espresso' } as never);
    });

    expect(result.current.lines).toHaveLength(0);
    expect(result.current.error).toBe('cashier.new_sale.product_unavailable');
  });
});

describe('useCashierNewSale — ticket editing', () => {
  async function saleWithLine() {
    mockGetDetail.mockResolvedValue(detail());
    const rendered = await renderSale();
    await act(async () => {
      await rendered.result.current.tapProduct({ id: 'product-1', name: 'Espresso' } as never);
    });
    return rendered;
  }

  it('edits a line quantity from the ticket', async () => {
    const { result } = await saleWithLine();
    await act(async () => {
      result.current.setLineQuantity(0, 5);
    });
    expect(result.current.lines[0].quantity).toBe(5);
  });

  it('removes a line and undoes the removal at its old position', async () => {
    mockGetDetail.mockClear();
    const { result } = await saleWithLine();
    await act(async () => {
      await result.current.tapProduct({ id: 'product-2', name: 'Tea' } as never);
    });
    expect(result.current.lines).toHaveLength(2);

    await act(async () => {
      result.current.removeLine(0);
    });
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].product.id).toBe('product-2');

    await act(async () => {
      result.current.undoRemove();
    });
    expect(result.current.lines).toHaveLength(2);
    expect(result.current.lines[0].product.id).toBe('product-1');
    expect(result.current.lastRemoved).toBeNull();
  });
});

describe('useCashierNewSale — the persistent draft', () => {
  it('persists channel and lines, and clears the stored draft after the ticket empties', async () => {
    mockGetDetail.mockResolvedValue(detail());
    const { result } = await renderSale();

    await act(async () => {
      await result.current.tapProduct({ id: 'product-1', name: 'Espresso' } as never);
    });
    await waitFor(() => expect(readCashierNewSaleDraft()).not.toBeNull());
    const stored = readCashierNewSaleDraft();
    expect(stored?.channel).toBe(OrderType.Takeaway);
    expect(stored?.lines[0].product.id).toBe('product-1');

    await act(async () => {
      result.current.setLineQuantity(0, 0);
    });
    await waitFor(() => expect(readCashierNewSaleDraft()).toBeNull());
  });
});

describe('useCashierNewSale — review', () => {
  async function saleWithLine() {
    mockGetDetail.mockResolvedValue(detail());
    const rendered = await renderSale();
    await act(async () => {
      await rendered.result.current.tapProduct({ id: 'product-1', name: 'Espresso' } as never);
    });
    mockReview.mockResolvedValue({ status: 'committed', operationId: 'op-1', orderId: 'order-9', quote });
    return rendered;
  }

  it('hands the draft to the review flow and clears it on a committed create', async () => {
    const { result, onCreated } = await saleWithLine();

    await act(async () => {
      await result.current.review();
    });

    expect(mockReview).toHaveBeenCalledTimes(1);
    expect(mockReview.mock.calls[0][0].channel).toBe(OrderType.Takeaway);
    expect(mockReview.mock.calls[0][0].lines).toHaveLength(1);
    expect(onCreated).toHaveBeenCalledWith('order-9');
    expect(readCashierNewSaleDraft()).toBeNull();
  });

  it('keeps the quoted price only while the ticket is unchanged — a channel change re-quotes', async () => {
    const { result } = await saleWithLine();
    mockReview.mockResolvedValue({
      status: 'refused',
      quote,
      operationId: 'op-1',
      error: 'Product X is not available for this channel.',
    });

    await act(async () => {
      await result.current.review();
    });
    expect(result.current.quote).toEqual(quote);

    await act(async () => {
      result.current.setChannel(OrderType.DineIn);
    });
    expect(result.current.quote).toBeNull();

    mockReview.mockResolvedValue({ status: 'committed', operationId: 'op-2', orderId: 'order-9', quote });
    await act(async () => {
      await result.current.review();
    });
    // The new quote came from a NEW review pass of the changed ticket — not the stale one.
    expect(mockReview).toHaveBeenCalledTimes(2);
    expect(mockReview.mock.calls[1][0].channel).toBe(OrderType.DineIn);
    // The create committed, so the ticket was emptied — there is nothing left to show a quote for.
    expect(result.current.lines).toHaveLength(0);
    expect(result.current.quote).toBeNull();
  });

  it('drops the stored operation id when the ticket changes after a refused create', async () => {
    const { result } = await saleWithLine();
    mockReview.mockResolvedValue({ status: 'refused', operationId: 'op-1', error: 'no' });

    await act(async () => {
      await result.current.review();
    });
    await waitFor(() => expect(readCashierNewSaleDraft()?.clientOperationId).toBe('op-1'));

    await act(async () => {
      result.current.setNotes('no onions');
    });
    expect(readCashierNewSaleDraft()?.clientOperationId).toBeUndefined();

    await act(async () => {
      await result.current.review();
    });
    expect(mockReview).toHaveBeenCalledTimes(2);
    expect(mockReview.mock.calls[1][0].storedOperationId).toBeUndefined();
  });

  it('does not review an empty ticket', async () => {
    const { result } = await renderSale();
    await act(async () => {
      await result.current.review();
    });
    expect(mockReview).not.toHaveBeenCalled();
  });
});

describe('useCashierNewSale — delivery contact', () => {
  async function deliverySale() {
    mockGetDetail.mockResolvedValue(detail());
    const rendered = await renderSale();
    await act(async () => {
      await rendered.result.current.tapProduct({ id: 'product-1', name: 'Espresso' } as never);
    });
    await act(async () => {
      rendered.result.current.setChannel(OrderType.Delivery);
    });
    return rendered;
  }

  it('blocks a delivery review without an address and never calls the server', async () => {
    const { result } = await deliverySale();

    await act(async () => {
      await result.current.review();
    });

    expect(result.current.error).toBe('cashier.new_sale.address_required');
    expect(result.current.phase).toBe('idle');
    expect(mockReview).not.toHaveBeenCalled();
  });

  it('hands the contact to the review pass once the address is entered', async () => {
    const { result } = await deliverySale();
    mockReview.mockResolvedValue({ status: 'committed', operationId: 'op-1', orderId: 'order-9', quote });

    await act(async () => {
      result.current.setContact({
        customerName: 'Ada',
        deliveryAddress: {
          addressLine1: 'Musterstrasse 1',
          city: 'Genève',
          postalCode: '1201',
          country: 'CH',
        },
      });
    });

    await act(async () => {
      await result.current.review();
    });

    expect(mockReview).toHaveBeenCalledTimes(1);
    expect(mockReview.mock.calls[0][0].contact?.customerName).toBe('Ada');
    expect(mockReview.mock.calls[0][0].contact?.deliveryAddress?.addressLine1).toBe('Musterstrasse 1');
  });

  it('drops the quoted price when the contact changes — the ticket must be re-quoted', async () => {
    const { result } = await deliverySale();
    mockReview.mockResolvedValue({ status: 'refused', quote, operationId: 'op-1', error: 'nope' });

    await act(async () => {
      result.current.setContact({
        deliveryAddress: { addressLine1: 'Musterstrasse 1', city: 'Genève', postalCode: '1201', country: 'CH' },
      });
    });
    await act(async () => {
      await result.current.review();
    });
    expect(result.current.quote).toEqual(quote);

    await act(async () => {
      result.current.setContact({ customerPhone: '+4122000000' });
    });
    expect(result.current.quote).toBeNull();
  });
});
