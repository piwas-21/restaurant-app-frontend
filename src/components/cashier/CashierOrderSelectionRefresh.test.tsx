import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CashierReadOnlyTicket from './CashierReadOnlyTicket';
import { useCashierOrderSelection } from '@/hooks/cashier/useCashierOrderSelection';
import { getOrderById } from '@/services/cashierService';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';
import type { OrderDto } from '@/types/order';

jest.mock('@/services/cashierService', () => ({ getOrderById: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('next/dynamic', () => {
  const React: typeof import('react') = jest.requireActual('react');
  function MockTicketActions({ isOrderSnapshotFresh }: { readonly isOrderSnapshotFresh?: boolean }) {
    const [reason, setReason] = React.useState('');
    return React.createElement(
      'section',
      { 'data-testid': 'mounted-ticket-actions' },
      React.createElement('label', { htmlFor: 'draft-reason' }, 'Decision reason'),
      React.createElement('input', {
        id: 'draft-reason',
        value: reason,
        onChange: (event: { currentTarget: HTMLInputElement }) => setReason(event.currentTarget.value),
      }),
      React.createElement('button', { type: 'button', disabled: !isOrderSnapshotFresh }, 'Confirm decision'),
    );
  }
  return { __esModule: true, default: () => MockTicketActions };
});

const mockGetOrderById = jest.mocked(getOrderById);
const baseOrder = () => ({ ...marketplaceOrder(), id: 'marketplace-1', version: 7 });

function SelectedTicket({ orders }: { readonly orders: readonly OrderDto[] }) {
  const selection = useCashierOrderSelection(orders, 'marketplace-1');
  return (
    <CashierReadOnlyTicket
      order={selection.order}
      isLoading={selection.isLoading}
      isRefreshing={selection.isRefreshing}
      error={selection.error}
      onRefresh={selection.refresh}
    />
  );
}

beforeEach(() => mockGetOrderById.mockReset());

it('keeps the mounted decision draft through queue refresh and blocks it until detail recovers', async () => {
  const queued = { ...baseOrder(), updatedAt: '2026-10-02T17:00:00Z' };
  const latest = { ...queued, version: 8, updatedAt: '2026-10-02T17:01:00Z' };
  let resolveRetry: (value: OrderDto) => void = () => undefined;
  mockGetOrderById
    .mockResolvedValueOnce(queued)
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(
      () =>
        new Promise<OrderDto>((resolve) => {
          resolveRetry = resolve;
        }),
    );
  const { rerender } = render(<SelectedTicket orders={[queued]} />);
  const reason = await screen.findByRole('textbox', { name: 'Decision reason' });
  fireEvent.change(reason, { target: { value: 'Check allergy note' } });
  expect(screen.getByRole('button', { name: 'Confirm decision' })).toBeEnabled();

  rerender(<SelectedTicket orders={[latest]} />);
  await screen.findByRole('alert');
  expect(screen.getByRole('textbox', { name: 'Decision reason' })).toHaveValue('Check allergy note');
  expect(screen.getByRole('button', { name: 'Confirm decision' })).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'cashier.workspace.retry' }));
  await waitFor(() => expect(mockGetOrderById).toHaveBeenCalledTimes(3));
  expect(screen.getByRole('textbox', { name: 'Decision reason' })).toHaveValue('Check allergy note');
  expect(screen.getByRole('button', { name: 'Confirm decision' })).toBeDisabled();
  act(() => resolveRetry(latest));

  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm decision' })).toBeEnabled());
  expect(screen.getByRole('textbox', { name: 'Decision reason' })).toHaveValue('Check allergy note');
  expect(screen.getByTestId('mounted-ticket-actions')).toBeInTheDocument();
});
