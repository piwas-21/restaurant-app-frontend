import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { OrderType } from '@/types/order';
import EditOrderTypeModal from './EditOrderTypeModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

// Stub the shared toggle: this unit tests the modal's wiring (title, Cancel,
// onPick passthrough); the toggle itself has its own tests. OrderType is a
// string enum, so the mock passes the literal value it resolves to.
jest.mock('./OrderTypeToggle', () => ({
  __esModule: true,
  default: ({ onPick }: { onPick: (t: string) => void }) => (
    <button type="button" onClick={() => onPick('Delivery')}>
      pick-delivery
    </button>
  ),
}));

describe('EditOrderTypeModal', () => {
  it('renders the toggle when open and forwards the picked type', () => {
    const onPick = jest.fn();
    render(<EditOrderTypeModal isOpen onClose={jest.fn()} onPick={onPick} />);

    expect(screen.getByText('Change order type')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'pick-delivery' }));
    expect(onPick).toHaveBeenCalledWith(OrderType.Delivery);
  });

  it('closes via Cancel', () => {
    const onClose = jest.fn();
    render(<EditOrderTypeModal isOpen onClose={onClose} onPick={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
