import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import { type ReservationDto, ReservationStatus } from '@/types/reservation';
import { reservationService } from '@/services/reservationService';
import EditReservationModal from './EditReservationModal';
import guests from './GuestSelector.module.css';
import dateTime from './DateTimeSelector.module.css';

// Interpolating t-stub: the English fallback with {{vars}} filled, so assertions read the
// rendered sentence rather than a key.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, f?: string, o?: Record<string, unknown>) =>
      (f ?? _k).replace(/{{(\w+)}}/g, (_m, k: string) => String(o?.[k] ?? '')),
    i18n: { language: 'en' },
  }),
}));

// Integration cut: the REAL useEditReservation + useReservationAvailability drive the dialog, so
// the body asserted below is the one the app would actually PUT. Only the boundaries are stubbed.
jest.mock('@/services/reservationService', () => ({
  reservationService: {
    getTables: jest.fn(),
    getAvailableTimeSlots: jest.fn(),
    updateMyReservation: jest.fn(),
  },
}));

jest.mock('@/hooks/useTenantToday', () => ({ useTenantToday: jest.fn(() => '2026-10-01') }));

jest.mock('@/hooks/useCustomerFormFields', () => ({
  useCustomerFormFields: () => ({ rules: {} }),
}));

jest.mock('notistack', () => ({ enqueueSnackbar: jest.fn() }));

const mockGetTables = reservationService.getTables as jest.Mock;
const mockGetSlots = reservationService.getAvailableTimeSlots as jest.Mock;
const mockUpdate = reservationService.updateMyReservation as jest.Mock;

const table = {
  id: 't1',
  tableNumber: '4',
  maxGuests: 6,
  isActive: true,
  isOutdoor: false,
  positionX: 0,
  positionY: 0,
};

const reservation: ReservationDto = {
  id: 'r1',
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  customerPhone: '+41 79 000 00 00',
  tableId: 't1',
  tableNumber: '4',
  reservationDate: '2026-10-24',
  startTime: '19:30:00',
  endTime: '21:30:00',
  numberOfGuests: 2,
  status: ReservationStatus.Confirmed,
  specialRequests: 'Window seat',
  createdAt: '2026-10-01T00:00:00Z',
};

const otherTable = { ...table, id: 't9', tableNumber: '9' };

const slots = [
  // 19:30 — the booking's own slot: its table is busy with this very reservation.
  { startTime: '19:30:00', endTime: '21:30:00', availableTables: [] },
  { startTime: '20:00:00', endTime: '22:00:00', availableTables: [table] },
  // 20:30 — a free table, but not THIS booking's one, and the party is never re-seated.
  { startTime: '20:30:00', endTime: '22:30:00', availableTables: [otherTable] },
];

const onSaved = jest.fn();
const onClose = jest.fn();

const renderModal = (booking: ReservationDto = reservation) =>
  render(
    <EditReservationModal reservation={booking} onClose={onClose} onSaved={onSaved} styles={{ guests, dateTime }} />,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTables.mockResolvedValue([table]);
  mockGetSlots.mockResolvedValue({ data: { date: '2026-10-24', timeSlots: slots } });
});

/** The date/time/party controls, found through their visible labels. */
const dateInput = () => screen.getByLabelText(/Or pick a date/) as HTMLInputElement;
const timeSelect = () => screen.getByLabelText(/Or select time/) as HTMLSelectElement;
const guestInput = () => screen.getByLabelText(/Or custom/) as HTMLInputElement;

describe('EditReservationModal', () => {
  it('prefills every control from the booking being changed', async () => {
    renderModal();

    await waitFor(() => expect(dateInput()).toHaveValue('2026-10-24'));
    expect(timeSelect()).toHaveValue('19:30');
    expect(guestInput()).toHaveValue(2);
    expect(screen.getByLabelText('Your Name')).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText('Your Email')).toHaveValue('ada@example.com');
    expect(screen.getByLabelText('Your Phone')).toHaveValue('+41 79 000 00 00');
    expect(screen.getByLabelText('Special requests')).toHaveValue('Window seat');
  });

  it('starts the optional fields empty when the booking carries none', async () => {
    renderModal({ ...reservation, customerPhone: null, specialRequests: undefined });
    await waitFor(() => expect(screen.getByLabelText('Your Phone')).toHaveValue(''));
    expect(screen.getByLabelText('Special requests')).toHaveValue('');
  });

  it('asks the SAME available-slots query the booking page uses, for the booking day and party', async () => {
    renderModal();
    await waitFor(() => expect(mockGetSlots).toHaveBeenCalledWith('2026-10-24', 2));
  });

  it("keeps the booking's own slot selectable even though its table is (by itself) taken", async () => {
    // 19:30 comes back with an empty availableTables — occupied by this very reservation. Marking
    // it unavailable would lock the guest out of changing only the party size or the note.
    renderModal();
    await waitFor(() => expect(timeSelect()).toHaveValue('19:30'));
    const options = Array.from(timeSelect().querySelectorAll('option'));
    expect(options.find((o) => o.value === '19:30')).not.toBeDisabled();
  });

  it('refuses a slot where some OTHER table is free — the party is never re-seated', async () => {
    renderModal();
    await waitFor(() => expect(timeSelect()).toHaveValue('19:30'));
    const options = Array.from(timeSelect().querySelectorAll('option'));
    expect(options.find((o) => o.value === '20:00')).not.toBeDisabled();
    // 20:30 has a free table, but it is table 9 and this booking sits at table 1.
    expect(options.find((o) => o.value === '20:30')).toBeDisabled();
  });

  it('PUTs the exact contract body — local HH:mm:ss times, no status, no tableId', async () => {
    mockUpdate.mockResolvedValue({ ...reservation, numberOfGuests: 4 });
    renderModal();
    await waitFor(() => expect(dateInput()).toHaveValue('2026-10-24'));

    fireEvent.change(timeSelect(), { target: { value: '20:00' } });
    fireEvent.change(guestInput(), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Special requests'), { target: { value: 'Birthday' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith('r1', {
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.com',
      customerPhone: '+41 79 000 00 00',
      reservationDate: '2026-10-24T00:00:00Z',
      // The slot's own end, and both times as wall-clock strings: `toISOString()` here is the
      // defect the mobile client shipped (an ISO datetime does not bind to a TimeSpan, and the
      // UTC conversion moved the booking by the client's offset).
      startTime: '20:00:00',
      endTime: '22:00:00',
      numberOfGuests: 4,
      specialRequests: 'Birthday',
    });
    const body = mockUpdate.mock.calls[0][1];
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('tableId');
  });

  it('confirms the save, refreshes the list behind it, and stops offering Save', async () => {
    mockUpdate.mockResolvedValue(reservation);
    renderModal();
    await waitFor(() => expect(dateInput()).toHaveValue('2026-10-24'));

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const done = await screen.findByRole('status');
    expect(done).toHaveTextContent('Your booking has been updated');
    // The booking came back Confirmed, exactly as it went in: nothing to re-approve.
    expect(done).not.toHaveTextContent('has to approve');
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    // The footer's own Close; BaseModal's X reads "Close" too.
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  it('says so when re-shaping a CONFIRMED booking sent it back to Pending', async () => {
    // Contract §2.1: day/time/party changes drop a Confirmed booking to Pending, and §3: the
    // backend mails NOBODY on this route — so this sentence is the only place a guest can learn it.
    mockUpdate.mockResolvedValue({ ...reservation, status: ReservationStatus.Pending });
    renderModal();
    await waitFor(() => expect(dateInput()).toHaveValue('2026-10-24'));

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('status')).toHaveTextContent('The restaurant has to approve the new time');
  });

  it('stays quiet about approval when the booking was already Pending', async () => {
    mockUpdate.mockResolvedValue({ ...reservation, status: ReservationStatus.Pending });
    renderModal({ ...reservation, status: ReservationStatus.Pending });
    await waitFor(() => expect(dateInput()).toHaveValue('2026-10-24'));

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const done = await screen.findByRole('status');
    expect(done).toHaveTextContent('Your booking has been updated');
    expect(done).not.toHaveTextContent('has to approve');
  });

  it("shows the SERVER's reason when the save is refused, and keeps the form open", async () => {
    mockUpdate.mockRejectedValue(new ApiError(400, 'Operation failed', ['This time slot is no longer available']));
    renderModal();
    await waitFor(() => expect(dateInput()).toHaveValue('2026-10-24'));

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    // Not "Operation failed" — that is the generic wrapper around the real reason, and not
    // the client's own English either.
    expect(await screen.findByRole('alert')).toHaveTextContent('This time slot is no longer available');
    expect(screen.queryByText('Operation failed')).not.toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();

    // Dismiss via the alert's own button (the dialog's X reads "Close" as well).
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('falls back to its own translated sentence when the server authored none', async () => {
    mockUpdate.mockRejectedValue(new TypeError('Failed to fetch'));
    renderModal();
    await waitFor(() => expect(dateInput()).toHaveValue('2026-10-24'));

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    // `Failed to fetch` is ours, not the server's — showing it to a guest is worse than nothing.
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to update the reservation');
  });

  it('cannot be saved with no time picked', async () => {
    mockGetSlots.mockResolvedValue({ data: { date: '2026-10-24', timeSlots: slots } });
    renderModal({ ...reservation, startTime: '05:00:00' });

    // 05:00 is not a slot the day offers, so the availability hook clears it: nothing to save onto.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled());
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
