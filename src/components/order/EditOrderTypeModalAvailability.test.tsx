import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { OrderType } from '@/types/order';
import { orderTypeConfigurationService } from '@/services/orderTypeConfigurationService';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';
import EditOrderTypeModal from './EditOrderTypeModal';

const mockGetEnabled = jest.mocked(orderTypeConfigurationService.getEnabled);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
jest.mock('@/services/orderTypeConfigurationService', () => ({
  orderTypeConfigurationService: { getEnabled: jest.fn() },
}));
jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ state: { orderType: 'Takeaway' } }),
}));
jest.mock('@/contexts/TableGuestVisitContext', () => ({
  useTableGuestVisit: () => ({ phase: 'notJoined', visit: null }),
}));
jest.mock('@/services/tableGuestVisitStorage', () => ({
  hasStoredTableGuestState: () => false,
}));
jest.mock('@/components/design-system/BaseModal', () => ({
  __esModule: true,
  default: ({
    isOpen,
    title,
    children,
    footer,
  }: {
    isOpen: boolean;
    title: string;
    children: ReactNode;
    footer: ReactNode;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
        {footer}
      </div>
    ) : null,
}));

function CheckoutAvailabilityHarness() {
  const { enabled, loading, confirmed } = useEnabledOrderTypes();
  const available = !loading && confirmed && enabled.includes(OrderType.Takeaway);
  return available ? (
    <>
      <p>Checkout is available</p>
      <EditOrderTypeModal isOpen onClose={() => undefined} onPick={() => undefined} />
    </>
  ) : (
    <p>Checking checkout availability</p>
  );
}

it('keeps the checkout order-type editor mounted and reuses its host availability read', async () => {
  mockGetEnabled.mockResolvedValue([OrderType.Takeaway]);

  render(<CheckoutAvailabilityHarness />);

  expect(await screen.findByRole('dialog', { name: 'Change order type' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Takeaway' })).toBeInTheDocument();
  await waitFor(() => expect(mockGetEnabled).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('dialog', { name: 'Change order type' })).toBeInTheDocument();
  expect(screen.queryByText('Checking checkout availability')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Takeaway' }));
});
