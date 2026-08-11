/**
 * `parseCustomerDiscountError` had no test, and returned its fallback for **every** input.
 *
 * It unwrapped `error.response.data` — the axios error envelope — and axios is not a dependency
 * in this app, so that read was always `undefined` and the function returned on its second line.
 * The user-not-found and already-exists routing below it, which is the reason it exists, had
 * never run once.
 *
 * These use what `adminFidelityService` actually throws: an `ApiError` from `apiClient`.
 */

// Through the ALIAS, so `instanceof ApiError` inside `serverMessages` resolves to the same class.
import { ApiError } from '@/utils/apiClient';
import type { TFunction } from 'i18next';
import { parseCustomerDiscountError } from './customerDiscountForm';

// Mirrors i18next closely enough: returns the inline fallback, interpolating `{{userId}}`.
const t = ((key: string, fallback?: string, opts?: Record<string, unknown>) =>
  (fallback ?? key).replace(/{{(\w+)}}/g, (_m, name) => String(opts?.[name] ?? ''))) as unknown as TFunction;

const USER_ID = 'e2c1-user';

describe('parseCustomerDiscountError', () => {
  it('rewords a user-not-found into an actionable sentence, with the id interpolated', () => {
    const error = new ApiError(404, 'Validation failed', ['User with ID "e2c1-user" was not found']);

    expect(parseCustomerDiscountError(error, false, USER_ID, t)).toBe(
      'User with ID "e2c1-user" was not found. Please verify the user ID and try again.',
    );
  });

  it('rewords a duplicate into "edit the existing one instead"', () => {
    const error = new ApiError(409, 'Validation failed', ['A discount already exists for this user']);

    expect(parseCustomerDiscountError(error, true, USER_ID, t)).toBe(
      'A discount already exists for this user. Please edit the existing discount instead of creating a new one.',
    );
  });

  it("shows any other server sentence verbatim — it is more specific than anything we'd write", () => {
    const error = new ApiError(400, 'Validation failed', ['Discount percentage must be between 1 and 100']);

    expect(parseCustomerDiscountError(error, false, USER_ID, t)).toBe('Discount percentage must be between 1 and 100');
  });

  it('shows every unrecognised reason, not just the first (frontend #490)', () => {
    const error = new ApiError(400, 'Validation failed', [
      'Discount percentage must be between 1 and 100',
      'Start date must be in the future',
    ]);

    expect(parseCustomerDiscountError(error, false, USER_ID, t)).toBe(
      'Discount percentage must be between 1 and 100; Start date must be in the future',
    );
  });

  it('recognises a reason that is not first — backend #291 can reorder it', () => {
    // The old `[0]` read would fall through to the raw server sentence here, losing the actionable
    // reword that is the whole reason this function exists.
    const error = new ApiError(409, 'Validation failed', [
      'Discount percentage must be between 1 and 100',
      'A discount already exists for this user',
    ]);

    expect(parseCustomerDiscountError(error, true, USER_ID, t)).toBe(
      'A discount already exists for this user. Please edit the existing discount instead of creating a new one.',
    );
  });

  it('does NOT assemble a match across two entries', () => {
    // The user-not-found test is an AND of two independent `includes`, so matching against the
    // JOINED string would let "…user…" in one entry and "…not found…" in another satisfy it —
    // rewording a refusal neither entry made, and interpolating a user id nothing complained about.
    // This is why the matcher runs per entry rather than on `messages.join('; ')`.
    const error = new ApiError(400, 'Validation failed', ['Discount user is inactive', 'Tier not found']);

    expect(parseCustomerDiscountError(error, false, USER_ID, t)).toBe('Discount user is inactive; Tier not found');
  });

  it('reads the summary when the server sent no per-rule list', () => {
    expect(parseCustomerDiscountError(new ApiError(400, 'Discount window is closed'), false, USER_ID, t)).toBe(
      'Discount window is closed',
    );
  });

  it('reads the RESOLVED failure shape too, not only the thrown one', () => {
    // Handler failures come back wrapped in `Ok(ApiResponse.Failure(...))`, so they resolve.
    expect(
      parseCustomerDiscountError({ success: false, errors: ['A discount already exists'] }, false, USER_ID, t),
    ).toBe('A discount already exists for this user. Please edit the existing discount instead of creating a new one.');
  });

  it("uses the caller's own translated sentence when the server said nothing", () => {
    // The #401 case: a message-less `ApiError` is what a dead backend produces now.
    expect(parseCustomerDiscountError(new ApiError(0, ''), false, USER_ID, t)).toBe('Failed to create discount');
    expect(parseCustomerDiscountError(new ApiError(500, '   '), true, USER_ID, t)).toBe('Failed to update discount');
  });

  it('does not render a client-side throw', () => {
    expect(parseCustomerDiscountError(new TypeError('Failed to fetch'), false, USER_ID, t)).toBe(
      'Failed to create discount',
    );
    expect(parseCustomerDiscountError(null, true, USER_ID, t)).toBe('Failed to update discount');
  });

  it('picks the create or update wording from the flag', () => {
    expect(parseCustomerDiscountError(null, false, USER_ID, t)).toBe('Failed to create discount');
    expect(parseCustomerDiscountError(null, true, USER_ID, t)).toBe('Failed to update discount');
  });
});
