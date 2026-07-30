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
    ['too short', 'Aa1!aa', 'password_security_rules_error'],
    ['no uppercase', 'aaaaaaa1!', 'password_security_rules_error'],
    ['no lowercase', 'AAAAAAA1!', 'password_security_rules_error'],
    ['no digit', 'Aaaaaaaa!', 'password_security_rules_error'],
    ['no special character', 'Aaaaaaa11', 'password_security_rules_error'],
    // The rule the first version missed — and its own happy-path fixture broke it, so the
    // client accepted a password the server refuses.
    ['a character repeated 3x', 'Aa1!aaaa', 'password_rule_repeated_chars'],
  ])('rejects %s before any request, per @/lib/passwordPolicy', async (_case, pw, key) => {
    render(<ResetPasswordPage />);
    await fill(pw);
    fireEvent.click(submit());
    expect(await screen.findByText(key)).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('rejects a mismatched confirmation without touching the network', async () => {
    render(<ResetPasswordPage />);
    await fill('Str0ng!pass', 'Str0ng!passX');
    fireEvent.click(submit());
    expect(await screen.findByText('passwords_do_not_match')).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('sends the token and email from the URL, decoded', async () => {
    // The token is URL-encoded in the emailed link and must reach the API decoded, or
    // Identity rejects a token that was actually correct.
    mockResetPassword.mockResolvedValue({ success: true, message: 'Password has been reset successfully' });
    render(<ResetPasswordPage />);
    await fill('Str0ng!pass');
    fireEvent.click(submit());
    await waitFor(() =>
      expect(mockResetPassword).toHaveBeenCalledWith({
        email: 'owner@bistro.example',
        token: 'CfDJ8AbC/def==',
        newPassword: 'Str0ng!pass', // pragma: allowlist secret -- test fixture, never a real credential
        confirmPassword: 'Str0ng!pass', // pragma: allowlist secret -- test fixture
      }),
    );
    expect(await screen.findByText('reset_password_success_title')).toBeInTheDocument();
  });

  it("shows a LOCAL failure message and never the server's reason", async () => {
    // Surfacing `errors[0]` would leak account existence: the backend answers
    // "Invalid reset request" for an unknown email and Identity's "Invalid token." for a
    // real user, so /reset-password?email=<guess> would distinguish them. It would also put
    // untranslated English in a 10-locale app.
    // The REAL ApiResponse shape (Common/Models/ApiResponse.cs, camelCase): the specific
    // reason lives in `errors`, and `message` is a fixed wrapper string.
    mockResetPassword.mockResolvedValue({
      success: false,
      message: 'Password reset failed',
      errors: ['Invalid token.'],
    });
    render(<ResetPasswordPage />);
    await fill('Str0ng!pass');
    fireEvent.click(submit());
    expect(await screen.findByText('reset_password_failed')).toBeInTheDocument();
    expect(screen.queryByText('Invalid token.')).not.toBeInTheDocument();
    expect(screen.queryByText('Password reset failed')).not.toBeInTheDocument();
    expect(screen.queryByText('reset_password_success_title')).not.toBeInTheDocument();
  });

  it('falls back to a generic error when the request throws', async () => {
    mockResetPassword.mockRejectedValue(new Error('offline'));
    render(<ResetPasswordPage />);
    await fill('Str0ng!pass');
    fireEvent.click(submit());
    expect(await screen.findByText('unexpected_error')).toBeInTheDocument();
  });
});
