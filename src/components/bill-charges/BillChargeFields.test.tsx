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

it('sends the reviewed percentage and reduction semantics with the numeric value', () => {
  Object.assign(mockReader, {
    loading: false,
    configuration: {
      currency: 'EUR',
      rules: [
        {
          key: 'discount',
          label: 'Discount',
          enabled: true,
          defaultAmount: 10,
          allowCustomAmount: true,
          effect: 'Reduce',
          calculation: 'Percentage',
          orderTypes: ['Takeaway'],
          roles: ['Cashier'],
        },
      ],
    },
  });
  const view = render(<BillChargeFields orderType="Takeaway" values={[]} onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'Discount' }));
  expect(change).toHaveBeenLastCalledWith([
    { key: 'discount', amount: 10, effect: 'Reduce', calculation: 'Percentage' },
  ]);
  view.rerender(
    <BillChargeFields
      orderType="Takeaway"
      values={[{ key: 'discount', amount: 10, effect: 'Reduce', calculation: 'Percentage' }]}
      onChange={change}
    />,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Discount (%)' }), { target: { value: '25' } });
  expect(change).toHaveBeenLastCalledWith([
    { key: 'discount', amount: 25, effect: 'Reduce', calculation: 'Percentage' },
  ]);
});

it('explains a paid-bill discount block while retaining ordinary fee actions', () => {
  Object.assign(mockReader, {
    loading: false,
    configuration: {
      currency: 'EUR',
      rules: [
        {
          key: 'discount',
          label: 'Discount',
          enabled: true,
          defaultAmount: 2,
          allowCustomAmount: true,
          effect: 'Reduce',
          orderTypes: ['Takeaway'],
          roles: ['Cashier'],
        },
      ],
    },
  });
  render(<BillChargeFields orderType="Takeaway" values={[]} hasCapturedPayment onChange={change} />);
  expect(screen.getByRole('button', { name: 'Discount' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Discount' })).toHaveAccessibleDescription('billCharges.beforePayment');
  expect(screen.getByText('billCharges.beforePayment')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Discount' }));
  expect(change).not.toHaveBeenCalled();
});

it('holds an existing draft when admin changes its calculation instead of reinterpreting it', () => {
  const rule = {
    key: 'discount',
    label: 'Discount',
    enabled: true,
    defaultAmount: 10,
    allowCustomAmount: true,
    effect: 'Reduce',
    calculation: 'Fixed',
    orderTypes: ['Takeaway'],
    roles: ['Cashier'],
  };
  Object.assign(mockReader, { loading: false, configuration: { currency: 'EUR', rules: [rule] } });
  const validity = jest.fn();
  const values = [{ key: 'discount', amount: 10, effect: 'Reduce' as const, calculation: 'Fixed' as const }];
  const view = render(
    <BillChargeFields orderType="Takeaway" values={values} onChange={change} onValidityChange={validity} />,
  );
  expect(screen.getByRole('textbox', { name: 'Discount (EUR)' })).toBeInTheDocument();
  Object.assign(mockReader, { configuration: { currency: 'EUR', rules: [{ ...rule, calculation: 'Percentage' }] } });
  view.rerender(
    <BillChargeFields orderType="Takeaway" values={values} onChange={change} onValidityChange={validity} />,
  );
  expect(screen.getByText('billCharges.unavailable')).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Discount (%)' })).not.toBeInTheDocument();
  expect(validity).toHaveBeenLastCalledWith(false);
  expect(change).not.toHaveBeenCalled();
});
