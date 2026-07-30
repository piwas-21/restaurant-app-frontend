import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ResetPasswordPage from './page';

const mockResetPassword = jest.fn();
// Must be `mock`-prefixed: jest forbids a mock factory closing over any other
// out-of-scope variable, and the error names the variable rather than the rule.
let mockSearch = '';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
jest.mock('@/services/authService', () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
}));

const LINK = 'token=CfDJ8AbC%2Fdef%3D%3D&email=owner%40bistro.example';

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch = LINK;
});

const submit = () => screen.getByRole('button', { name: 'reset_password_submit' });
const fill = async (pw: string, confirm = pw) => {
  fireEvent.change(screen.getByPlaceholderText('new_password_placeholder'), { target: { value: pw } });
  fireEvent.change(screen.getByPlaceholderText('confirm_password_placeholder'), { target: { value: confirm } });
};

describe('ResetPasswordPage', () => {
  it.each([
    ['no token', 'email=owner%40bistro.example'],
    ['no email', 'token=abc'],
    ['nothing at all', ''],
  ])('refuses an incomplete link (%s) and offers a new one', async (_case, qs) => {
    // Showing the form here would make the user pick a password before failing.
    mockSearch = qs;
    render(<ResetPasswordPage />);
    expect(await screen.findByText('reset_link_invalid_title')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('new_password_placeholder')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'reset_password_request_new' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it.each([
    ['too short', 'Aa1!aa'],
    ['no uppercase', 'aaaaaaa1!'],
    ['no lowercase', 'AAAAAAA1!'],
    ['no digit', 'Aaaaaaaa!'],
    ['no special character', 'Aaaaaaa11'],
  ])('rejects a password with %s, matching the backend policy', async (_case, pw) => {
    // Identity's policy (Program.cs) and ResetPasswordCommandValidator both require 8+
    // with upper, lower, digit and special. If this drifts, the user is told their
    // password is fine and then the server refuses it.
    render(<ResetPasswordPage />);
    await fill(pw);
    fireEvent.click(submit());
    expect(await screen.findByText('password_security_rules_error')).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('rejects a mismatched confirmation without touching the network', async () => {
    render(<ResetPasswordPage />);
    await fill('Aa1!aaaa', 'Aa1!aaab');
    fireEvent.click(submit());
    expect(await screen.findByText('passwords_do_not_match')).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('sends the token and email from the URL, decoded', async () => {
    // The token is URL-encoded in the emailed link and must reach the API decoded, or
    // Identity rejects a token that was actually correct.
    mockResetPassword.mockResolvedValue({ succeeded: true });
    render(<ResetPasswordPage />);
    await fill('Aa1!aaaa');
    fireEvent.click(submit());
    await waitFor(() =>
      expect(mockResetPassword).toHaveBeenCalledWith({
        email: 'owner@bistro.example',
        token: 'CfDJ8AbC/def==',
        newPassword: 'Aa1!aaaa', // pragma: allowlist secret -- test fixture, never a real credential
        confirmPassword: 'Aa1!aaaa', // pragma: allowlist secret -- test fixture
      }),
    );
    expect(await screen.findByText('reset_password_success_title')).toBeInTheDocument();
  });

  it("surfaces the server's reason for a refused token", async () => {
    // An expired or already-used link is the common failure, and the user needs to know to
    // request a new one rather than retype a password that was never the problem.
    mockResetPassword.mockResolvedValue({
      succeeded: false,
      messages: ['Invalid token.'],
    });
    render(<ResetPasswordPage />);
    await fill('Aa1!aaaa');
    fireEvent.click(submit());
    expect(await screen.findByText('Invalid token.')).toBeInTheDocument();
    expect(screen.queryByText('reset_password_success_title')).not.toBeInTheDocument();
  });

  it('falls back to a generic error when the request throws', async () => {
    mockResetPassword.mockRejectedValue(new Error('offline'));
    render(<ResetPasswordPage />);
    await fill('Aa1!aaaa');
    fireEvent.click(submit());
    expect(await screen.findByText('unexpected_error')).toBeInTheDocument();
  });
});
