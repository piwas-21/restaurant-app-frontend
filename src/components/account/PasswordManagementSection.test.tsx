import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import { useAccountPassword } from '@/hooks/account/useAccountPassword';
import PasswordManagementSection from './PasswordManagementSection';

/**
 * The account password section, wired to its real hook — the two are one feature and testing the
 * component alone would pin nothing: every branch this suite exists for is decided by the
 * `GET /api/Auth/has-password` answer the hook reads.
 *
 * A Google/Apple account has no password, so `POST /api/Auth/change-password` — which verifies
 * `currentPassword` — can never succeed for it. Two things must hold, and the second is the one
 * that is easy to lose in a refactor: the set-password variant appears when the server says the
 * account has none, and the section keeps TODAY's behaviour whenever the probe does not answer
 * (older backend, dead network, 401). Assuming "no password" on a failed probe would offer every
 * user a form the server refuses.
 */

const mockHasPassword = jest.fn();
const mockSetPassword = jest.fn();
const mockChangePassword = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

jest.mock('@/services/authService', () => ({
  hasPassword: () => mockHasPassword(),
  setPassword: (...args: unknown[]) => mockSetPassword(...args),
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
}));

function Harness() {
  const password = useAccountPassword();
  return <PasswordManagementSection {...password} getStrengthBarStyle={() => ''} />;
}

const VALID = 'Str0ng!pass';

beforeEach(() => {
  jest.clearAllMocks();
  mockSetPassword.mockResolvedValue({ success: true, data: 'ok' });
  mockChangePassword.mockResolvedValue({ success: true });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  // The probe logs its non-answer for devtools and shows nothing — see the assertions below that
  // no banner appears. Silenced here only to keep the run readable.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

function typeNewPassword() {
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: VALID } });
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: VALID } });
}

describe('PasswordManagementSection — the account with no password', () => {
  it('renders the SET variant, with no current-password field, and submits to set-password', async () => {
    mockHasPassword.mockResolvedValue({ success: true, data: false });
    render(<Harness />);

    expect(await screen.findByText('Set a Password')).toBeInTheDocument();
    expect(screen.queryByText('Password Management')).not.toBeInTheDocument();
    // The field is not merely hidden — it must not exist, because there is nothing to prove and
    // the hook's validation would otherwise demand it and never let the form through.
    expect(screen.queryByLabelText('Current Password')).not.toBeInTheDocument();
    expect(
      screen.getByText(/You signed in with Google or Apple, so your account has no password yet/),
    ).toBeInTheDocument();

    typeNewPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Set Password' }));

    await waitFor(() => expect(mockSetPassword).toHaveBeenCalledTimes(1));
    expect(mockSetPassword).toHaveBeenCalledWith({ newPassword: VALID, confirmPassword: VALID });
    expect(mockChangePassword).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Password set. You can now sign in with your email and password.'),
    ).toBeInTheDocument();
  });

  it('turns into the CHANGE variant once the password exists — the server refuses a second set', async () => {
    mockHasPassword.mockResolvedValue({ success: true, data: false });
    render(<Harness />);
    await screen.findByText('Set a Password');

    typeNewPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Set Password' }));

    expect(await screen.findByText('Password Management')).toBeInTheDocument();
    expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
  });

  it('switches to the CHANGE form when the server says the account already has a password', async () => {
    mockHasPassword.mockResolvedValueOnce({ success: true, data: false });
    // The refusal the contract tells clients to ACT on. Branching on `errorCode`, never on the
    // English sentence: the account has a password after all (set on another device, or the probe
    // was answered before it was), so the set form can never succeed and printing the reason while
    // leaving the form as it was traps the user on it.
    mockSetPassword.mockRejectedValue(
      new ApiError(
        400,
        'This account already has a password. Use change-password to change it.',
        ['This account already has a password. Use change-password to change it.'],
        'PasswordAlreadySet',
      ),
    );
    // The re-read the contract asks for (suggested client flow, step 4).
    mockHasPassword.mockResolvedValue({ success: true, data: true });
    render(<Harness />);
    await screen.findByText('Set a Password');

    typeNewPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Set Password' }));

    expect(await screen.findByText('Password Management')).toBeInTheDocument();
    expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
    expect(
      screen.getByText('This account already has a password. Use change-password to change it.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(mockHasPassword).toHaveBeenCalledTimes(2));
  });

  it('shows the server’s own reason when set-password is refused inside a 200', async () => {
    mockHasPassword.mockResolvedValue({ success: true, data: false });
    // The refusal shape this endpoint actually produces: `Ok(ApiResponse.Failure(...))`, which
    // RESOLVES. A caller that only catches throws reports success on a password never set.
    mockSetPassword.mockResolvedValue({
      success: false,
      message: 'Operation failed',
      errors: ['User already has a password'],
    });
    render(<Harness />);
    await screen.findByText('Set a Password');

    typeNewPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Set Password' }));

    expect(await screen.findByText('User already has a password')).toBeInTheDocument();
    expect(screen.queryByText(/Password set\./)).not.toBeInTheDocument();
  });
});

describe('PasswordManagementSection — the account that has one', () => {
  it('renders the CHANGE variant and submits to change-password', async () => {
    mockHasPassword.mockResolvedValue({ success: true, data: true });
    render(<Harness />);

    expect(await screen.findByText('Password Management')).toBeInTheDocument();
    expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
    expect(screen.queryByText('Set a Password')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'old-one' } });
    typeNewPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledTimes(1));
    expect(mockChangePassword).toHaveBeenCalledWith({
      currentPassword: 'old-one', // pragma: allowlist secret
      newPassword: VALID,
      confirmPassword: VALID,
    });
    expect(mockSetPassword).not.toHaveBeenCalled();
  });
});

describe('PasswordManagementSection — the probe that does not answer', () => {
  it.each([
    ['a 404 from a backend that predates the endpoint', () => mockHasPassword.mockRejectedValue(new ApiError(404, ''))],
    ['a dead network', () => mockHasPassword.mockRejectedValue(new ApiError(0, ''))],
    ['a body that carries no data at all', () => mockHasPassword.mockResolvedValue({ success: true })],
    ['a failure reported inside a 200', () => mockHasPassword.mockResolvedValue({ success: false, data: false })],
  ])('keeps today’s change form on %s — silently', async (_case, arrange) => {
    arrange();
    render(<Harness />);

    expect(await screen.findByText('Password Management')).toBeInTheDocument();
    expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();
    // No banner: the user asked for nothing here, so a failed probe has nothing to tell them.
    expect(screen.queryByText(/Could not set your password/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Could not change password/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'old-one' } });
    typeNewPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledTimes(1));
    expect(mockSetPassword).not.toHaveBeenCalled();
  });
});
