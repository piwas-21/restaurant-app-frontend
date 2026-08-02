import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RegisterStaffModal from './RegisterStaffModal';
// Same class object `routeApiError` sees — the alias resolves to the shadowing mock.
import { ApiError } from '@/utils/apiClient';

const mockRegisterStaff = jest.fn();

// Resolves against the REAL en.json rather than echoing keys, so the assertions below are the
// strings a user reads. It matters most for the policy message: `fieldMessage` translates an i18n
// key, and a key-echoing stub would let this suite pass even if the key did not exist in any locale.
jest.mock('react-i18next', () => {
  // Relative, not `@/locales/…` — jest's moduleNameMapper has no entry for that alias.
  const en = jest.requireActual('../../locales/en.json') as Record<string, string>;
  return { useTranslation: () => ({ t: (key: string, def?: string) => en[key] ?? def ?? key }) };
});
jest.mock('@/services/userService', () => ({
  registerStaff: (...args: unknown[]) => mockRegisterStaff(...args),
}));
jest.mock('@/hooks/useRoleHelpers', () => ({
  useRoleHelpers: () => ({ staffRoles: ['Server'], getRoleLabel: (r: string) => r }),
}));

const GOOD_PASSWORD = 'Sofra!2026'; // pragma: allowlist secret -- test fixture, not a credential

function fillAndSubmit(password = GOOD_PASSWORD) {
  const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  type('First Name', 'Ada');
  type('Last Name', 'Lovelace');
  type('Email', 'ada@calc.co');
  type('Password', password);
  type('Confirm Password', password);
  fireEvent.click(screen.getByRole('button', { name: 'Register' }));
}

function renderModal() {
  const onClose = jest.fn();
  const onStaffRegistered = jest.fn();
  render(<RegisterStaffModal isOpen onClose={onClose} onStaffRegistered={onStaffRegistered} />);
  return { onClose, onStaffRegistered };
}

beforeEach(() => jest.clearAllMocks());

describe('RegisterStaffModal', () => {
  it('registers and closes on success', async () => {
    mockRegisterStaff.mockResolvedValue({ success: true });
    const { onClose, onStaffRegistered } = renderModal();

    fillAndSubmit();

    await waitFor(() => expect(onStaffRegistered).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * The reported bug. `apiClient` THROWS `ApiError` for every non-2xx, so a FluentValidation 400
   * never reached the `success === false` branch — it landed in a bare `} catch {`, which discarded
   * the error object entirely and printed "An unexpected error occurred." The server's per-rule
   * message was on the wire the whole time; nothing read it.
   */
  it('shows the password rule the server named, not a generic message', async () => {
    mockRegisterStaff.mockRejectedValue(
      new ApiError(400, 'Validation failed', ['Password must contain at least one uppercase letter']),
    );
    const { onClose } = renderModal();

    fillAndSubmit();

    expect(await screen.findByText('Password must contain at least one uppercase letter')).toBeInTheDocument();
    expect(screen.queryByText(/unexpected error/i)).not.toBeInTheDocument();
    // A failed registration must not close the modal over the message it just produced.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows an Identity rejection returned inside a 200', async () => {
    // `UserController` wraps handler failures in `Ok(...)`, so this shape resolves rather than
    // throwing — the other half of the same defect.
    mockRegisterStaff.mockResolvedValue({
      success: false,
      message: 'Failed to create user',
      errors: ['Passwords must have at least one non alphanumeric character.'],
    });
    renderModal();

    fillAndSubmit();

    expect(await screen.findByText('Passwords must have at least one non alphanumeric character.')).toBeInTheDocument();
  });

  it('never leaves a failure unreported, even when nothing names a field', async () => {
    mockRegisterStaff.mockRejectedValue(new ApiError(500, 'Server exploded'));
    renderModal();

    fillAndSubmit();

    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
  });

  /**
   * The other half of the fix: the form used to accept `min(6)` while the server required 8 plus
   * four character classes, so a weak password was a guaranteed round trip to a 400. Now it never
   * leaves the browser — and the message is translated from an i18n key, not printed raw.
   */
  it('refuses a password the server would reject, without calling the API', async () => {
    renderModal();

    fillAndSubmit('secret1');

    expect(
      await screen.findByText(
        'Password must be at least 8 characters and include uppercase, lowercase, number, and a special character.',
      ),
    ).toBeInTheDocument();
    expect(mockRegisterStaff).not.toHaveBeenCalled();
  });
});
