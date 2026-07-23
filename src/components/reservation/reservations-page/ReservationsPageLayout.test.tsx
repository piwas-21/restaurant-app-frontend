import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { TableDto } from '@/types/reservation';
import { useReservationsPage } from '@/hooks/reservations/useReservationsPage';
import ReservationsPageLayout from './ReservationsPageLayout';
import chrome from '@/app/styles/ReservationsPage.module.css';
import panel from '@/app/styles/ReservationsBookingPanel.module.css';
import floorPlan from '@/components/reservation/VisualTableLayout.module.css';
import guests from '@/components/reservation/GuestSelector.module.css';
import dateTime from '@/components/reservation/DateTimeSelector.module.css';
import selectedTables from '@/components/reservation/SelectedTableInfo.module.css';
import capacity from '@/components/reservation/CapacityWarning.module.css';

// Interpolating t-stub so headings/labels render their English fallbacks.
const t = (_key: string, fallback: string, opts?: Record<string, unknown>) =>
  fallback.replace(/{{(\w+)}}/g, (_m, k: string) => String(opts?.[k] ?? ''));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, f?: string, o?: Record<string, unknown>) =>
      (f ?? _k).replace(/{{(\w+)}}/g, (_m, k: string) => String(o?.[k] ?? '')),
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/hooks/reservations/useReservationsPage', () => ({
  useReservationsPage: jest.fn(),
}));

jest.mock('@/hooks/useRestaurantInfo', () => ({
  useRestaurantInfo: () => ({ info: null, isLoading: false, error: null, refetch: jest.fn() }),
}));

// The success modal needs AuthContext; the layout only mounts it closed.
jest.mock('@/components/reservation/ReservationSuccessModal', () => ({
  __esModule: true,
  default: function MockReservationSuccessModal() {
    return null;
  },
}));

const mockUseReservationsPage = useReservationsPage as jest.Mock;

const table: TableDto = {
  id: 'a',
  tableNumber: '4',
  maxGuests: 4,
  isActive: true,
  isOutdoor: false,
  positionX: 300,
  positionY: 250,
};

const styles = {
  page: { ...chrome, ...panel },
  floorPlan,
  guests,
  dateTime,
  selectedTables,
  capacity,
};

const baseState = {
  t,
  allTables: [table],
  selectedTableIds: ['a'],
  bookedTableIds: [],
  selectedTables: [table],
  timeSlotOptions: [{ time: '18:00', available: true }],
  capacityWarning: false,
  handleTableSelect: jest.fn(),
  selectedDate: '',
  setSelectedDate: jest.fn(),
  selectedTime: '',
  setSelectedTime: jest.fn(),
  numberOfGuests: 2,
  setNumberOfGuests: jest.fn(),
  loading: false,
  customerName: '',
  setCustomerName: jest.fn(),
  customerEmail: '',
  setCustomerEmail: jest.fn(),
  customerPhone: '',
  setCustomerPhone: jest.fn(),
  specialRequests: '',
  setSpecialRequests: jest.fn(),
  requestCombineTables: false,
  setRequestCombineTables: jest.fn(),
  submitting: false,
  canSubmit: true,
  handleSubmit: jest.fn((e: React.FormEvent) => e.preventDefault()),
  showSuccessModal: false,
  handleCloseSuccessModal: jest.fn(),
};

describe('ReservationsPageLayout', () => {
  beforeEach(() => {
    mockUseReservationsPage.mockReturnValue(baseState);
  });

  it('renders the full booking page: heading, floor plan, docket line and submit', () => {
    render(<ReservationsPageLayout styles={styles} />);

    expect(screen.getByRole('heading', { name: 'Make a Reservation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Select your Table/ })).toBeInTheDocument();
    // The selected table renders on the map AND as a docket line.
    expect(screen.getByRole('button', { name: 'Table 4, 4 seats, Selected' })).toBeInTheDocument();
    expect(screen.getByText(/4 seats/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Book Now' })).toBeEnabled();
  });

  it('disables the submit button while a booking cannot be submitted', () => {
    mockUseReservationsPage.mockReturnValue({ ...baseState, canSubmit: false });
    render(<ReservationsPageLayout styles={styles} />);
    expect(screen.getByRole('button', { name: 'Book Now' })).toBeDisabled();
  });

  it('shows the capacity notice only when the hook flags it', () => {
    const { rerender } = render(<ReservationsPageLayout styles={styles} />);
    expect(screen.queryByText('Capacity Notice')).not.toBeInTheDocument();

    mockUseReservationsPage.mockReturnValue({ ...baseState, capacityWarning: true });
    rerender(<ReservationsPageLayout styles={styles} />);
    expect(screen.getByText('Capacity Notice')).toBeInTheDocument();
  });
});
