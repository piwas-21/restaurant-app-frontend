import { fireEvent, render, screen } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
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

  // #414. `requestAccountDeletion` used to be a raw `fetch` returning `response.json()` for every
  // status, so a non-2xx never threw with anything readable and this catch could only ever print the
  // generic sentence. It goes through `apiClient` now, so a thrown failure carries the server's own
  // words.
  //
  // A 500, deliberately — it is what this endpoint can actually raise. A 429 is not: `UserController`
  // rate-limits `register` only. Nor a 502: the handler treats its email send as non-fatal in its own
  // catch. Mocking either would pin a shape no producer emits.
  it('prints a server-authored reason that arrives as a THROWN failure', async () => {
    mockRequest.mockRejectedValue(new ApiError(500, 'An error occurred while processing your request'));
    render(<DeleteAccountSection />);
    fireEvent.click(deleteButton());

    expect(await screen.findByText(/An error occurred while processing your request/)).toBeInTheDocument();
    expect(screen.queryByText('An unexpected error occurred.')).not.toBeInTheDocument();
  });

  it('still falls back for a body-less 401 — an empty message is not a sentence', async () => {
    // The expired-session case. `apiClient` signs a genuinely dead session out and navigates, so
    // usually nothing renders from here at all; when it does, `ApiError(401, '')` carries no words
    // and the translated sentence is the honest answer. Pins that `''` does not reach the screen.
    mockRequest.mockRejectedValue(new ApiError(401, ''));
    render(<DeleteAccountSection />);
    fireEvent.click(deleteButton());

    expect(await screen.findByText('An unexpected error occurred.')).toBeInTheDocument();
  });

  it('confirms the request on success', async () => {
    mockRequest.mockResolvedValue({ success: true });
    render(<DeleteAccountSection />);
    fireEvent.click(deleteButton());

    expect(await screen.findByText(/We sent a confirmation email/)).toBeInTheDocument();
  });
});
