import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type ReservationDto, ReservationStatus } from '@/types/reservation';
import MyReservationsLayout from './MyReservationsLayout';
import { reservationService } from '@/services/reservationService';
import cardStyles from '@/components/reservation/MyReservations.module.css';

// Stub react-i18next so t() returns the English fallback without a provider.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

// Integration cut: the REAL useMyReservations hook drives the layout; only
// the service boundary is mocked (loads, cancel flow, error paths).
jest.mock('@/services/reservationService', () => ({
  reservationService: {
    getReservations: jest.fn(),
    cancelReservation: jest.fn(),
  },
}));

const mockGetReservations = reservationService.getReservations as jest.Mock;
const mockCancelReservation = reservationService.cancelReservation as jest.Mock;

const pending: ReservationDto = {
  id: 'r1',
  customerName: 'Ada',
  customerEmail: 'ada@example.com',
  tableId: 't1',
  tableNumber: '4',
  reservationDate: '2026-10-24',
  startTime: '19:30:00',
  endTime: '21:30:00',
  numberOfGuests: 2,
  status: ReservationStatus.Pending,
  createdAt: '2026-10-01T00:00:00Z',
};

const cancelled: ReservationDto = {
  ...pending,
  id: 'r2',
  status: ReservationStatus.Cancelled,
};

const paged = (items: ReservationDto[]) => ({
  items,
  totalCount: items.length,
  page: 1,
  pageSize: 50,
  totalPages: 1,
});

// Hand-built page bundle WITHOUT tapeLabel — the classic shape (the CSS-proxy
// mock would define every key, defeating the craft-only gating under test).
const classicPage: Readonly<Record<string, string>> = {
  container: 'container',
  section: 'section',
  sectionTitle: 'sectionTitle',
  loadingText: 'loadingText',
  error: 'error',
  emptyState: 'emptyState',
  emptyIllustration: 'emptyIllustration',
  emptyText: 'emptyText',
  emptyCta: 'emptyCta',
  reservationsList: 'reservationsList',
  errorAlert: 'errorAlert',
};

const craftPage: Readonly<Record<string, string>> = { ...classicPage, tapeLabel: 'tapeLabel' };

const renderLayout = (page: Readonly<Record<string, string>> = classicPage) =>
  render(<MyReservationsLayout styles={{ page, card: cardStyles }} />);

afterEach(() => jest.clearAllMocks());

describe('MyReservationsLayout', () => {
  it('shows the loading note, then the docket cards with WORKING status colours', async () => {
    mockGetReservations.mockResolvedValue(paged([pending, cancelled]));
    renderLayout();

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    const badge = await screen.findByText('Pending');
    expect(badge).toHaveClass('warning'); // enum-vs-label bug regression guard
    expect(screen.getByText('Cancelled')).toHaveClass('neutral');
    expect(screen.getAllByText('2 guests')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Modify' })).not.toBeInTheDocument();
  });

  it('renders the designed empty state with a booking CTA to /reservations', async () => {
    mockGetReservations.mockResolvedValue(paged([]));
    renderLayout();

    expect(await screen.findByText('No bookings yet')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: 'Book a table' });
    expect(cta).toHaveAttribute('href', '/reservations');
  });

  it('gates the masking-tape label on the template module defining it', async () => {
    mockGetReservations.mockResolvedValue(paged([]));
    const { unmount } = renderLayout(classicPage);
    await screen.findByText('No bookings yet');
    expect(screen.queryByText('Your reservations')).not.toBeInTheDocument();
    unmount();

    mockGetReservations.mockResolvedValue(paged([]));
    renderLayout(craftPage);
    await screen.findByText('No bookings yet');
    expect(screen.getByText('Your reservations')).toBeInTheDocument();
  });

  it('surfaces a load failure as the page error state', async () => {
    mockGetReservations.mockRejectedValue(new Error('boom'));
    renderLayout();
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  it('falls back to the generic error copy when the failure carries no message', async () => {
    // Non-Error rejection exercises the errorMessage() fallback branch.
    mockGetReservations.mockRejectedValue('kaboom');
    renderLayout();
    expect(await screen.findByText('Failed to load reservations')).toBeInTheDocument();
  });

  it('runs the full cancel flow: confirm dialog → service call → success modal → refetch', async () => {
    mockGetReservations.mockResolvedValue(paged([pending]));
    mockCancelReservation.mockResolvedValue(undefined);
    renderLayout();

    fireEvent.click(await screen.findByRole('button', { name: 'Toggle details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Reservation' }));

    // The confirm dialog (BaseModal) opens with its own destructive action.
    const dialog = await screen.findByRole('dialog', { name: 'Cancel Reservation' });
    expect(dialog).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole('button', { name: 'Cancel Reservation' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mockCancelReservation).toHaveBeenCalledWith('r1'));
    const successDialog = await screen.findByRole('dialog', { name: 'Reservation cancelled successfully' });
    expect(mockGetReservations).toHaveBeenCalledTimes(2);

    // Close the success dialog via its footer button (X reads "Close" too).
    const closeButtons = within(successDialog).getAllByRole('button', { name: 'Close' });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Reservation cancelled successfully' })).not.toBeInTheDocument(),
    );
  });

  it('dismisses the confirm dialog via its quiet Cancel action without cancelling', async () => {
    mockGetReservations.mockResolvedValue(paged([pending]));
    renderLayout();

    fireEvent.click(await screen.findByRole('button', { name: 'Toggle details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Reservation' }));
    await screen.findByRole('dialog', { name: 'Cancel Reservation' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cancel Reservation' })).not.toBeInTheDocument());
    expect(mockCancelReservation).not.toHaveBeenCalled();
  });

  it('shows a dismissible toast when cancellation fails', async () => {
    mockGetReservations.mockResolvedValue(paged([pending]));
    mockCancelReservation.mockRejectedValue(new Error('cancel failed'));
    renderLayout();

    fireEvent.click(await screen.findByRole('button', { name: 'Toggle details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Reservation' }));
    const confirmButtons = await screen.findAllByRole('button', { name: 'Cancel Reservation' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    const message = await screen.findByText('cancel failed');
    // Dismiss via the toast's own button (the still-open dialog's X also
    // reads "Close", so scope the query to the alert box).
    const alertBox = message.parentElement as HTMLElement;
    fireEvent.click(within(alertBox).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByText('cancel failed')).not.toBeInTheDocument());
  });
});
