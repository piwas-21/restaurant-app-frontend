import { act, renderHook } from '@testing-library/react';
import { useRegisterForm } from './useRegisterForm';
// The alias resolves to `__mocks__/@/utils/apiClient.ts`, which SHADOWS the real module tree-wide.
// The rejection must be an instance of THAT class or `routeApiError`'s `instanceof` is false and the
// test proves nothing — `jest.requireActual` hands back a different class object and fails silently.
import { ApiError } from '@/utils/apiClient';

const mockRegisterCustomer = jest.fn();
const mockSendEmailVerification = jest.fn();
const mockTrackEvent = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, def?: string) => def ?? _key }),
}));
jest.mock('@/services/authService', () => ({
  registerCustomer: (...args: unknown[]) => mockRegisterCustomer(...args),
  sendEmailVerification: (...args: unknown[]) => mockSendEmailVerification(...args),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => mockTrackEvent(...args) }));

const submit = { preventDefault: jest.fn() } as unknown as React.FormEvent;
const change = (id: string, value: string) =>
  ({ target: { id, value } }) as unknown as React.ChangeEvent<HTMLInputElement>;

// `secret1` until 2026-08-01, which is the whole of BUGS-IMPROVEMENTS-PLAN E9 in one fixture: it
// passed the old `min(6)` schema and was then refused by the server, so the suite's "valid submit"
// was a request that 400s in production.
const GOOD_PASSWORD = 'Sofra!2026'; // pragma: allowlist secret -- test fixture, not a credential

const fillValid = (result: { current: ReturnType<typeof useRegisterForm> }) => {
  act(() => result.current.handleChange(change('firstName', 'Ada')));
  act(() => result.current.handleChange(change('lastName', 'Lovelace')));
  act(() => result.current.handleChange(change('email', 'ada@calc.co')));
  act(() => result.current.handleChange(change('password', GOOD_PASSWORD)));
  act(() => result.current.handleChange(change('confirmPassword', GOOD_PASSWORD)));
};

beforeEach(() => jest.clearAllMocks());

describe('useRegisterForm', () => {
  it('blocks an invalid (empty) submit with field errors and no network call', async () => {
    const { result } = renderHook(() => useRegisterForm());
    await act(async () => result.current.handleSubmit(submit));
    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);
    expect(mockRegisterCustomer).not.toHaveBeenCalled();
  });

  it('flags a password mismatch on the confirmPassword field', async () => {
    const { result } = renderHook(() => useRegisterForm());
    fillValid(result);
    act(() => result.current.handleChange(change('confirmPassword', 'different')));
    await act(async () => result.current.handleSubmit(submit));
    expect(result.current.errors.confirmPassword).toBeTruthy();
    expect(mockRegisterCustomer).not.toHaveBeenCalled();
  });

  it('registers and shows the success state on a valid submit', async () => {
    mockRegisterCustomer.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useRegisterForm());
    fillValid(result);
    await act(async () => result.current.handleSubmit(submit));
    expect(mockRegisterCustomer).toHaveBeenCalledTimes(1);
    expect(result.current.registrationSuccess).toBe(true);
  });

  // `registerCustomer` does NOT go through `apiClient` — `authService.ts` is a raw fetch that
  // returns the parsed body for every status — so this RESOLVED shape is the real failure path
  // here, including for a 400. It used to be joined into one blob above the form; now it is routed,
  // so the message lands under the field it names.
  it('routes a resolved backend failure onto the field it names', async () => {
    mockRegisterCustomer.mockResolvedValue({ success: false, errors: ['Email already used'] });
    const { result } = renderHook(() => useRegisterForm());
    fillValid(result);
    await act(async () => result.current.handleSubmit(submit));
    expect(result.current.errors.email).toBe('Email already used');
    expect(result.current.registrationSuccess).toBe(false);
  });

  it('keeps a resolved failure that names no field at form level', async () => {
    mockRegisterCustomer.mockResolvedValue({ success: false, message: 'Registration is closed' });
    const { result } = renderHook(() => useRegisterForm());
    fillValid(result);
    await act(async () => result.current.handleSubmit(submit));
    expect(result.current.generalError).toBe('Registration is closed');
  });

  it('refuses a password the server would reject, without sending it', async () => {
    const { result } = renderHook(() => useRegisterForm());
    fillValid(result);
    act(() => result.current.handleChange(change('password', 'secret1')));
    act(() => result.current.handleChange(change('confirmPassword', 'secret1')));
    await act(async () => result.current.handleSubmit(submit));
    expect(result.current.errors.password).toBeTruthy();
    // The point of mirroring the policy: the round trip never happens.
    expect(mockRegisterCustomer).not.toHaveBeenCalled();
  });

  // The reported bug, on the customer path. `apiClient` THROWS on a 400, so this never reached the
  // `success === false` branch — the bare `catch {}` replaced the server's per-rule messages with
  // "An unexpected error occurred."
  it('routes a thrown 400 onto the field it names, not into a generic message', async () => {
    mockRegisterCustomer.mockRejectedValue(
      new ApiError(400, 'Validation failed', ['Password must contain at least one uppercase letter']),
    );
    const { result } = renderHook(() => useRegisterForm());
    fillValid(result);
    await act(async () => result.current.handleSubmit(submit));
    expect(result.current.errors.password).toBe('Password must contain at least one uppercase letter');
    expect(result.current.generalError).not.toContain('unexpected');
  });

  it('still reports a thrown failure that names no field', async () => {
    mockRegisterCustomer.mockRejectedValue(new ApiError(500, 'Server exploded'));
    const { result } = renderHook(() => useRegisterForm());
    fillValid(result);
    await act(async () => result.current.handleSubmit(submit));
    expect(result.current.generalError).toBe('Server exploded');
  });

  /**
   * The two throws this path can ACTUALLY produce, since `registerCustomer` bypasses `apiClient`:
   * a dead network, and an HTML 502 from the box parsed as JSON. Their messages are JS diagnostics.
   * Showing them to a customer would be worse than the generic sentence this change set out to
   * replace, so the translated fallback has to win.
   */
  it.each([
    ['offline', new TypeError('Failed to fetch')],
    ['HTML 502 parsed as JSON', new SyntaxError('Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON')],
  ])('shows the translated fallback, not a JS diagnostic, when %s', async (_case, thrown) => {
    mockRegisterCustomer.mockRejectedValue(thrown);
    const { result } = renderHook(() => useRegisterForm());
    fillValid(result);
    await act(async () => result.current.handleSubmit(submit));
    expect(result.current.generalError).toBe('An unexpected error occurred.');
    expect(result.current.generalError).not.toMatch(/fetch|DOCTYPE|JSON/);
  });

  it('never renders a blank error line when the server sends an empty message', async () => {
    // `'' ?? fallback` is `''` — the reason this uses `||`. A blank generalError renders nothing at
    // all in `RegisterFields`, i.e. a failed submit that looks like no submit.
    mockRegisterCustomer.mockResolvedValue({ success: false, message: '', errors: ['   '] });
    const { result } = renderHook(() => useRegisterForm());
    fillValid(result);
    await act(async () => result.current.handleSubmit(submit));
    expect(result.current.generalError.trim()).toBeTruthy();
  });

  it('handleChange clears a field error as the user types', async () => {
    const { result } = renderHook(() => useRegisterForm());
    await act(async () => result.current.handleSubmit(submit)); // populate errors
    expect(result.current.errors.firstName).toBeTruthy();
    act(() => result.current.handleChange(change('firstName', 'A')));
    expect(result.current.errors.firstName).toBe('');
  });
});
