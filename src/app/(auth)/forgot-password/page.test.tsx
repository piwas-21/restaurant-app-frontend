import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import ForgotPasswordPage from './page';

const mockForgotPassword = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/services/authService', () => ({
  forgotPassword: (...args: unknown[]) => mockForgotPassword(...args),
}));

beforeEach(() => jest.clearAllMocks());

const submit = () => screen.getByRole('button', { name: 'forgot_password_submit' });

describe('ForgotPasswordPage', () => {
  it('refuses an empty submit without touching the network', async () => {
    render(<ForgotPasswordPage />);
    fireEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent('email_required');
    expect(mockForgotPassword).not.toHaveBeenCalled();
  });

  it('refuses a malformed address without touching the network', async () => {
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('email'), { target: { value: 'not-an-email' } });
    fireEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent('email_required');
    expect(mockForgotPassword).not.toHaveBeenCalled();
  });

  it('sends the request and confirms it', async () => {
    mockForgotPassword.mockResolvedValue({ success: true, message: 'Password reset request processed' });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('email'), { target: { value: 'owner@bistro.example' } });
    fireEvent.click(submit());
    await waitFor(() => expect(mockForgotPassword).toHaveBeenCalledWith({ email: 'owner@bistro.example' }));
    expect(await screen.findByText('forgot_password_sent_title')).toBeInTheDocument();
  });

  it('confirms identically when the address has no account (anti-enumeration)', async () => {
    // The endpoint answers "if the email exists…" either way, by design. Branching on the
    // response here would leak exactly what the backend refuses to — so this asserts the
    // UI says the SAME thing for a failure-shaped payload.
    // The backend returns 200 with a byte-identical SUCCESS body whether or not the address
    // has an account (ForgotPasswordCommand.cs), so this is what "no such user" looks like.
    mockForgotPassword.mockResolvedValue({ success: true, message: 'Password reset request processed' });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('email'), { target: { value: 'nobody@bistro.example' } });
    fireEvent.click(submit());
    expect(await screen.findByText('forgot_password_sent_title')).toBeInTheDocument();
  });

  it('does NOT claim an email was sent when the server reports a failure', async () => {
    // `success:false` cannot mean "no such account" — the backend is symmetric on that — so
    // it means the server broke. The mail send is awaited inline and unguarded, so a Resend
    // outage arrives here as a 500, and the old code showed "check your email" for it.
    mockForgotPassword.mockResolvedValue({ success: false, message: 'An error occurred' });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('email'), {
      target: { value: 'owner@bistro.example' },
    });
    fireEvent.click(submit());
    expect(await screen.findByText('An error occurred')).toBeInTheDocument();
    expect(screen.queryByText('forgot_password_sent_title')).not.toBeInTheDocument();
  });

  it('prints a refusal that RESOLVES with success:false (E9)', async () => {
    // The controller does `return Ok(result)`, so a handler-level refusal is an HTTP 200 carrying a
    // failure envelope — that path survives #414 and still lands on the resolved branch.
    mockForgotPassword.mockResolvedValue({
      success: false,
      message: 'Too many requests. Please slow down and try again shortly.',
    });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('email'), { target: { value: 'owner@bistro.example' } });
    fireEvent.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Please slow down and try again');
    expect(screen.queryByText('unexpected_error')).not.toBeInTheDocument();
    expect(screen.queryByText('forgot_password_sent_title')).not.toBeInTheDocument();
  });

  // #414. The rate limiter rejects with a real 429, and the 502 from an email-provider outage is a
  // real 502 — neither is a 200. While `forgotPassword` was a raw `fetch` returning
  // `response.json()` for every status they arrived resolved; through `apiClient` they THROW, and
  // this is the branch that has to keep printing them. Someone who pressed the button twice was
  // told "an unexpected error occurred" and had no way to know that waiting was the fix.
  it.each([
    [429, 'Too many requests. Please slow down and try again shortly.'],
    [502, 'The email could not be delivered. Please try again later.'],
  ])('prints the server’s sentence when a %i is THROWN', async (status, sentence) => {
    mockForgotPassword.mockRejectedValue(new ApiError(status, sentence));
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('email'), { target: { value: 'owner@bistro.example' } });
    fireEvent.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(sentence);
    expect(screen.queryByText('unexpected_error')).not.toBeInTheDocument();
  });

  it('keeps the generic sentence for a thrown transport failure', async () => {
    // A dead network or a non-JSON body authors nothing showable; those texts are client-authored
    // and #401 removed them from users' screens.
    mockForgotPassword.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('email'), { target: { value: 'owner@bistro.example' } });
    fireEvent.click(submit());

    expect(await screen.findByText('unexpected_error')).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
  });

  it('falls back to the translated generic when the failure body carries no sentence', async () => {
    // `serverMessages` returns [] for a blank message, and `?? t('unexpected_error')` is what
    // stops an empty error line — "the operation failed for no reason" — reaching the screen.
    mockForgotPassword.mockResolvedValue({ success: false, message: '   ' });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('email'), { target: { value: 'owner@bistro.example' } });
    fireEvent.click(submit());
    expect(await screen.findByText('unexpected_error')).toBeInTheDocument();
  });

  it('keeps the form and reports a transport failure', async () => {
    // A rejected fetch is the one case the user can act on by retrying, so it must NOT
    // land on the "check your email" screen — that would tell them to wait for an email
    // that was never requested.
    mockForgotPassword.mockRejectedValue(new Error('offline'));
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('email'), { target: { value: 'owner@bistro.example' } });
    fireEvent.click(submit());
    expect(await screen.findByText('unexpected_error')).toBeInTheDocument();
    expect(screen.queryByText('forgot_password_sent_title')).not.toBeInTheDocument();
    expect(submit()).toBeInTheDocument();
  });
});
