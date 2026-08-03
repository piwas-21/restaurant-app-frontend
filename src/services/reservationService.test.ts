/**
 * `reservationService` had no test, and every failure path in it discarded the server's account.
 *
 * A non-2xx already arrives as an `ApiError` carrying `message`, `errors[]`, `status` and (since
 * #401) `cause`. This file used to catch that and rethrow `new Error(error.message || '<English
 * sentence>')`, and turn a `{ success: false }` resolved inside a 200 into the same thing — losing
 * the per-rule list outright and laundering a blank server message into a client-authored one,
 * which is exactly what #401 removed one layer down.
 */

import { apiClient, ApiError } from '@/utils/apiClient';
import { reservationService } from './reservationService';

// Stub the HTTP surface, keep everything else real — `throwServerRefusal` constructs an `ApiError`
// and the callers' `serverMessages` reads it back through `instanceof`.
jest.mock('@/utils/apiClient', () => ({
  ...jest.requireActual('@/utils/apiClient'),
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockPost = apiClient.post as jest.Mock;
const mockDelete = apiClient.delete as jest.Mock;
const mockGet = apiClient.get as jest.Mock;

beforeEach(() => jest.clearAllMocks());

/** The failure the call produced, as the object a caller's `catch` receives. */
async function captureFailure(call: () => Promise<unknown>): Promise<ApiError> {
  try {
    await call();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the call to reject, and it resolved');
}

/**
 * The `!response.success` guards, driven directly.
 *
 * **For create/cancel/confirm/delete they are defensive, not a path production takes** —
 * `ReservationsController` answers `result.Success ? Ok(result) : BadRequest(result)` on all four,
 * so a refusal is a 400 and `apiClient` has already thrown by the time the service looks at
 * `success`. What these pin is the SHAPE the guard produces if that ever changes, and that it no
 * longer invents English — which is why the mocks resolve a body those actions would not send.
 *
 * **`available-slots` is the opposite and the distinction is per-ACTION, not per-controller**: it
 * ends `return Ok(await _mediator.SendQuery(…))` with no `Success` test, so all three of the
 * handler's `Failure` answers arrive as a 200 carrying `{success:false}` and the guard below is
 * the live path. An earlier version of this note offered `grep -c "Ok(ApiResponse.*Failure"`
 * returning 0 as evidence that 200-wrapped failures do not exist. That grep tests an INLINE shape
 * no controller in this codebase writes; the real shape is a handler returning `Failure` through a
 * controller's `return Ok(result)`, and there are 76 `return Ok(result)` sites against 99 files
 * that build one.
 */
describe('a failure the guard catches keeps its shape', () => {
  it('carries the per-rule list, which the old re-wrap dropped entirely', async () => {
    mockPost.mockResolvedValue({ success: false, message: 'Operation failed', errors: ['Table is already booked'] });

    const error = await captureFailure(() => reservationService.createReservation({} as never));

    expect(error.message).toBe('Operation failed');
    expect(error.errors).toEqual(['Table is already booked']);
    // 200 is what the transport returned; `throwServerRefusal` does not invent a failure status.
    expect(error.status).toBe(200);
  });

  it('leaves the message EMPTY when the server authored none, rather than inventing English', async () => {
    // The old code substituted 'Failed to create reservation' here, so a caller's own translated
    // sentence could never win — the same defect as #401, one layer up.
    mockPost.mockResolvedValue({ success: false });

    const error = await captureFailure(() => reservationService.createReservation({} as never));

    expect(error.message).toBe('');
  });

  it('ignores a non-array `errors` rather than passing it through', async () => {
    mockPost.mockResolvedValue({ success: false, message: 'Nope', errors: 'not an array' });

    const error = await captureFailure(() => reservationService.createReservation({} as never));

    expect(error.errors).toBeUndefined();
  });

  it.each([
    ['cancelReservation', () => reservationService.cancelReservation('r1')],
    ['confirmReservation', () => reservationService.confirmReservation('r1')],
  ])('applies to %s too, not only create', async (_label, call) => {
    mockPost.mockResolvedValue({ success: false, errors: ['Reservation is already cancelled'] });

    const error = await captureFailure(call);

    expect(error.errors).toEqual(['Reservation is already cancelled']);
  });

  it('applies to deleteReservation, which goes through a different verb', async () => {
    mockDelete.mockResolvedValue({ success: false, errors: ['Reservation is in the past'] });

    const error = await captureFailure(() => reservationService.deleteReservation('r1'));

    expect(error.errors).toEqual(['Reservation is in the past']);
  });
});

describe('a non-2xx propagates unchanged', () => {
  it('does not re-wrap the ApiError, so status, errors and cause all survive', async () => {
    const cause = new TypeError('Failed to fetch');
    const thrown = new ApiError(0, '', undefined, undefined, { cause });
    mockGet.mockRejectedValue(thrown);

    const error = await captureFailure(() => reservationService.getAvailableTimeSlots('2026-08-10', 2));

    expect(error).toBe(thrown);
    expect(error.status).toBe(0);
    expect(error.cause).toBe(cause);
  });
});

describe('getAvailableTimeSlots reports a refusal without throwing', () => {
  it("prefers the server's per-rule reason over the summary wrapper", async () => {
    // A REAL refusal string this time. The fixture used to be 'No tables available for 8 guests',
    // which the backend has never sent — `GetAvailableTimeSlotsQueryHandler` has three `Failure`
    // strings and none mentions capacity. It existed to prove an `isCapacityIssue` flag that was
    // therefore always false; the flag is gone and this keeps the half that was real.
    mockGet.mockResolvedValue({
      success: false,
      message: 'Operation failed',
      errors: ['No active tables found'],
    });

    const result = await reservationService.getAvailableTimeSlots('2026-08-10', 8);

    expect(result.data).toBeNull();
    expect(result.error).toBe('No active tables found');
  });

  it('drops a BLANK entry instead of returning it as the reason', async () => {
    // The old chain gated on `errors.length > 0`, so `['']` was returned verbatim — and the
    // (now deleted) `isCapacityIssue` derivation below it then ran `''.toLowerCase().includes(…)`.
    mockGet.mockResolvedValue({ success: false, errors: [''], message: 'Slots unavailable' });

    const result = await reservationService.getAvailableTimeSlots('2026-08-10', 2);

    expect(result.error).toBe('Slots unavailable');
  });

  it('leaves `error` undefined when the server authored nothing — `data: null` is the flag', async () => {
    // This used to return a client-authored English literal so that `error` could double as the
    // failure flag. It made the two cases indistinguishable to the caller, which is why
    // `useReservationAvailability` rendered neither and emptied the dropdown in silence. The flag
    // is `data === null`; `error` now carries only what is fit to show a user.
    mockGet.mockResolvedValue({ success: false });

    const result = await reservationService.getAvailableTimeSlots('2026-08-10', 2);

    expect(result.data).toBeNull();
    expect(result.error).toBeUndefined();
  });

  it('returns the slots on success', async () => {
    mockGet.mockResolvedValue({ success: true, data: { timeSlots: [{ time: '19:00' }] } });

    const result = await reservationService.getAvailableTimeSlots('2026-08-10', 2);

    expect(result.data).toEqual({ timeSlots: [{ time: '19:00' }] });
    expect(result.error).toBeUndefined();
  });
});
