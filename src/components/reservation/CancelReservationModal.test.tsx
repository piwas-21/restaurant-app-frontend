import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CancelReservationModal from './CancelReservationModal';

// Stub react-i18next so t() returns the English fallback without a provider.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('CancelReservationModal', () => {
  const base = {
    isOpen: true as boolean,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  afterEach(() => jest.clearAllMocks());

  it('renders nothing while closed (BaseModal evaluates children even then)', () => {
    render(<CancelReservationModal {...base} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Are you sure you want to cancel this reservation?')).not.toBeInTheDocument();
  });

  it('renders the confirm question with both actions when open', () => {
    render(<CancelReservationModal {...base} />);
    expect(screen.getByRole('dialog', { name: 'Cancel Reservation' })).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to cancel this reservation?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel Reservation' })).toBeEnabled();
  });

  it('fires onConfirm from the destructive action and onCancel from the quiet one', () => {
    render(<CancelReservationModal {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Reservation' }));
    expect(base.onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(base.onCancel).toHaveBeenCalledTimes(1);
  });

  it('closes via the BaseModal X button', () => {
    render(<CancelReservationModal {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(base.onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables both actions and shows progress while cancelling', () => {
    render(<CancelReservationModal {...base} isLoading />);
    expect(screen.getByRole('button', { name: 'Cancelling...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
