import { fireEvent, render, screen } from '@testing-library/react';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import { getOrderAmendmentHistory } from '@/services/orderAmendmentsService';
import type { OrderDto, OrderItemDto } from '@/types/order';
import type { OrderAmendmentHistory } from '@/types/orderAmendment';
import OrderAmendmentHistorySection from './OrderAmendmentHistorySection';

const mockI18n = { language: 'en', addResourceBundle: jest.fn() };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: mockI18n,
    t: (key: string, options?: string | Record<string, unknown>) => {
      const values = typeof options === 'string' ? {} : (options ?? {});
      const fallback = typeof options === 'string' ? options : values.defaultValue;
      const message = typeof fallback === 'string' ? fallback : key;
      return message.replace(/{{(\w+)}}/g, (_match, name: string) => String(values[name] ?? `{{${name}}}`));
    },
  }),
}));
jest.mock('@/services/orderAmendmentsService', () => ({ getOrderAmendmentHistory: jest.fn() }));

const mockGetHistory = getOrderAmendmentHistory as jest.Mock;
const sourceItem = {
  id: 'source-line',
  productName: 'Soup',
  quantity: 1,
  itemTotal: 8,
  ingredientCustomizations: [],
  sideItems: [],
} as unknown as OrderItemDto;
const supplementOrder = {
  id: 'supplement-1',
  orderNumber: 'A-101-S1',
  type: 'Takeaway',
  currency: 'CHF',
  total: 12,
  items: [{ ...sourceItem, id: 'supplement-line', productName: 'Bread', itemTotal: 12 }],
  guestStatusToken: 'guest-token-private',
  customerEmail: 'private@example.test',
  notes: 'private order note',
} as unknown as OrderDto;
const committed: OrderAmendmentHistory = {
  amendmentId: 'amendment-1',
  sourceOrderId: 'order-1',
  serviceSessionId: null,
  supplementOrderId: 'supplement-1',
  actorRole: 'Cashier',
  state: 'Committed',
  createdAt: '2026-10-02T10:00:00Z',
  committedAt: '2026-10-02T10:01:00Z',
  supplementOrder,
  changes: [
    {
      orderItemId: sourceItem.id,
      kind: 'Void',
      startOrdinal: 1,
      quantity: 1,
      wholeLine: false,
      previous: sourceItem,
      current: null,
      replacementDispatchedOrderId: null,
      replacementDispatchedOrderNumber: null,
    },
  ],
  financialResolution: {
    currency: 'CHF',
    addedAmountMinor: 1200,
    removedUnitValueMinor: 800,
    netAccountDeltaMinor: 400,
    potentialCreditMinor: 0,
    resolutionStatus: 'Pending',
    creditState: 'None',
    loyaltyState: 'None',
    refundState: 'PendingTillRefund',
  },
};

describe('OrderAmendmentHistorySection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders linked committed changes and recorded payment outcomes without private actor or guest fields', async () => {
    mockGetHistory.mockResolvedValueOnce([
      committed,
      { ...committed, amendmentId: 'draft-1', state: 'Quoted', supplementOrder: null },
    ]);
    render(
      <TenantFeaturesProvider features={{ orderAmendmentsV1: true }}>
        <OrderAmendmentHistorySection orderId="order-1" refreshKey={1} />
      </TenantFeaturesProvider>,
    );
    fireEvent.click(await screen.findByText('Amendment history'));

    expect(await screen.findByText(/Void · Soup/)).toBeInTheDocument();
    expect(screen.getByText(/A-101-S1/)).toBeInTheDocument();
    expect(screen.getByText(/Supplement total/).parentElement).toHaveTextContent('12.00');
    expect(screen.getByText('PendingTillRefund')).toBeInTheDocument();
    expect(screen.getByText(/did not collect or refund money/)).toBeInTheDocument();
    expect(
      screen.queryByText(/staff-user-private|guest-token-private|private@example\.test|private order note/),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('Committed')).toHaveLength(1);
  });

  it('fails closed when the tenant display flag is off', () => {
    render(
      <TenantFeaturesProvider features={{ orderAmendmentsV1: false }}>
        <OrderAmendmentHistorySection orderId="order-1" refreshKey={1} />
      </TenantFeaturesProvider>,
    );
    expect(screen.queryByText('Amendment history')).not.toBeInTheDocument();
    expect(mockGetHistory).not.toHaveBeenCalled();
  });
});
