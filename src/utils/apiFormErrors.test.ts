// The alias resolves to `__mocks__/@/utils/apiClient.ts`, which shadows the real module tree-wide.
// `routeApiError` imports `ApiError` through the same alias, so constructing one here from anywhere
// else would make its `instanceof` false and every assertion below vacuous.
import { ApiError } from '@/utils/apiClient';
import {
  CUSTOMER_REGISTRATION_MATCHERS,
  STAFF_REGISTRATION_MATCHERS,
  formLevelMessage,
  routeApiError,
  serverMessage,
  serverMessages,
  throwServerRefusal,
} from './apiFormErrors';

/**
 * The reverse direction: turning a resolved `{ success: false }` back INTO the thrown shape, so a
 * service stops having to invent `new Error(response.message || '<English>')` at that boundary.
 */
describe('throwServerRefusal', () => {
  const captured = (response: { message?: string; errors?: unknown; errorCode?: string }): ApiError => {
    try {
      throwServerRefusal(response);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      return error as ApiError;
    }
    throw new Error('expected it to throw, and it returned');
  };

  it('carries the per-rule list, which the re-wraps it replaces dropped entirely', () => {
    const error = captured({ message: 'Operation failed', errors: ['Table is already booked'] });

    expect(error.message).toBe('Operation failed');
    expect(error.errors).toEqual(['Table is already booked']);
  });

  it('leaves the message EMPTY rather than inventing English', () => {
    expect(captured({}).message).toBe('');
  });

  // #435: `errorCode` used to be dropped here, which made the recommended migration off English
  // substring matching impossible for every refusal that arrives inside a 200 — the branch would
  // compile, never fire, and fall through to a substring match that still happened to work, so the
  // dead branch stayed invisible until the backend localised its prose.
  it('forwards errorCode, so a caller can branch on it instead of on English prose', () => {
    const error = captured({ message: 'Operation failed', errorCode: 'ModuleNotEnabled' });

    expect(error.errorCode).toBe('ModuleNotEnabled');
  });

  it('leaves errorCode undefined when the response carries none', () => {
    expect(captured({ message: 'Operation failed' }).errorCode).toBeUndefined();
  });

  it('uses status 200, because 200 is what the transport actually returned', () => {
    // Not 400: an invented 400 reads as an HTTP validation failure to `isValidationError`, with
    // nothing to tell a refusal-inside-a-200 apart from a real one. 200 cannot be mistaken for a
    // transport failure by anything.
    expect(captured({ message: 'Nope' }).status).toBe(200);
  });

  it('ignores a non-array `errors` instead of passing it through', () => {
    expect(captured({ message: 'Nope', errors: 'not an array' }).errors).toBeUndefined();
  });

  it('round-trips through `serverMessages`, which is the point of the shape', () => {
    expect(serverMessages(captured({ message: 'Summary', errors: ['The real reason'] }))).toEqual(['The real reason']);
  });
});

/**
 * The list form, for the screens that branch on the FIRST message rather than rendering one
 * sentence. Every one of them used to read `error.response.data.errors` — an axios envelope this
 * app has never produced — so these are the first assertions that describe what they actually get.
 */
describe('serverMessages', () => {
  it('returns the per-rule messages from the THROWN shape, most specific first', () => {
    const error = new ApiError(400, 'Validation failed', ['Rule overlaps. Range: 0 - 11', 'Second reason']);

    expect(serverMessages(error)).toEqual(['Rule overlaps. Range: 0 - 11', 'Second reason']);
  });

  it('returns the per-rule messages from the RESOLVED shape', () => {
    expect(serverMessages({ success: false, errors: ['User with ID "x" was not found'] })).toEqual([
      'User with ID "x" was not found',
    ]);
  });

  it('falls back to the summary when there are no per-rule messages', () => {
    expect(serverMessages(new ApiError(409, 'That slug is taken'))).toEqual(['That slug is taken']);
    expect(serverMessages({ success: false, message: 'Operation failed' })).toEqual(['Operation failed']);
  });

  it('drops blanks rather than returning them as messages', () => {
    // Same rule as everywhere else in this file: `''` and `'   '` are absence. A caller that
    // branched on `list[0]` would otherwise match nothing and render an empty string.
    expect(serverMessages(new ApiError(400, 'Summary', ['', '   ']))).toEqual(['Summary']);
    expect(serverMessages(new ApiError(400, '   '))).toEqual([]);
    expect(serverMessages(new ApiError(0, ''))).toEqual([]);
  });

  it('returns nothing for a client-side throw or a non-failure', () => {
    expect(serverMessages(new TypeError('Failed to fetch'))).toEqual([]);
    expect(serverMessages('a string')).toEqual([]);
    expect(serverMessages(null)).toEqual([]);
    expect(serverMessages({ success: true, message: 'fine' })).toEqual([]);
  });

  it('ignores a non-array `errors`, rather than iterating a string one char at a time', () => {
    expect(serverMessages(new ApiError(400, 'Summary', 'oops' as unknown as string[]))).toEqual(['Summary']);
  });
});

describe('serverMessage', () => {
  it('joins EVERY reason with the backend separator, which is the whole point of #490', () => {
    // The regression this helper exists to close. Pre-#291 the backend joined the rules itself and
    // sent one entry, so `[0]` showed all of them; now it sends one entry per rule and `[0]` shows
    // one. `'; '` is the backend's own join, so this reproduces the pre-#291 string exactly rather
    // than a near-miss of it — a `', '` here would silently make every one of these surfaces differ
    // from the `message` the same response carries.
    const error = new ApiError(400, 'Name is required; Price must be greater than 0', [
      'Name is required',
      'Price must be greater than 0',
    ]);

    expect(serverMessage(error)).toBe('Name is required; Price must be greater than 0');
    expect(serverMessage(error)).toBe(error.message);
  });

  it('is null — not an empty string — when the server authored nothing', () => {
    // Load-bearing, and the reason the return type is `string | null`. Every call site is
    // `serverMessage(x) ?? t('…')`, and `??` does NOT fall through an empty string: returning `''`
    // would put a blank error line where the TRANSLATED fallback belongs, on a dead network and a
    // body-less 401 alike.
    expect(serverMessage(new TypeError('Failed to fetch'))).toBeNull();
    expect(serverMessage(new ApiError(400, '   ', ['', '  ']))).toBeNull();
    expect(serverMessage(null)).toBeNull();
    expect(serverMessage({ success: true, message: 'fine' })).toBeNull();

    expect(serverMessage(new TypeError('x')) ?? 'translated fallback').toBe('translated fallback');
  });

  it('agrees with serverMessages on the single-reason shapes, so nothing else moved', () => {
    // The 22 swept sites mostly meet one-reason refusals. Those must render the identical string
    // before and after, or this change is not the mechanical sweep it claims to be.
    for (const input of [
      new ApiError(409, 'That slug is taken'),
      new ApiError(400, 'Operation failed', ['Delivery address is required for delivery orders']),
      { success: false, errors: ['User with ID "x" was not found'] },
      { success: false, message: 'Operation failed' },
    ]) {
      expect(serverMessage(input)).toBe(serverMessages(input)[0]);
    }
  });
});

describe('routeApiError', () => {
  describe('the shape apiClient THROWS (any non-2xx)', () => {
    it('routes each per-rule message onto the field it names', () => {
      const error = new ApiError(400, 'Validation failed', [
        'Password must contain at least one uppercase letter',
        'Email must be a valid email address',
      ]);

      const { fieldErrors, rootMessage } = routeApiError(error, STAFF_REGISTRATION_MATCHERS);

      expect(fieldErrors).toEqual([
        { field: 'password', message: 'Password must contain at least one uppercase letter' },
        { field: 'email', message: 'Email must be a valid email address' },
      ]);
      // Nothing left over — the summary line ("Validation failed") is not repeated at form level
      // when every message found a home, or the user reads the same failure twice.
      expect(rootMessage).toBeNull();
    });

    // Ordering, not coincidence: "Passwords do not match" contains "Password", so a matcher table
    // listing the broad pattern first pins a mismatch on the field the user typed correctly.
    it('gives "Passwords do not match" to confirmPassword, not password', () => {
      const error = new ApiError(400, 'Validation failed', ['Passwords do not match']);
      const { fieldErrors } = routeApiError(error, STAFF_REGISTRATION_MATCHERS);
      expect(fieldErrors).toEqual([{ field: 'confirmPassword', message: 'Passwords do not match' }]);
    });

    it('sends a message that matches no field to the form, rather than dropping it', () => {
      const error = new ApiError(400, 'Validation failed', ['Something the matchers never heard of']);
      const { fieldErrors, rootMessage } = routeApiError(error, STAFF_REGISTRATION_MATCHERS);
      expect(fieldErrors).toEqual([]);
      expect(rootMessage).toBe('Something the matchers never heard of');
    });

    it('falls back to the summary message when there are no per-rule details', () => {
      const error = new ApiError(500, 'Server exploded');
      expect(routeApiError(error, STAFF_REGISTRATION_MATCHERS)).toEqual({
        fieldErrors: [],
        rootMessage: 'Server exploded',
      });
    });
  });

  // Handler failures are wrapped in `Ok(ApiResponse.Failure(...))` — a 200 — so they RESOLVE and
  // never become an ApiError. And `registerCustomer` bypasses `apiClient` entirely (`authService.ts`
  // is a raw fetch that returns the parsed body for every status), so on THAT path even a 400
  // arrives like this. A helper that understood only the thrown shape would drop most failures.
  describe('the shape the API RESOLVES', () => {
    it('routes the errors array the same way', () => {
      const response = {
        success: false,
        message: 'Failed to create user',
        errors: ['Passwords must have at least one non alphanumeric character.'],
      };
      const { fieldErrors, rootMessage } = routeApiError(response, STAFF_REGISTRATION_MATCHERS);
      expect(fieldErrors).toEqual([
        { field: 'password', message: 'Passwords must have at least one non alphanumeric character.' },
      ]);
      expect(rootMessage).toBeNull();
    });

    it('uses the summary message when the failure carries no errors array', () => {
      const response = { success: false, message: 'User with this email already exists' };
      expect(routeApiError(response, STAFF_REGISTRATION_MATCHERS).rootMessage).toBe(
        'User with this email already exists',
      );
    });

    it('does not treat a SUCCESSFUL response as a failure', () => {
      // Guards the `success === false` test in `asResolvedFailure`: widening it to "is an object"
      // would make every resolved payload look like an error.
      expect(routeApiError({ success: true, data: {} }, STAFF_REGISTRATION_MATCHERS).rootMessage).toBeNull();
    });
  });

  /**
   * The caller renders `rootMessage || <translated fallback>`. That contract only holds if a
   * message we cannot use comes back as `null` rather than as blank text — `'' ?? fallback` is
   * `''`, which renders an EMPTY error line, and with `role="alert"` a live region that announces
   * nothing. Coverage does not catch this class: every line below was already at 100%, exercised
   * by inputs that happened to be non-empty.
   */
  describe('never returns blank text where a message belongs', () => {
    // The invariant, stated once over every degenerate shape: `rootMessage` is either null — which
    // the caller replaces with a translated sentence — or real text. It is never blank, and never
    // whitespace pretending to be a diagnosis.
    it.each([
      ['errors: one empty string', new ApiError(400, 'Validation failed', [''])],
      ['errors: whitespace only', new ApiError(400, 'Validation failed', ['   '])],
      ['errors: all blank', new ApiError(400, 'Validation failed', ['', '  '])],
      ['errors: blank with a blank summary too', new ApiError(400, '', [''])],
      ['resolved failure with an empty message', { success: false, message: '' }],
      ['resolved failure with a whitespace message', { success: false, message: '  ' }],
      ['resolved failure with nothing at all', { success: false }],
      ['resolved failure with a blank errors array', { success: false, message: '', errors: ['  '] }],
    ])('%s -> null or real text, never blank', (_case, input) => {
      const { rootMessage } = routeApiError(input, STAFF_REGISTRATION_MATCHERS);
      expect(rootMessage === null || rootMessage.trim().length > 0).toBe(true);
    });

    // Blank per-rule details are discarded, but the server's SUMMARY line is still a real message —
    // preferring it over the caller's generic fallback keeps the more specific of the two.
    it('falls back to the summary line when every per-rule detail is blank', () => {
      expect(routeApiError(new ApiError(400, 'Validation failed', ['', '  ']), STAFF_REGISTRATION_MATCHERS)).toEqual({
        fieldErrors: [],
        rootMessage: 'Validation failed',
      });
    });

    it('returns null when nothing anywhere is usable', () => {
      expect(routeApiError(new ApiError(400, '   ', ['']), STAFF_REGISTRATION_MATCHERS).rootMessage).toBeNull();
      expect(routeApiError({ success: false }, STAFF_REGISTRATION_MATCHERS).rootMessage).toBeNull();
    });

    it('keeps the real messages when only SOME are blank', () => {
      const error = new ApiError(400, 'Validation failed', ['', 'Password is required', '   ']);
      const { fieldErrors, rootMessage } = routeApiError(error, STAFF_REGISTRATION_MATCHERS);
      expect(fieldErrors).toEqual([{ field: 'password', message: 'Password is required' }]);
      expect(rootMessage).toBeNull();
    });
  });

  /**
   * Client-synthesized text must never reach a user. On the customer registration path the only
   * things that can reach a catch are a dead network and an HTML error page parsed as JSON, and
   * their messages are JS diagnostics — strictly worse than the translated generic this whole
   * change set out to replace.
   */
  describe('does not present text the server did not write', () => {
    it.each([
      ['offline fetch', new TypeError('Failed to fetch')],
      ['HTML 502 parsed as JSON', new SyntaxError('Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON')],
      ['a plain Error', new Error('boom')],
      ['a thrown string', 'a string nobody expected'],
      ['a thrown undefined', undefined],
    ])('%s -> null root, so the caller shows its own translated message', (_case, thrown) => {
      expect(routeApiError(thrown, CUSTOMER_REGISTRATION_MATCHERS).rootMessage).toBeNull();
    });
  });

  // Called with no matchers at all — the shape a caller reaches for when it has no per-field slots
  // to route into. Everything must still surface at form level; the default must not swallow.
  it('routes everything to the form when no matchers are given', () => {
    const error = new ApiError(400, 'Validation failed', ['Password is required', 'Email is required']);
    expect(routeApiError(error)).toEqual({
      fieldErrors: [],
      // Comma-joined, matching `getErrorMessage`. A no-matcher caller puts EVERY message through
      // here, so the separator is the whole message rather than a joint between leftovers.
      rootMessage: 'Password is required, Email is required',
    });
  });

  describe('malformed payloads', () => {
    // `errors` typed as unknown and guarded with Array.isArray. A bare `.length` check also passes
    // for a STRING, and the loop would then route it one character at a time — producing
    // "E m a i l   a l r e a d y   u s e d". Not reachable through the current backend
    // (`ApiResponse.Errors` is a List<string>), but this helper is the template for 103 more
    // callsites against endpoints nobody has audited.
    it('treats a string `errors` as no detail rather than iterating its characters', () => {
      const response = { success: false, message: 'Email already used', errors: 'Email already used' };
      const { fieldErrors, rootMessage } = routeApiError(response, STAFF_REGISTRATION_MATCHERS);
      expect(fieldErrors).toEqual([]);
      expect(rootMessage).toBe('Email already used');
    });

    it('ignores non-string entries inside errors', () => {
      const error = new ApiError(400, 'Validation failed', [null, 42, 'Password is required'] as unknown as string[]);
      expect(routeApiError(error, STAFF_REGISTRATION_MATCHERS).fieldErrors).toEqual([
        { field: 'password', message: 'Password is required' },
      ]);
    });
  });

  /**
   * A message routed to a field the form does not render is written to state nobody displays — and
   * because a routed message suppresses the form-level one, it goes out in total silence. The two
   * registration forms therefore get their own tables instead of sharing one.
   */
  describe('per-form matcher tables', () => {
    it('the customer table has no role entry, so a role message stays visible at form level', () => {
      const error = new ApiError(400, 'Validation failed', ['Invalid role specified']);
      const { fieldErrors, rootMessage } = routeApiError(error, CUSTOMER_REGISTRATION_MATCHERS);
      expect(fieldErrors).toEqual([]);
      expect(rootMessage).toBe('Invalid role specified');
    });

    it('the staff table routes it to the role select it actually renders', () => {
      const error = new ApiError(400, 'Validation failed', ['Invalid role specified']);
      expect(routeApiError(error, STAFF_REGISTRATION_MATCHERS).fieldErrors).toEqual([
        { field: 'role', message: 'Invalid role specified' },
      ]);
    });
  });
});

/**
 * `formLevelMessage` is exercised from three consumers' suites, but a pin on THIS file's coverage
 * should not depend on another file's tests staying where they are — a deleted suite can orphan the
 * only coverage of a rule that is still live elsewhere.
 */
describe('formLevelMessage', () => {
  const routed = <T extends string>(rootMessage: string | null, fields: Array<{ field: T; message: string }> = []) => ({
    rootMessage,
    fieldErrors: fields,
  });

  it("prefers the server's own sentence", () => {
    expect(formLevelMessage(routed('That slug is taken'), 'fallback')).toBe('That slug is taken');
  });

  it('falls back when the server said nothing AND nothing reached a field', () => {
    expect(formLevelMessage(routed(null), 'fallback')).toBe('fallback');
  });

  it('says NOTHING at form level when every message reached a field', () => {
    // The distinction the function exists for: a generic line under "Password must contain at least
    // one uppercase letter" is noise, not information.
    expect(formLevelMessage(routed(null, [{ field: 'password', message: 'too short' }]), 'fallback')).toBeNull();
  });

  it('still shows the root message when SOME messages reached fields and some did not', () => {
    expect(formLevelMessage(routed('Also, the email is taken', [{ field: 'password', message: 'x' }]), 'f')).toBe(
      'Also, the email is taken',
    );
  });
});
