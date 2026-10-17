import { fireEvent, render, screen } from '@testing-library/react';
import BillChargeFields from './BillChargeFields';
import type { useBillChargeConfiguration } from '@/hooks/useBillChargeConfiguration';

let mockRole = 'Cashier';
jest.mock('@/components/AuthContext', () => ({ useOptionalAuth: () => ({ user: { role: mockRole } }) }));
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
  mockRole = 'Cashier';
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

it('validates staff-entered amounts before changing the persisted charge selection', () => {
  Object.assign(mockReader, {
    loading: false,
    configuration: {
      currency: 'CHF',
      rules: [
        {
          key: 'service_fee',
          label: 'Service fee',
          enabled: true,
          defaultAmount: 5,
          allowCustomAmount: true,
          orderTypes: ['Takeaway'],
          roles: ['Cashier'],
        },
      ],
    },
  });
  render(<BillChargeFields orderType="Takeaway" values={[{ key: 'service_fee', amount: 5 }]} onChange={change} />);
  const input = screen.getByRole('textbox', { name: 'Service fee (CHF)' });
  fireEvent.change(input, { target: { value: '-2' } });
  expect(change).not.toHaveBeenCalled();
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent('billCharges.invalidAmount');
  fireEvent.change(input, { target: { value: '7' } });
  expect(change).toHaveBeenCalledWith([{ key: 'service_fee', amount: 7 }]);
});

it('filters chips by role, order type and existing saved charge identity', () => {
  mockRole = 'Server';
  const rule = {
    key: 'service_fee',
    label: 'Service fee',
    enabled: true,
    defaultAmount: 5,
    allowCustomAmount: false,
    orderTypes: ['DineIn'],
    roles: ['Server'],
  };
  Object.assign(mockReader, { loading: false, configuration: { currency: 'CHF', rules: [rule] } });
  const view = render(<BillChargeFields orderType="Takeaway" values={[]} onChange={change} />);
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(<BillChargeFields orderType="DineIn" values={[]} onChange={change} />);
  expect(screen.getByRole('button', { name: 'Service fee' })).toBeInTheDocument();
  view.rerender(<BillChargeFields orderType="DineIn" values={[]} existingKeys={['service_fee']} onChange={change} />);
  expect(view.container).toBeEmptyDOMElement();
  mockRole = 'Cashier';
  view.rerender(<BillChargeFields orderType="DineIn" values={[]} onChange={change} />);
  expect(view.container).toBeEmptyDOMElement();
});
