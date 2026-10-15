import { act, renderHook } from '@testing-library/react';
import { updateOrderStatus } from '@/services/orderService';
import type { OrderDto } from '@/types/order';
import { useOrderDetailsActions } from './useOrderDetailsActions';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
jest.mock('@/services/orderService', () => ({
  cancelOrder: jest.fn(),
  refundPayment: jest.fn(),
  updateOrderStatus: jest.fn(),
}));
jest.mock('@/hooks/useApiError', () => ({
  useApiError: () => ({ clear: jest.fn(), capture: jest.fn(), show: jest.fn(), message: null }),
}));
jest.mock('@/hooks/admin/useOrderDocumentActions', () => ({
  useOrderDocumentActions: () => ({
    showExportMenu: false,
    setShowExportMenu: jest.fn(),
    handlePrint: jest.fn(),
    handleExport: jest.fn(),
    handleExportPDF: jest.fn(),
  }),
}));

const mockUpdateOrderStatus = jest.mocked(updateOrderStatus);

function order(effectivePreparationMinutes: number | null): OrderDto {
  return {
    id: 'order-1',
    orderNumber: 'ORD-1',
    type: 'Takeaway',
    status: 'Pending',
    paymentStatus: 'Pending',
    version: 0,
    subTotal: 10,
    tax: 0,
    deliveryFee: 0,
    discount: 0,
    discountPercentage: 0,
    customerDiscountAmount: 0,
    tip: 0,
    total: 10,
    totalPaid: 0,
    remainingAmount: 10,
    isFullyPaid: false,
    isFocusOrder: false,
    hasUserLimitDiscount: false,
    userLimitAmount: 0,
    orderDate: '2026-10-15T10:00:00Z',
    items: [],
    payments: [],
    statusHistory: [],
    effectivePreparationMinutes,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateOrderStatus.mockImplementation(async (_id, command) => ({
    ...order(command.estimatedPreparationMinutes ?? null),
    status: command.newStatus,
  }));
});

describe('useOrderDetailsActions confirmation preparation defaults', () => {
  it('uses the saved effective preparation estimate instead of a hard-coded delay', async () => {
    const source = order(24);
    const { result } = renderHook(() => useOrderDetailsActions(source, jest.fn()));

    await act(async () => result.current.handleConfirmOrder(false));

    expect(mockUpdateOrderStatus).toHaveBeenCalledWith('order-1', {
      newStatus: 'Confirmed',
      estimatedPreparationMinutes: 24,
      notes: 'Order confirmed',
    });
  });

  it('omits the preparation override when the order has no saved estimate', async () => {
    const source = order(null);
    const { result } = renderHook(() => useOrderDetailsActions(source, jest.fn()));

    await act(async () => result.current.handleConfirmOrder(false));

    expect(mockUpdateOrderStatus).toHaveBeenCalledWith('order-1', {
      newStatus: 'Confirmed',
      notes: 'Order confirmed',
    });
  });

  it('preserves the explicitly selected delay override', async () => {
    const { result } = renderHook(() => useOrderDetailsActions(order(24), jest.fn()));
    act(() => result.current.setDelayMinutes(31));

    await act(async () => result.current.handleConfirmOrder(true));

    expect(mockUpdateOrderStatus).toHaveBeenCalledWith('order-1', {
      newStatus: 'PendingApproval',
      estimatedPreparationMinutes: 31,
      notes: 'Confirmed with 31 min delay',
    });
  });
});
