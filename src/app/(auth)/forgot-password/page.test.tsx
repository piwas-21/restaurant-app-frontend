import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    mockForgotPassword.mockResolvedValue({ succeeded: true });
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
    mockForgotPassword.mockResolvedValue({ succeeded: false, messages: ['No such user'] });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('email'), { target: { value: 'nobody@bistro.example' } });
    fireEvent.click(submit());
    expect(await screen.findByText('forgot_password_sent_title')).toBeInTheDocument();
    expect(screen.queryByText('No such user')).not.toBeInTheDocument();
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
