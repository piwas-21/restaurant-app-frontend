/**
 * How large a party the reservation forms may offer — ONE number, derived where the API carries
 * the answer and mirrored from the backend where it does not.
 *
 * The picker used to offer 50 (`max="50"` in `GuestSelector`) while the backend refused anything
 * over 20, so a guest filled the whole form and met a `400` (frontend #557).
 */
import type { TableDto } from '@/types/reservation';

/**
 * The hard ceiling on `numberOfGuests`, mirrored from the backend DTOs.
 *
 * **Mirrors `[Range(1, 20)]` on `NumberOfGuests` in all three reservation DTOs** —
 * `backend/RestaurantSystem.Api/Features/Reservations/Dtos/{CreateReservationDto,
 * UpdateReservationDto,UpdateMyReservationDto}.cs`. It is a DataAnnotation, so it is enforced
 * during model binding and refused as `ValidationProblemDetails`, not as the `ApiResponse`
 * envelope (see `problemDetails.ts`).
 *
 * **No API carries this number** — measured, not assumed: there is no reservation settings or
 * config endpoint, and `available-slots`, `GET /api/tables` and the floor plan all carry only
 * per-TABLE `maxGuests`. So it is hardcoded exactly once, here, and every guest picker reads it
 * from this module. If the backend range changes, this constant changes with it.
 */
export const RESERVATION_GUEST_CAP = 20;

/** The smallest party the backend accepts — the other end of the same `[Range(1, 20)]`. */
export const RESERVATION_GUEST_MIN = 1;

/** Never offer more than the ceiling, and never offer fewer than one guest. */
function clampToCap(seats: number): number {
  if (!Number.isFinite(seats) || seats < RESERVATION_GUEST_MIN) return RESERVATION_GUEST_CAP;
  return Math.min(RESERVATION_GUEST_CAP, Math.floor(seats));
}

/**
 * The largest party the BOOKING page may offer.
 *
 * Derived from the table list the page has already loaded (`GET /api/tables`, active only) — no
 * extra request. The sum, not the largest table, because that page lets a guest select several
 * tables and ask for them to be combined; the per-table fit is a separate notice
 * (`partyExceedsEveryTable` → `CapacityWarning`), and taking the maximum here would silently
 * retire that flow.
 *
 * An empty or not-yet-loaded list falls back to the DTO ceiling: showing fewer guests than the
 * restaurant has seats is a worse failure than the server refusing an over-sized party, and the
 * list is empty for one render on every visit.
 */
export function maxGuestsForBooking(tables: readonly TableDto[]): number {
  if (tables.length === 0) return RESERVATION_GUEST_CAP;
  return clampToCap(tables.reduce((seats, table) => seats + table.maxGuests, 0));
}

/**
 * The largest party the EDIT modal may offer.
 *
 * `PUT /api/reservations/{id}/mine` carries no `tableId` and the backend never re-seats the party,
 * so the booking is stuck with its own table and the server refuses anything over that table's
 * capacity (`ReservationTableCapacityExceeded`). That capacity is on the page already — the same
 * `GET /api/tables` list the availability hook loads — so the modal can say so BEFORE the save
 * instead of relaying the server's English sentence afterwards (frontend #557, "Related").
 *
 * An unknown table (list still loading, or the booking sits on a table since deactivated) falls
 * back to the DTO ceiling.
 */
export function maxGuestsForTable(table: TableDto | undefined): number {
  return table ? clampToCap(table.maxGuests) : RESERVATION_GUEST_CAP;
}
