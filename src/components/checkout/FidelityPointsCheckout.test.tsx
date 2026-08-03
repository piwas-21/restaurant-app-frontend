import { act, render, screen } from '@testing-library/react';
import FidelityPointsCheckout from './FidelityPointsCheckout';
import { fidelityPointsService } from '@/services/fidelityPointsService';
import { ApiError } from '@/utils/apiClient';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
jest.mock('@/services/fidelityPointsService', () => ({
  fidelityPointsService: { getBalance: jest.fn(), calculateDiscount: jest.fn() },
}));

const service = fidelityPointsService as unknown as { getBalance: jest.Mock };

beforeEach(() => jest.clearAllMocks());

/**
 * Two failures that are not the same failure (E9 slice 8). Both used to be swallowed by one bare
 * catch, so a signed-in customer's redemption panel vanished mid-checkout with no explanation and
 * they could not spend a balance they can see in their own account.
 */
describe('FidelityPointsCheckout — a guest 401 is not an outage', () => {
  it('renders nothing at all for a guest', async () => {
    // Driven off a promise this test settles itself. `waitFor(getBalance was called)` resolves on
    // the first tick — before the rejection is even processed — so an "expect nothing" assertion
    // behind it passes against a component that would go on to render the notice. Proven: with
    // the 401 branch mutated away, that version still passed.
    let reject!: (reason: unknown) => void;
    service.getBalance.mockReturnValue(
      new Promise((_resolve, rj) => {
        reject = rj;
      }),
    );
    const { container } = render(<FidelityPointsCheckout orderSubtotal={40} />);

    await act(async () => {
      reject(new ApiError(401, ''));
      await Promise.resolve();
    });

    // Saying "Failed to load your points" here would invent a feature the guest does not have.
    expect(container).toBeEmptyDOMElement();
  });

  it('tells a signed-in customer why the panel is missing, and that the order can still go ahead', async () => {
    service.getBalance.mockRejectedValue(new ApiError(503, 'Loyalty service is being upgraded'));
    render(<FidelityPointsCheckout orderSubtotal={40} />);

    expect(await screen.findByText('Loyalty service is being upgraded')).toBeInTheDocument();
  });

  it('falls back to the translated notice when the server authored no sentence', async () => {
    service.getBalance.mockRejectedValue(new ApiError(500, ''));
    render(<FidelityPointsCheckout orderSubtotal={40} />);

    expect(await screen.findByText('fidelity_balance_unavailable')).toBeInTheDocument();
  });

  it('a re-load that fails replaces the panel with the notice, rather than leaving a dead one', async () => {
    // The ordinary sequence, not an exotic one: this effect keys on `orderSubtotal`, which arrives
    // as 0 while the basket is still null and then as the real figure. So "first load succeeded,
    // second failed" happens on a normal checkout — and leaving the stale balance up rendered the
    // full redemption panel with a slider capped from the OLD subtotal, while the notice went into
    // state that only renders when there is no balance.
    service.getBalance.mockResolvedValueOnce({ currentPoints: 500, currentPointsValue: 5 });
    const { rerender } = render(<FidelityPointsCheckout orderSubtotal={0} />);
    expect(await screen.findByText(/Your Current Balance/)).toBeInTheDocument();

    service.getBalance.mockRejectedValueOnce(new ApiError(503, 'Loyalty service is being upgraded'));
    rerender(<FidelityPointsCheckout orderSubtotal={40} />);

    expect(await screen.findByText('Loyalty service is being upgraded')).toBeInTheDocument();
    expect(screen.queryByText(/Your Current Balance/)).not.toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('shows the balance when it loads', async () => {
    service.getBalance.mockResolvedValue({ currentPoints: 500, currentPointsValue: 5 });
    render(<FidelityPointsCheckout orderSubtotal={40} />);

    expect(await screen.findByText(/Your Current Balance/)).toBeInTheDocument();
    expect(screen.queryByText('fidelity_balance_unavailable')).not.toBeInTheDocument();
  });
});
