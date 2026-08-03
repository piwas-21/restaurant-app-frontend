import { fireEvent, render, screen } from '@testing-library/react';
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

  it('reports a transport failure generically — nothing thrown here is showable', async () => {
    // `confirmAccountDeletion` is a raw `fetch` that resolves for every status, so the only
    // throws are a dead network and a non-JSON body. Both carry client-authored text that must
    // not reach a screen, which is why this catch stays bare.
    mockConfirm.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<DeleteAccountPage />);
    fireEvent.click(confirmButton());

    expect(await screen.findByText('An unexpected error occurred.')).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });

  it('confirms deletion on success', async () => {
    mockConfirm.mockResolvedValue({ success: true });
    render(<DeleteAccountPage />);
    fireEvent.click(confirmButton());

    expect(await screen.findByText('Account Deleted')).toBeInTheDocument();
  });
});
