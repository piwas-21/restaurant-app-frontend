import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CashierNewSaleDetailsModal from './CashierNewSaleDetailsModal';
import { OrderType } from '@/types/order';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useRestaurantInfo', () => ({ useRestaurantInfo: () => ({ info: { country: 'Switzerland' } }) }));

const base = (overrides: Record<string, unknown> = {}) => ({
  isOpen: true,
  channel: OrderType.Takeaway as OrderType,
  contact: undefined,
  onApply: jest.fn(),
  onClose: jest.fn(),
  ...overrides,
});

describe('CashierNewSaleDetailsModal', () => {
  it('applies a takeaway contact without any address fields', () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    render(<CashierNewSaleDetailsModal {...base({ onApply, onClose })} />);

    // Takeaway renders no address section at all — a counter cashier has nobody to ask.
    expect(screen.queryByLabelText('cashier.new_sale.details_country')).toBeNull();

    fireEvent.change(screen.getByLabelText('cashier.new_sale.details_name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'cashier.new_sale.details_apply' }));

    expect(onApply).toHaveBeenCalledWith({ customerName: 'Ada' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('seeds the country field from the tenant info', () => {
    render(<CashierNewSaleDetailsModal {...base({ channel: OrderType.Delivery })} />);

    expect(screen.getByLabelText('cashier.new_sale.details_country')).toHaveValue('Switzerland');
  });

  it('refuses to apply a delivery contact without the postal triplet', () => {
    const onApply = jest.fn();
    render(<CashierNewSaleDetailsModal {...base({ channel: OrderType.Delivery, onApply })} />);

    fireEvent.change(screen.getByLabelText('cashier.new_sale.details_address'), { target: { value: 'Street 1' } });
    fireEvent.click(screen.getByRole('button', { name: 'cashier.new_sale.details_apply' }));

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getAllByText('cashier.new_sale.details_required').length).toBeGreaterThan(0);
  });

  it('applies a complete delivery address with the instructions', () => {
    const onApply = jest.fn();
    render(<CashierNewSaleDetailsModal {...base({ channel: OrderType.Delivery, onApply })} />);

    fireEvent.change(screen.getByLabelText('cashier.new_sale.details_address'), { target: { value: 'Street 1' } });
    fireEvent.change(screen.getByLabelText('cashier.new_sale.details_city'), { target: { value: 'Genève' } });
    fireEvent.change(screen.getByLabelText('cashier.new_sale.details_postal'), { target: { value: '1201' } });
    fireEvent.change(screen.getByLabelText('cashier.new_sale.details_country'), { target: { value: 'CH' } });
    fireEvent.change(screen.getByLabelText('cashier.new_sale.details_instructions'), {
      target: { value: 'Ring twice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'cashier.new_sale.details_apply' }));

    expect(onApply).toHaveBeenCalledWith({
      deliveryAddress: {
        addressLine1: 'Street 1',
        addressLine2: undefined,
        city: 'Genève',
        postalCode: '1201',
        country: 'CH',
        deliveryInstructions: 'Ring twice',
      },
    });
  });

  it('closes from the cancel button', () => {
    const onClose = jest.fn();
    render(<CashierNewSaleDetailsModal {...base({ onClose })} />);

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
