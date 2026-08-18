import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PaymentsTab from './PaymentsTab';
import * as service from '@/services/paymentsOnboardingService';
import { ApiError } from '@/utils/apiClient';
import type { PaymentsOnboardingDto } from '@/types/paymentsOnboarding';

jest.mock('@/services/paymentsOnboardingService');
jest.mock('react-i18next', () => ({
  // The keys ARE the assertions — a translated string would let a wrong key pass by
  // rendering some other locale value that happens to read plausibly.
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mocked = service as jest.Mocked<typeof service>;

const answer = (dto: PaymentsOnboardingDto) =>
  mocked.getPaymentsOnboarding.mockResolvedValue({ success: true, data: dto } as never);

beforeEach(() => jest.clearAllMocks());

describe('PaymentsTab', () => {
  it('names the account and links to the restaurant OWN dashboard when configured', async () => {
    answer({
      state: 'configured',
      connectedAccountId: 'acct_1Example',
      dashboardUrl: 'https://dashboard.stripe.com',
    });

    render(<PaymentsTab />);

    expect(await screen.findByText('payments_tab_state_configured')).toBeInTheDocument();
    // The id itself: it is what the owner pastes into a support conversation, and it is
    // the one fact that tells two similar-looking tenants apart.
    expect(screen.getByText('acct_1Example')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'payments_tab_dashboard_link' });
    expect(link).toHaveAttribute('href', 'https://dashboard.stripe.com');
    // Their dashboard is a third-party origin. Opening it without `noopener` hands the
    // new tab a live `window.opener` back into an authenticated admin page.
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('says the smaller true thing when nothing is configured, and names no account', async () => {
    answer({ state: 'notConfigured', connectedAccountId: null, dashboardUrl: 'https://dashboard.stripe.com' });

    render(<PaymentsTab />);

    expect(await screen.findByText('payments_tab_state_not_configured')).toBeInTheDocument();
    expect(screen.getByText('payments_tab_not_configured_hint')).toBeInTheDocument();
    expect(screen.queryByText(/acct_/)).not.toBeInTheDocument();
    // No control of any kind. §9 constraint 4: every surface here REPORTS, and the only
    // writes in this story are the founder's registry PR and Stripe's own hosted pages.
    // A button would promise a switch that does not exist.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('reads a state it has never heard of as not configured', async () => {
    // A newer backend ships `awaitingVerification` (P7b) before this bundle does. Guidance
    // is the safe default: it tells the owner to go and finish something, which is never
    // wrong while we are unsure — whereas "you are set up" would be a claim we cannot back.
    answer({
      state: 'awaitingVerification' as PaymentsOnboardingDto['state'],
      connectedAccountId: 'acct_1Future',
      dashboardUrl: 'https://dashboard.stripe.com',
    });

    render(<PaymentsTab />);

    expect(await screen.findByText('payments_tab_state_not_configured')).toBeInTheDocument();
  });

  it('offers a retry rather than a blank strip when the read fails', async () => {
    mocked.getPaymentsOnboarding.mockRejectedValue(new Error('offline'));

    render(<PaymentsTab />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('payments_tab_load_failed');
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument();
    // …and it must NOT claim either state while it does not know one.
    expect(screen.queryByText('payments_tab_state_configured')).not.toBeInTheDocument();
    expect(screen.queryByText('payments_tab_state_not_configured')).not.toBeInTheDocument();
  });

  it("renders the server's own sentence when it wrote one", async () => {
    // E9: a `capture()` whose message is never rendered swallows the failure silently and
    // type-checks. The server knows more than we do about why it refused; our fallback is
    // for when it said nothing.
    mocked.getPaymentsOnboarding.mockRejectedValue(new ApiError(503, 'Payment settings are temporarily unavailable'));

    render(<PaymentsTab />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Payment settings are temporarily unavailable');
  });

  it('asks the server exactly once on mount, even when the answer is a failure', async () => {
    // The loop guard. `useApiError` memoises its whole surface, so its identity changes on
    // every capture and clear; a `load` that depended on the surface rather than on its
    // stable callbacks would re-fire the mount effect forever — and only on the path where
    // the endpoint is already failing, which is the worst place to discover it.
    mocked.getPaymentsOnboarding.mockRejectedValue(new Error('offline'));

    render(<PaymentsTab />);

    await screen.findByRole('alert');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mocked.getPaymentsOnboarding).toHaveBeenCalledTimes(1);
  });

  it('treats a 200 with no data as a failure, not as "not configured"', async () => {
    // `apiClient` resolves an envelope; a `success:false` or an empty body is not an
    // answer about Stripe and must not be rendered as one.
    mocked.getPaymentsOnboarding.mockResolvedValue({ success: false } as never);

    render(<PaymentsTab />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('payments_tab_load_failed'));
  });
});
