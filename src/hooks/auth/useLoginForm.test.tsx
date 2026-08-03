import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLoginForm } from './useLoginForm';
import { ModulesProvider } from '@/contexts/ModulesContext';
import type { ModuleId } from '@/lib/modules';

const mockPush = jest.fn();
const mockLogin = jest.fn();
const mockLoginUser = jest.fn();
const mockSendEmailVerification = jest.fn();
const mockTrackEvent = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, def?: string) => def ?? _key }),
}));
jest.mock('@/components/AuthContext', () => ({ useAuth: () => ({ login: mockLogin }) }));
// Spread the real module rather than hand-picking two exports: a partial factory that omits an
// export the hook later reaches for fails from INSIDE a catch, where a bare `rejects.toThrow()`
// accepts it as the expected failure (#408, `fidelityPointsService.test.ts`).
jest.mock('@/services/authService', () => ({
  ...jest.requireActual('@/services/authService'),
  login: (...args: unknown[]) => mockLoginUser(...args),
  sendEmailVerification: (...args: unknown[]) => mockSendEmailVerification(...args),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => mockTrackEvent(...args) }));

const submit = { preventDefault: jest.fn() } as unknown as React.FormEvent;

beforeEach(() => jest.clearAllMocks());

describe('useLoginForm', () => {
  it('blocks an empty submit with a required-fields error and no network call', async () => {
    const { result } = renderHook(() => useLoginForm());
    await act(async () => result.current.handleSubmit(submit));
    expect(result.current.error).toBe('Email and password are required.');
    expect(mockLoginUser).not.toHaveBeenCalled();
  });

  it.each([
    ['Admin', '/admin/dashboard'],
    ['Customer', '/account'],
    ['Cashier', '/cashier'],
    ['KitchenStaff', '/kitchen-staff'],
    ['Server', '/server'],
    ['wizard', '/'], // unknown role → home
  ])('on success logs in and routes %s → %s', async (role, route) => {
    mockLoginUser.mockResolvedValue({ success: true, data: { role } });
    const { result } = renderHook(() => useLoginForm());
    act(() => {
      result.current.setEmail('a@b.co');
      result.current.setPassword('secret1');
    });
    await act(async () => result.current.handleSubmit(submit));
    expect(mockLogin).toHaveBeenCalledWith({ role });
    expect(mockPush).toHaveBeenCalledWith(route);
  });

  it.each([
    ['Cashier', '/cashier'],
    ['KitchenStaff', '/kitchen-staff'],
    ['Server', '/server'],
  ])('sends %s home instead of to a module this tenant did not buy', async (role) => {
    // Otherwise the first screen after login is the blocked page, with a role-scoped nav
    // that now has nothing left in it — the one combination that leaves a bare screen (O5).
    const bought: ModuleId[] = ['core'];
    mockLoginUser.mockResolvedValue({ success: true, data: { role } });
    const { result } = renderHook(() => useLoginForm(), {
      wrapper: ({ children }) => <ModulesProvider modules={bought}>{children}</ModulesProvider>,
    });
    act(() => {
      result.current.setEmail('a@b.co');
      result.current.setPassword('secret1');
    });
    await act(async () => result.current.handleSubmit(submit));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('still routes a staff role whose module the tenant DID buy', async () => {
    const bought: ModuleId[] = ['core', 'cashier'];
    mockLoginUser.mockResolvedValue({ success: true, data: { role: 'Cashier' } });
    const { result } = renderHook(() => useLoginForm(), {
      wrapper: ({ children }) => <ModulesProvider modules={bought}>{children}</ModulesProvider>,
    });
    act(() => {
      result.current.setEmail('a@b.co');
      result.current.setPassword('secret1');
    });
    await act(async () => result.current.handleSubmit(submit));
    expect(mockPush).toHaveBeenCalledWith('/cashier');
  });

  it('falls back to home (no crash) when the success envelope has no role', async () => {
    mockLoginUser.mockResolvedValue({ success: true, data: {} });
    const { result } = renderHook(() => useLoginForm());
    act(() => {
      result.current.setEmail('a@b.co');
      result.current.setPassword('secret1');
    });
    await act(async () => result.current.handleSubmit(submit));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('flags needs-verification when the backend rejects an unverified email', async () => {
    mockLoginUser.mockResolvedValue({ success: false, message: 'Please verify your email', errors: [] });
    const { result } = renderHook(() => useLoginForm());
    act(() => {
      result.current.setEmail('a@b.co');
      result.current.setPassword('secret1');
    });
    await act(async () => result.current.handleSubmit(submit));
    expect(result.current.needsVerification).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
  });

  /**
   * `AuthController.Login` returns `Ok(result)`, and `LoginCommandHandler` answers with
   * `ApiResponse.Failure(reason, summary)` — so a refused login is a **200** whose `errors[0]`
   * holds the reason and whose `message` holds a two-word summary. Reading `message` showed the
   * summary and dropped the reason.
   *
   * (Worth recording because a note in BUGS-IMPROVEMENTS-PLAN generalised
   * `grep -c "Ok(ApiResponse.*Failure"` returning 0 into "there are no 200-wrapped failures".
   * That grep tests an INLINE shape no controller writes; the real one is a handler returning
   * `Failure` through a controller's `return Ok(result)`, and there are 76 of those.)
   */
  it("shows the lockout sentence from errors[], not the 'Account locked' wrapper", async () => {
    mockLoginUser.mockResolvedValue({
      success: false,
      message: 'Account locked',
      errors: ['Too many failed attempts. This account is temporarily locked. Please try again later.'],
    });
    const { result } = renderHook(() => useLoginForm());
    act(() => {
      result.current.setEmail('a@b.co');
      result.current.setPassword('secret1');
    });
    await act(async () => result.current.handleSubmit(submit));

    expect(result.current.error).toBe(
      'Too many failed attempts. This account is temporarily locked. Please try again later.',
    );
    expect(result.current.needsVerification).toBe(false);
  });

  it('still reads the summary when the refusal carries no errors[]', async () => {
    mockLoginUser.mockResolvedValue({ success: false, message: 'Invalid credentials' });
    const { result } = renderHook(() => useLoginForm());
    act(() => {
      result.current.setEmail('a@b.co');
      result.current.setPassword('nope');
    });
    await act(async () => result.current.handleSubmit(submit));

    expect(result.current.error).toBe('Invalid credentials');
  });

  it('falls back to the translated generic when the refusal says nothing at all', async () => {
    mockLoginUser.mockResolvedValue({ success: false });
    const { result } = renderHook(() => useLoginForm());
    act(() => {
      result.current.setEmail('a@b.co');
      result.current.setPassword('nope');
    });
    await act(async () => result.current.handleSubmit(submit));

    expect(result.current.error).toBe('An unknown error occurred.');
  });

  it('routes the verification refusal and shows its full sentence, not the summary', async () => {
    // Verbatim from `LoginCommandHandler`: `Failure(<the long sentence>, "Email verification
    // required")`. Note the sentence carries BOTH "verify" and "verification", so `errors[0]`
    // alone would discriminate — the concat of both slots is redundancy, not a requirement.
    mockLoginUser.mockResolvedValue({
      success: false,
      message: 'Email verification required',
      errors: ['Please verify your email address before logging in. Check your inbox for the verification link.'],
    });
    const { result } = renderHook(() => useLoginForm());
    act(() => {
      result.current.setEmail('a@b.co');
      result.current.setPassword('secret1');
    });
    await act(async () => result.current.handleSubmit(submit));

    expect(result.current.needsVerification).toBe(true);
    expect(result.current.error).toBe(
      'Please verify your email address before logging in. Check your inbox for the verification link.',
    );
  });

  it('still routes verification when only the summary slot carries the word', async () => {
    // `serverMessages` falls through to `message` when `errors` is absent, so the discriminator
    // sees "verification" either way. Pins that the fall-through is what feeds it.
    mockLoginUser.mockResolvedValue({ success: false, message: 'Email verification required' });
    const { result } = renderHook(() => useLoginForm());
    act(() => {
      result.current.setEmail('a@b.co');
      result.current.setPassword('secret1');
    });
    await act(async () => result.current.handleSubmit(submit));

    expect(result.current.needsVerification).toBe(true);
    expect(result.current.error).toBe('Email verification required');
  });

  it('keeps the network sentence when the raw fetch throws, rather than showing the throw', async () => {
    // `authService.login` is a raw fetch, so nothing here is ever an ApiError — a `TypeError`
    // must NOT reach the user as "Failed to fetch".
    mockLoginUser.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useLoginForm());
    act(() => {
      result.current.setEmail('a@b.co');
      result.current.setPassword('secret1');
    });
    await act(async () => result.current.handleSubmit(submit));

    expect(result.current.error).toBe('Failed to connect to the server.');
    expect(mockTrackEvent).toHaveBeenCalledWith('login_failed', { failureReason: 'network' });
  });

  it('sets resendSucceeded true on a successful resend', async () => {
    mockSendEmailVerification.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useLoginForm());
    await act(async () => result.current.handleResendVerification());
    await waitFor(() => expect(result.current.resendSucceeded).toBe(true));
    expect(result.current.resendMessage).toContain('resent');
  });

  it('sets resendSucceeded false when the resend fails', async () => {
    mockSendEmailVerification.mockResolvedValue({ success: false });
    const { result } = renderHook(() => useLoginForm());
    await act(async () => result.current.handleResendVerification());
    await waitFor(() => expect(result.current.resendSucceeded).toBe(false));
  });

  /**
   * `SendEmailVerificationCommandHandler` returns `SuccessWithData` on every branch it reaches —
   * it swallows its own mail-send exception on purpose so the endpoint cannot be used to probe
   * which addresses exist. So `success: false` here is the middleware's failure envelope, and its
   * reason is the only thing that can explain the outage to the user.
   */
  it("surfaces the server's reason for a refused resend instead of a generic", async () => {
    mockSendEmailVerification.mockResolvedValue({
      success: false,
      message: 'Operation failed',
      errors: ['Too many verification requests. Try again in an hour.'],
    });
    const { result } = renderHook(() => useLoginForm());
    await act(async () => result.current.handleResendVerification());

    await waitFor(() =>
      expect(result.current.resendMessage).toBe('Too many verification requests. Try again in an hour.'),
    );
    expect(result.current.resendSucceeded).toBe(false);
  });

  it('shows the translated sentence when the resend fails with nothing to quote', async () => {
    mockSendEmailVerification.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useLoginForm());
    await act(async () => result.current.handleResendVerification());

    await waitFor(() => expect(result.current.resendMessage).toBe('Failed to resend email. Please try again later.'));
    expect(result.current.resendSucceeded).toBe(false);
  });
});
