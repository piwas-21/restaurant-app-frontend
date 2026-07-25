import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { type ReservationDto, ReservationStatus } from '@/types/reservation';
import MyReservationCard from './MyReservationCard';
import styles from '@/components/reservation/MyReservations.module.css';

// Stub react-i18next: t() returns the English fallback; the card reads the
// ACTIVE locale for dates (the hardcoded en-US bug fix), so expose one here.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'de' },
  }),
}));

const reservation: ReservationDto = {
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
  specialRequests: 'Corner table if possible',
  notes: 'Anniversary',
  createdAt: '2026-10-01T00:00:00Z',
};

const baseProps = {
  reservation,
  expanded: false,
  onToggleExpanded: jest.fn(),
  onRequestCancel: jest.fn(),
  cancelling: false,
  styles,
};

afterEach(() => jest.clearAllMocks());

describe('MyReservationCard', () => {
  it('formats the date with the ACTIVE i18next locale, not en-US', () => {
    render(<MyReservationCard {...baseProps} />);
    const expected = new Date('2026-10-24').toLocaleDateString('de', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.getByText('19:30 - 21:30')).toBeInTheDocument();
    expect(screen.getByText('2 guests')).toBeInTheDocument();
  });

  it.each([
    [ReservationStatus.Pending, 'Pending', 'warning'],
    [ReservationStatus.Confirmed, 'Confirmed', 'success'],
    [ReservationStatus.Cancelled, 'Cancelled', 'neutral'],
    [ReservationStatus.Completed, 'Completed', 'info'],
    [ReservationStatus.NoShow, 'NoShow', 'danger'],
  ])('status %s renders a "%s" StatusBadge with the %s tone class', (status, label, tone) => {
    render(<MyReservationCard {...baseProps} reservation={{ ...reservation, status }} />);
    const badge = screen.getByText(label);
    // The tone class is the regression guard for the old numeric-enum vs
    // label-string switch: the pill used to get NO colour class at all.
    expect(badge).toHaveClass(tone);
    expect(badge).toHaveClass(`status${ReservationStatus[status]}`);
  });

  it('toggles expansion via the chevron button', () => {
    render(<MyReservationCard {...baseProps} />);
    const toggle = screen.getByRole('button', { name: 'Toggle details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(baseProps.onToggleExpanded).toHaveBeenCalledWith('r1');
  });

  it('shows details (restaurant, table, requests, notes) only when expanded', () => {
    const { rerender } = render(<MyReservationCard {...baseProps} />);
    expect(screen.queryByText('Corner table if possible')).not.toBeInTheDocument();

    rerender(<MyReservationCard {...baseProps} expanded />);
    expect(screen.getByRole('button', { name: 'Toggle details' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Restaurant:')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Corner table if possible')).toBeInTheDocument();
    expect(screen.getByText('Anniversary')).toBeInTheDocument();
  });

  it('offers Cancel on pending/confirmed only — and never a Modify stub', () => {
    const { rerender } = render(<MyReservationCard {...baseProps} expanded />);
    const cancel = screen.getByRole('button', { name: 'Cancel Reservation' });
    fireEvent.click(cancel);
    expect(baseProps.onRequestCancel).toHaveBeenCalledWith('r1');
    expect(screen.queryByRole('button', { name: 'Modify' })).not.toBeInTheDocument();

    rerender(
      <MyReservationCard
        {...baseProps}
        expanded
        reservation={{ ...reservation, status: ReservationStatus.Cancelled }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Cancel Reservation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modify' })).not.toBeInTheDocument();
  });

  it('disables the cancel action while a cancellation is in flight', () => {
    render(<MyReservationCard {...baseProps} expanded cancelling />);
    expect(screen.getByRole('button', { name: 'Cancel Reservation' })).toBeDisabled();
  });
});
