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

// The default link is a page of OURS, not a Stripe URL: under Connect Express the restaurant has
// no full Stripe dashboard, and the links Stripe does issue live 300 seconds — so the control
// plane mints one per click and this field carries the page that does the minting.
const MINTED_LINK = 'https://sofrapiwas.com/onboarding/payments';

const answer = (dto: Partial<PaymentsOnboardingDto> & Pick<PaymentsOnboardingDto, 'state'>) =>
  mocked.getPaymentsOnboarding.mockResolvedValue({
    success: true,
    data: { connectedAccountId: null, paymentsLinkUrl: MINTED_LINK, requirementsDue: null, ...dto },
  } as never);

beforeEach(() => jest.clearAllMocks());

describe('PaymentsTab', () => {
  it('names the account and links to the page that mints their Stripe link, when configured', async () => {
    answer({ state: 'configured', connectedAccountId: 'acct_1Example' });

    render(<PaymentsTab />);

    expect(await screen.findByText('payments_tab_state_configured')).toBeInTheDocument();
    // The id itself: it is what the owner pastes into a support conversation, and it is
    // the one fact that tells two similar-looking tenants apart.
    expect(screen.getByText('acct_1Example')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'payments_tab_stripe_link' });
    expect(link).toHaveAttribute('href', MINTED_LINK);
    // It is a different origin either way. Opening it without `noopener` hands the new tab a
    // live `window.opener` back into an authenticated admin page.
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    // …and while a real link exists, the page must not ALSO apologise for not having one.
    expect(screen.queryByText('payments_tab_stripe_link_pending')).not.toBeInTheDocument();
  });

  it('offers an inert control and says why, when there is no link to mint yet', async () => {
    // The honest half of the contract. `paymentsLinkUrl` is null until a page exists that can
    // mint a Stripe link on click — a static `https://dashboard.stripe.com` would send an
    // Express account holder to a login they do not have, which is worse than no link at all.
    answer({ state: 'configured', connectedAccountId: 'acct_1Example', paymentsLinkUrl: null });

    render(<PaymentsTab />);

    expect(await screen.findByText('payments_tab_state_configured')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    const control = screen.getByRole('button', { name: 'payments_tab_stripe_link' });
    expect(control).toBeDisabled();
    expect(screen.getByText('payments_tab_stripe_link_pending')).toBeInTheDocument();
  });

  it('says the smaller true thing when nothing is configured, and names no account', async () => {
    answer({ state: 'notConfigured' });

    render(<PaymentsTab />);

    expect(await screen.findByText('payments_tab_state_not_configured')).toBeInTheDocument();
    expect(screen.getByText('payments_tab_not_configured_hint')).toBeInTheDocument();
    expect(screen.queryByText(/acct_/)).not.toBeInTheDocument();
    // Still no control that WRITES anything. §9 constraint 4: every surface here REPORTS, and
    // the writes in this story happen in the control plane and on Stripe's own hosted pages.
    // The one button this page may render is the inert "go to Stripe" affordance, which is
    // absent here because a link was minted — so nothing enabled may appear at all.
    for (const control of screen.queryAllByRole('button')) expect(control).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'retry' })).not.toBeInTheDocument();
  });

  it('reads a state it has never heard of as not configured', async () => {
    // A newer backend ships `awaitingVerification` (P7b) before this bundle does. Guidance
    // is the safe default: it tells the owner to go and finish something, which is never
    // wrong while we are unsure — whereas "you are set up" would be a claim we cannot back.
    answer({ state: 'somethingNewer' as PaymentsOnboardingDto['state'], connectedAccountId: 'acct_1Future' });

    render(<PaymentsTab />);

    expect(await screen.findByText('payments_tab_state_not_configured')).toBeInTheDocument();
  });

  it('says Stripe is still verifying you, and how many details are left', async () => {
    // P7b's whole point. Before it, this window rendered "we are switching this on for you" —
    // the smaller true thing (§9 Q1), because the page could not tell "waiting on Stripe" from
    // "waiting on us". Now it can, in this one state, so it says the larger true thing.
    answer({ state: 'awaitingVerification', connectedAccountId: 'acct_1Kyc', requirementsDue: 14 });

    render(<PaymentsTab />);

    expect(await screen.findByText('payments_tab_state_awaiting')).toBeInTheDocument();
    expect(screen.getByText('payments_tab_awaiting_hint')).toBeInTheDocument();
    expect(screen.getByText('payments_tab_requirements_due')).toBeInTheDocument();
    // Not the other two states — a page that says both is worse than one that says neither.
    expect(screen.queryByText('payments_tab_state_configured')).not.toBeInTheDocument();
    expect(screen.queryByText('payments_tab_state_not_configured')).not.toBeInTheDocument();
  });

  it('does not show a count when the backend did not send one', async () => {
    // The soft-fail's shape: an unreadable account lands on `configured` with a null count, and
    // a count is also null in `awaitingVerification` if the backend ever omits it. Rendering
    // "0 details still to fill in" beside "Stripe is verifying you" reads as finished.
    answer({ state: 'awaitingVerification', connectedAccountId: 'acct_1Kyc', requirementsDue: null });

    render(<PaymentsTab />);

    expect(await screen.findByText('payments_tab_state_awaiting')).toBeInTheDocument();
    expect(screen.queryByText('payments_tab_requirements_due')).not.toBeInTheDocument();
  });

  it('renders the Sofra commission rate as a percentage when the backend sends one', async () => {
    // 150 bps = 1.50%. The backend is the source of truth for the raw number — this bundle
    // only formats what it is told.
    answer({ state: 'configured', commissionBps: 150 });

    render(<PaymentsTab />);

    expect(await screen.findByText('payments_tab_state_configured')).toBeInTheDocument();
    expect(screen.getByText('payments_tab_commission_rate')).toBeInTheDocument();
  });

  it('shows no commission line when the rate is zero', async () => {
    // 0 means "no commission" and must render identically to the field being absent —
    // nothing at all.
    answer({ state: 'configured', commissionBps: 0 });

    render(<PaymentsTab />);

    expect(await screen.findByText('payments_tab_state_configured')).toBeInTheDocument();
    expect(screen.queryByText('payments_tab_commission_rate')).not.toBeInTheDocument();
  });

  it('shows no commission line when the backend has not shipped the field yet', async () => {
    // The backend change ships in a separate PR that may merge after this one — for a period
    // the field is simply absent from the response. Absent must behave exactly like 0, which
    // is what protects this page from a backend that has not caught up yet.
    answer({ state: 'configured' });

    render(<PaymentsTab />);

    expect(await screen.findByText('payments_tab_state_configured')).toBeInTheDocument();
    expect(screen.queryByText('payments_tab_commission_rate')).not.toBeInTheDocument();
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
