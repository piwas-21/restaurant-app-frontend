import { fireEvent, render, screen } from '@testing-library/react';
import BillChargeFields from './BillChargeFields';
import type { useBillChargeConfiguration } from '@/hooks/useBillChargeConfiguration';

jest.mock('@/components/AuthContext', () => ({ useOptionalAuth: () => ({ user: { role: 'Cashier' } }) }));
jest.mock('@/hooks/useBillChargeConfiguration', () => ({ useBillChargeConfiguration: () => mockReader }));
const mockReader: ReturnType<typeof useBillChargeConfiguration> = {
  configuration: null,
  setConfiguration: jest.fn(),
  failed: false,
  loading: true,
  message: null,
  refresh: jest.fn(),
};
const change = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockReader, { configuration: null, failed: false, loading: true, message: null });
});

it('distinguishes loading, failed settings and a confirmed tenant with no enabled fields', () => {
  const view = render(<BillChargeFields orderType="Takeaway" values={[]} onChange={change} />);
  expect(screen.getByRole('status')).toHaveTextContent('billCharges.title');
  Object.assign(mockReader, { loading: false, failed: true, message: 'Settings temporarily unavailable' });
  view.rerender(<BillChargeFields orderType="Takeaway" values={[]} onChange={change} />);
  expect(screen.getByRole('status')).toHaveTextContent('Settings temporarily unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'retry: billCharges.title' }));
  expect(mockReader.refresh).toHaveBeenCalledTimes(1);
  Object.assign(mockReader, { failed: false, configuration: { currency: 'CHF', rules: [] } });
  view.rerender(<BillChargeFields orderType="Takeaway" values={[]} onChange={change} />);
  expect(view.container).toBeEmptyDOMElement();
});

it('lets staff remove a persisted selection after its configured field is disabled', () => {
  Object.assign(mockReader, { loading: false, configuration: { currency: 'CHF', rules: [] } });
  render(<BillChargeFields orderType="Takeaway" values={[{ key: 'service_fee', amount: 5 }]} onChange={change} />);
  expect(screen.getByText(/billCharges.unavailable/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'remove' }));
  expect(change).toHaveBeenCalledWith([]);
});
