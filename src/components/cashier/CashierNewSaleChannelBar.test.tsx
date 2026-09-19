import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CashierNewSaleChannelBar from './CashierNewSaleChannelBar';
import { OrderType } from '@/types/order';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const baseProps = (overrides: Record<string, unknown> = {}) => ({
  enabled: [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery] as readonly OrderType[],
  loading: false,
  selected: OrderType.Takeaway as OrderType | null,
  onSelect: jest.fn(),
  tableNumber: '',
  onTableNumberChange: jest.fn(),
  disabled: false,
  ...overrides,
});

describe('CashierNewSaleChannelBar', () => {
  it('renders only the tenant-enabled channels as a radiogroup', () => {
    render(<CashierNewSaleChannelBar {...baseProps({ enabled: [OrderType.Takeaway] })} />);

    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'order_type_takeaway' })).toBeChecked();
  });

  it('selects a channel on tap', () => {
    const onSelect = jest.fn();
    render(<CashierNewSaleChannelBar {...baseProps({ onSelect })} />);

    fireEvent.click(screen.getByRole('radio', { name: 'order_type_dine_in' }));
    expect(onSelect).toHaveBeenCalledWith(OrderType.DineIn);
  });

  it('asks for the table when the sale is dine-in', () => {
    const onTableNumberChange = jest.fn();
    render(
      <CashierNewSaleChannelBar
        {...baseProps({ selected: OrderType.DineIn, tableNumber: '12', onTableNumberChange })}
      />,
    );

    const table = screen.getByLabelText('cashier.new_sale.table_number');
    expect(table).toHaveValue('12');
    fireEvent.change(table, { target: { value: '13' } });
    expect(onTableNumberChange).toHaveBeenCalledWith('13');
  });

  it('shows the loading sentence before the enabled list answers', () => {
    render(<CashierNewSaleChannelBar {...baseProps({ loading: true, selected: null })} />);

    expect(screen.getByText('cashier.new_sale.channel_loading')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('locks the chips while a review is in flight', () => {
    render(<CashierNewSaleChannelBar {...baseProps({ disabled: true })} />);

    expect(screen.getByRole('radio', { name: 'order_type_takeaway' })).toBeDisabled();
  });
});
