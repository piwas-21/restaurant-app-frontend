import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { OrderDto } from '@/types/order';
import type { OrderAmendmentDraft } from '@/hooks/orderAmendments/orderAmendmentTypes';
import OrderAmendmentEditStage from './OrderAmendmentEditStage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        order_status_in_transit: 'In Transit',
        payment_status_partially_paid: 'Partially Paid',
      };
      return labels[key] ?? key;
    },
  }),
}));
jest.mock('./OrderAmendmentCatalogComposer', () => ({
  __esModule: true,
  default: () => <button type="button">orderAmendments.add_items</button>,
}));

const emptyDraft: OrderAmendmentDraft = {
  additions: [],
  changes: [],
  reason: '',
  preparingOverrideAcknowledged: false,
  releaseAdditionsToKitchen: true,
  localProviderSupplementConsent: false,
  providerConsentNote: '',
};

const order = (status: string, paymentStatus: string) =>
  ({
    id: 'order-1',
    orderNumber: 'A-001',
    type: 'DineIn',
    version: 4,
    status,
    paymentStatus,
    items: [{ id: 'root-line', productName: 'Soup', quantity: 2, unitPrice: 8 }],
  }) as unknown as OrderDto;

function EditHarness({ sourceOrder, role }: { sourceOrder: OrderDto; role: 'Server' | 'Cashier' | 'Admin' }) {
  const [draft, setDraft] = useState(emptyDraft);
  return <OrderAmendmentEditStage order={sourceOrder} draft={draft} onDraftChange={setDraft} operatorRole={role} />;
}

describe('OrderAmendmentEditStage', () => {
  it('renders localized status badges instead of raw order and payment enum values', () => {
    render(<EditHarness sourceOrder={order('OutForDelivery', 'PartiallyPaid')} role="Cashier" />);

    expect(screen.getByText('In Transit')).toBeInTheDocument();
    expect(screen.getByText('Partially Paid')).toBeInTheDocument();
    expect(screen.queryByText('OutForDelivery')).not.toBeInTheDocument();
    expect(screen.queryByText('PartiallyPaid')).not.toBeInTheDocument();
  });

  it.each(['Server', 'Cashier', 'Admin'] as const)(
    'requires acknowledgement for a paid Preparing order before %s can quote a source correction',
    (role) => {
      render(<EditHarness sourceOrder={order('Preparing', 'Paid')} role={role} />);
      fireEvent.change(screen.getByRole('combobox', { name: 'orderAmendments.change_action' }), {
        target: { value: 'Void' },
      });

      expect(screen.getByRole('checkbox', { name: 'orderAmendments.preparing_override' })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: 'orderAmendments.start_ordinal' })).toHaveValue(1);
      expect(screen.getByRole('spinbutton', { name: 'orderAmendments.quantity' })).toHaveValue(2);
    },
  );

  it('keeps Server source-line controls read-only after service while leaving local additions reachable', () => {
    render(<EditHarness sourceOrder={order('Delivered', 'Paid')} role="Server" />);

    expect(screen.getByRole('combobox', { name: 'orderAmendments.change_action' })).toBeDisabled();
    expect(screen.getByText('orderAmendments.served_server_source_read_only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'orderAmendments.add_items' })).toBeEnabled();
  });
});
