import { act, renderHook, waitFor } from '@testing-library/react';
import { useLoginForm } from './useLoginForm';

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
jest.mock('@/services/authService', () => ({
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
});
