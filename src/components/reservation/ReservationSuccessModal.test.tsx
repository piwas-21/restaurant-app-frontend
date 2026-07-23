import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ReservationSuccessModal from './ReservationSuccessModal';

// Stub react-i18next so t() returns the English fallback without a provider.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

let mockUser: { id: string } | null = null;
jest.mock('@/components/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

describe('ReservationSuccessModal', () => {
  const base = {
    isOpen: true as boolean,
    onClose: jest.fn(),
    customerEmail: 'guest@example.com',
    numberOfTables: 1,
  };

  afterEach(() => {
    jest.clearAllMocks();
    mockUser = null;
  });

  it('renders nothing while closed (BaseModal evaluates children even then)', () => {
    render(<ReservationSuccessModal {...base} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('guest@example.com')).not.toBeInTheDocument();
  });

  it('shows the pending title and the confirmation email address', () => {
    render(<ReservationSuccessModal {...base} />);
    expect(screen.getByRole('dialog', { name: 'Pending Confirmation' })).toBeInTheDocument();
    expect(screen.getByText('guest@example.com')).toBeInTheDocument();
  });

  it('uses the plural pending message when more than one table was booked', () => {
    render(<ReservationSuccessModal {...base} numberOfTables={2} />);
    expect(screen.getByText(/Your reservations are currently pending/)).toBeInTheDocument();
  });

  it('uses the singular pending message for a single table', () => {
    render(<ReservationSuccessModal {...base} numberOfTables={1} />);
    expect(screen.getByText(/Your reservation is currently pending/)).toBeInTheDocument();
  });

  it('guest branch: login CTA + account note, login navigates to /auth/login', () => {
    render(<ReservationSuccessModal {...base} />);
    expect(screen.getByRole('button', { name: 'Login to Track Your Reservation' })).toBeInTheDocument();
    expect(screen.getByText(/Create an account/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View My Reservations' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Login to Track Your Reservation' }));
    expect(mockPush).toHaveBeenCalledWith('/auth/login');
  });

  it('logged-in branch: view-reservations CTA navigates to /my-reservations', () => {
    mockUser = { id: 'u1' };
    render(<ReservationSuccessModal {...base} />);
    expect(screen.queryByRole('button', { name: 'Login to Track Your Reservation' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Create an account/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View My Reservations' }));
    expect(mockPush).toHaveBeenCalledWith('/my-reservations');
  });

  it('"Make Another Reservation" closes the dialog in both branches', () => {
    const onClose = jest.fn();
    const { unmount } = render(<ReservationSuccessModal {...base} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make Another Reservation' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    mockUser = { id: 'u1' };
    render(<ReservationSuccessModal {...base} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make Another Reservation' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
