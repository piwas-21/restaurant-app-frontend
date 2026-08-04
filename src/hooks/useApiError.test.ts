import { renderHook, act } from '@testing-library/react';
import { useApiError } from './useApiError';
import { ApiError } from '@/utils/apiClient';

jest.mock('react-i18next', () => ({
  // Prefixed so a test can tell a TRANSLATED fallback from a raw English literal — which is the
  // whole distinction this hook exists to enforce.
  useTranslation: () => ({ t: (key: string, fallback?: string) => `T:${fallback ?? key}` }),
}));

// The console.error inside `routeApiError` is deliberate (it is the only operator signal there is);
// silence it so the suite output stays readable.
beforeAll(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

const OPTS = { matchers: [['password', /password/i]] } as const;

describe('useApiError', () => {
  it('starts with nothing to say', () => {
    const { result } = renderHook(() => useApiError());

    expect(result.current.message).toBeNull();
    expect(result.current.fieldErrors).toEqual([]);
  });

  it("shows the SERVER's sentence when it authored one", () => {
    // Specific server prose beats a translated generic: it tells the user what to do.
    const { result } = renderHook(() => useApiError());

    act(() => {
      result.current.capture(new ApiError(400, 'Email is already registered'));
    });

    expect(result.current.message).toBe('Email is already registered');
  });

  it('falls back to a TRANSLATED generic when the server authored nothing', () => {
    // The defect this hook closes. `getErrorMessage` ends `return 'An unexpected error occurred'` —
    // a hardcoded English literal, and verbatim the string the owner reported. Here the fallback is
    // not a parameter, so no caller can supply an untranslated one by forgetting.
    const { result } = renderHook(() => useApiError());

    act(() => {
      result.current.capture(new TypeError('Failed to fetch'));
    });

    expect(result.current.message).toBe('T:An unexpected error occurred');
  });

  it('does not present a client-authored throw to the user', () => {
    // `SyntaxError` from `response.json()` on an HTML 502 mid-deploy would otherwise put
    // `Unexpected token '<'` in front of a customer.
    const { result } = renderHook(() => useApiError());

    act(() => {
      result.current.capture(new SyntaxError(`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`));
    });

    expect(result.current.message).toBe('T:An unexpected error occurred');
  });

  it('treats a blank server message as absence, not as a message', () => {
    // An empty error line is worse than the generic: it says the operation failed for no reason.
    const { result } = renderHook(() => useApiError());

    act(() => {
      result.current.capture(new ApiError(400, '   '));
    });

    expect(result.current.message).toBe('T:An unexpected error occurred');
  });

  it('routes per-field messages and returns the split to the caller', () => {
    const { result } = renderHook(() => useApiError<'password'>());
    let routed: ReturnType<typeof result.current.capture> | undefined;

    act(() => {
      routed = result.current.capture(
        new ApiError(400, 'Validation failed', ['Password must contain at least one uppercase letter']),
        OPTS,
      );
    });

    expect(result.current.fieldErrors).toEqual([
      { field: 'password', message: 'Password must contain at least one uppercase letter' },
    ]);
    // Returned as well as stored, so a form can apply them to its inputs in the same statement.
    expect(routed?.fieldErrors).toHaveLength(1);
    // Everything matched a field, so there is nothing left for the form-level line.
    expect(result.current.message).toBeNull();
  });

  it('understands the failure the API returns INSIDE a 200', () => {
    // The public registration path does not use `apiClient` at all, so a 400 RESOLVES there.
    const { result } = renderHook(() => useApiError());

    act(() => {
      result.current.capture({ success: false, message: 'Email is already registered' });
    });

    expect(result.current.message).toBe('Email is already registered');
  });

  it('shows a message of our own for a client-side failure', () => {
    const { result } = renderHook(() => useApiError());

    act(() => result.current.show('T:Passwords do not match'));

    expect(result.current.message).toBe('T:Passwords do not match');
  });

  it('replaces one kind of message with the other rather than stacking them', () => {
    // Two error lines from one failed action is how a form ends up contradicting itself.
    const { result } = renderHook(() => useApiError<'password'>());

    act(() => result.current.show('T:Passwords do not match'));
    act(() => {
      result.current.capture(new ApiError(400, 'Email is already registered'), OPTS);
    });
    expect(result.current.message).toBe('Email is already registered');

    act(() => result.current.show('T:Passwords do not match'));
    expect(result.current.message).toBe('T:Passwords do not match');
    expect(result.current.fieldErrors).toEqual([]);
  });

  it('clears both kinds', () => {
    const { result } = renderHook(() => useApiError<'password'>());

    act(() => {
      result.current.capture(new ApiError(400, 'Validation failed', ['Password is too short']), OPTS);
    });
    expect(result.current.fieldErrors).toHaveLength(1);

    act(() => result.current.clear());

    expect(result.current.message).toBeNull();
    expect(result.current.fieldErrors).toEqual([]);
  });

  it('keeps stable callback identities, so a caller can put them in a dependency array', () => {
    const { result, rerender } = renderHook(() => useApiError());
    const first = { capture: result.current.capture, show: result.current.show, clear: result.current.clear };

    rerender();

    expect(result.current.capture).toBe(first.capture);
    expect(result.current.show).toBe(first.show);
    expect(result.current.clear).toBe(first.clear);
  });
  it('prefers a per-call fallback, so a screen can say where the user IS', () => {
    // The majority case in the sweep: 36 of the ~100 catch bodies already print a CONTEXTUAL
    // translated message ("Failed to load point rules"). Without this they would all have to be
    // downgraded to the generic, or rebuild by hand the very `rootMessage || t(…)` wiring the hook
    // exists to abolish.
    const { result } = renderHook(() => useApiError());

    act(() => {
      result.current.capture(new TypeError('Failed to fetch'), { fallback: 'T:Failed to load point rules' });
    });

    expect(result.current.message).toBe('T:Failed to load point rules');
  });

  it("still prefers the SERVER's sentence over a per-call fallback", () => {
    const { result } = renderHook(() => useApiError());

    act(() => {
      result.current.capture(new ApiError(409, 'That slug is taken'), { fallback: 'T:Could not save' });
    });

    expect(result.current.message).toBe('That slug is taken');
  });

  it('keeps the surface object identity stable, so it is safe in a dependency array', () => {
    const { result, rerender } = renderHook(() => useApiError());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
