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

  // #414. All four of the handler's refusals — including the expired-token one this link exists to
  // explain — are `Failure` inside `Ok(...)`, so they RESOLVE and are covered by the tests above.
  // What changed is that a non-2xx now arrives carrying the server's sentence instead of being
  // flattened into the generic one.
  //
  // A 500, because that is what this endpoint can raise. NOT a 502: `ConfirmAccountDeletionCommand`
  // sends no email, so `EmailDeliveryException` cannot reach the middleware from here.
  it('prints a server-authored reason that arrives as a THROWN failure', async () => {
    mockConfirm.mockRejectedValue(new ApiError(500, 'An error occurred while processing your request'));
    render(<DeleteAccountPage />);
    fireEvent.click(confirmButton());

    expect(await screen.findByText(/An error occurred while processing your request/)).toBeInTheDocument();
    expect(screen.queryByText('An unexpected error occurred.')).not.toBeInTheDocument();
  });

  it('confirms deletion on success', async () => {
    mockConfirm.mockResolvedValue({ success: true });
    render(<DeleteAccountPage />);
    fireEvent.click(confirmButton());

    expect(await screen.findByText('Account Deleted')).toBeInTheDocument();
  });
});
