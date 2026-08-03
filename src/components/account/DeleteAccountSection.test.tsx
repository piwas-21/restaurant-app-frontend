import { fireEvent, render, screen } from '@testing-library/react';
import DeleteAccountSection from './DeleteAccountSection';

const mockRequest = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
jest.mock('@/services/authService', () => ({
  requestAccountDeletion: (...args: unknown[]) => mockRequest(...args),
}));

beforeEach(() => jest.clearAllMocks());

const deleteButton = () => screen.getAllByRole('button')[0];

describe('DeleteAccountSection — the refusal reason (E9)', () => {
  it('prints the server’s reason, not its placeholder summary', async () => {
    // `RequestAccountDeletionCommandHandler` returns `ApiResponse.Failure("User not found")`, and
    // that overload puts the reason in `errors[0]` while `Message` keeps its default "Operation
    // failed" (ApiResponse.cs). The old `response.message ||` therefore printed the placeholder
    // and never reached the translated fallback behind it.
    mockRequest.mockResolvedValue({ success: false, message: 'Operation failed', errors: ['User not found'] });
    render(<DeleteAccountSection />);
    fireEvent.click(deleteButton());

    expect(await screen.findByText('User not found')).toBeInTheDocument();
    expect(screen.queryByText('Operation failed')).not.toBeInTheDocument();
  });

  it('falls back to the translated sentence when the body carries no reason', async () => {
    // Blank-but-present, not absent: with no `message` key at all, `undefined || t(…)` and
    // `serverMessages(…)[0] ?? t(…)` behave identically and this pins nothing.
    mockRequest.mockResolvedValue({ success: false, message: '   ' });
    render(<DeleteAccountSection />);
    fireEvent.click(deleteButton());

    expect(await screen.findByText('Failed to request account deletion.')).toBeInTheDocument();
  });

  it('reports a transport failure generically — nothing thrown here is showable', async () => {
    mockRequest.mockRejectedValue(new SyntaxError('Unexpected token < in JSON at position 0'));
    render(<DeleteAccountSection />);
    fireEvent.click(deleteButton());

    expect(await screen.findByText('An unexpected error occurred.')).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected token/)).not.toBeInTheDocument();
  });

  it('confirms the request on success', async () => {
    mockRequest.mockResolvedValue({ success: true });
    render(<DeleteAccountSection />);
    fireEvent.click(deleteButton());

    expect(await screen.findByText(/We sent a confirmation email/)).toBeInTheDocument();
  });
});
