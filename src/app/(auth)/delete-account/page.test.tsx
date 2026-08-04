import { fireEvent, render, screen } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import DeleteAccountPage from './page';

const mockConfirm = jest.fn();
const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/services/authService', () => ({
  confirmAccountDeletion: (...args: unknown[]) => mockConfirm(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams({ token: 'tok', userId: 'u1' });
});

const confirmButton = () => screen.getByRole('button', { name: /Yes, Delete My Account/ });

describe('DeleteAccountPage — the refusal reason (E9)', () => {
  it('prints the server’s reason, not its placeholder summary', async () => {
    // This is the exact body `ConfirmAccountDeletionCommandHandler` produces for a spent link:
    // `ApiResponse.Failure("Invalid or expired deletion token")` puts the reason in `errors[0]`
    // and leaves `Message` at the DEFAULT "Operation failed" (ApiResponse.cs). The old code read
    // `response.message ||`, so the `||` never fired and the customer was shown the placeholder.
    mockConfirm.mockResolvedValue({
      success: false,
      message: 'Operation failed',
      errors: ['Invalid or expired deletion token'],
    });
    render(<DeleteAccountPage />);
    fireEvent.click(confirmButton());

    expect(await screen.findByText('Invalid or expired deletion token')).toBeInTheDocument();
    expect(screen.queryByText('Operation failed')).not.toBeInTheDocument();
  });

  it('falls back to the translated sentence when the body carries no reason', async () => {
    // `message: '   '` rather than an absent key: with no `message` at all, `undefined || t(…)`
    // and `serverMessages(…)[0] ?? t(…)` are indistinguishable and the test pins nothing. Blank
    // but present is the shape only `serverMessages` handles — `presentable()` rejects it.
    mockConfirm.mockResolvedValue({ success: false, message: '   ' });
    render(<DeleteAccountPage />);
    fireEvent.click(confirmButton());

    expect(await screen.findByText('Failed to delete account.')).toBeInTheDocument();
  });

  it('reports a transport failure generically — its text is not showable', async () => {
    // A dead network and a non-JSON body carry client-authored text that must not reach a screen,
    // so the translated sentence is the honest answer for them. (#414 changed what ELSE can arrive
    // here, not this: see the thrown-server-sentence case below.)
    mockConfirm.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<DeleteAccountPage />);
    fireEvent.click(confirmButton());

    expect(await screen.findByText('An unexpected error occurred.')).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });

  // #414. The handler's own refusals still RESOLVE — the controller returns `Ok(...)` even for a
  // failure envelope, so an expired deletion token is a 200 and stays on the branch above. What
  // changed is that a transport-level failure now arrives as an `ApiError` carrying the server's
  // sentence rather than being flattened into the generic one. This link is one-shot and emailed,
  // so the reason is the whole fix.
  it('prints a server-authored reason that arrives as a THROWN failure', async () => {
    mockConfirm.mockRejectedValue(new ApiError(502, 'The email could not be delivered. Please try again later.'));
    render(<DeleteAccountPage />);
    fireEvent.click(confirmButton());

    expect(await screen.findByText(/could not be delivered/)).toBeInTheDocument();
    expect(screen.queryByText('An unexpected error occurred.')).not.toBeInTheDocument();
  });

  it('confirms deletion on success', async () => {
    mockConfirm.mockResolvedValue({ success: true });
    render(<DeleteAccountPage />);
    fireEvent.click(confirmButton());

    expect(await screen.findByText('Account Deleted')).toBeInTheDocument();
  });
});
