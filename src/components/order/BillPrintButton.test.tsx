import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BillPrintButton from './BillPrintButton';
import { queueCashierBill } from '@/services/cashierPrintingService';
import { ModulesProvider } from '@/contexts/ModulesContext';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/cashierPrintingService', () => ({ queueCashierBill: jest.fn(), getCashierPrintJob: jest.fn() }));
const queue = jest.mocked(queueCashierBill);
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: jest.fn().mockReturnValueOnce('first-operation').mockReturnValue('next-operation'),
  });
});

it('offers browser or connected printing and retries an uncertain request using the same operation', async () => {
  queue.mockRejectedValueOnce(new Error('lost response')).mockResolvedValueOnce({
    jobId: 'first-operation',
    status: 'Sent',
    isAutomatic: false,
    createdAt: '2026-10-19T12:00:00Z',
  });
  const browser = jest.fn();
  const target = { serviceSessionId: 'visit-1', expectedVersion: 4 };
  const { rerender } = render(<BillPrintButton label="Print bill" target={target} onBrowserPrint={browser} />);
  fireEvent.click(screen.getByRole('button', { name: 'Print bill' }));
  fireEvent.click(screen.getByRole('button', { name: 'billPrint.browser' }));
  expect(browser).toHaveBeenCalledTimes(1);
  expect(queue).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'billPrint.connected' }));
  await screen.findByRole('alert');
  const refreshedTarget = { ...target, expectedVersion: 5 };
  rerender(<BillPrintButton label="Print bill" target={refreshedTarget} onBrowserPrint={browser} />);
  fireEvent.click(screen.getByRole('button', { name: 'billPrint.connected' }));
  await screen.findByText('billPrint.status.Sent');
  expect(queue).toHaveBeenNthCalledWith(1, target, 'first-operation');
  expect(queue).toHaveBeenNthCalledWith(2, refreshedTarget, 'first-operation');
  fireEvent.click(screen.getByRole('button', { name: 'billPrint.another' }));
  await waitFor(() => expect(queue).toHaveBeenLastCalledWith(refreshedTarget, 'next-operation'));
});

it('keeps browser printing available without the printing module', () => {
  render(
    <ModulesProvider modules={[]}>
      <BillPrintButton label="Print bill" target={{ orderId: 'o1', expectedVersion: 1 }} onBrowserPrint={jest.fn()} />
    </ModulesProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Print bill' }));
  expect(screen.getByRole('button', { name: 'billPrint.browser' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'billPrint.connected' })).not.toBeInTheDocument();
});
