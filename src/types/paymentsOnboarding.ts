/**
 * Frontend mirror of the backend `Features/Payments/Dtos/PaymentsOnboardingDto`
 * (SOFRA-PAYMENTS-PLAN §9 P7a).
 *
 * Source of truth: `backend/RestaurantSystem.Api/Features/Payments/`. Keep field names and
 * nullability in lock-step — the .NET camelCase serialiser is what this reflects.
 */

/**
 * The `state` vocabulary. A UNION rather than a boolean, which is what let P7b add the middle
 * value without replacing anything this bundle already read.
 *
 * `awaitingVerification` means Stripe reports `charges_enabled: false` — the restaurant is
 * plumbed in and Stripe has not finished checking their business. `configured` is the weaker
 * claim of the two: either Stripe says charges are enabled, or the backend could not read the
 * account at all and is reporting what configuration alone supports.
 *
 * An unknown value arriving from a newer backend must render as guidance, never crash — see
 * `PaymentsTab`, which treats anything it does not recognise as not configured.
 */
export type PaymentsOnboardingState = 'notConfigured' | 'awaitingVerification' | 'configured';

export interface PaymentsOnboardingDto {
  state: PaymentsOnboardingState;
  /** The tenant's own `acct_…`, or null when Stripe is not usable here yet. */
  connectedAccountId: string | null;
  /**
   * Where to send the restaurant so it can reach its own Stripe account, or null when there is
   * nowhere honest to send it yet.
   *
   * NOT a Stripe URL. Under Connect Express the restaurant has no full Stripe dashboard, an
   * onboarding link dies 300 seconds after it is minted, and a login link is refused outright
   * until onboarding is finished — so the value is a page of ours that mints a fresh Stripe link
   * per click, and the backend reports null while no such page is configured.
   *
   * This field replaced `dashboardUrl` rather than being renamed in place, and the rename is the
   * safety property: an older bundle reading `dashboardUrl` off a newer backend gets `undefined`
   * and renders an inert control, and a newer bundle reading this field off an older backend gets
   * `undefined` and does the same. Keeping the old name would instead have let a new bundle open
   * `https://dashboard.stripe.com` — a login an Express account holder does not have.
   */
  paymentsLinkUrl: string | null;
  /**
   * How many KYC fields Stripe is still waiting for, or null when we do not know — which covers
   * both "nothing to ask about" and "the read was refused". A COUNT and never the field list:
   * those names are the restaurant's own identity data and Stripe shows them on the page where
   * they can act on them.
   */
  requirementsDue: number | null;
  /**
   * The Sofra commission on this restaurant's online payments, in basis points (100 = 1.00%).
   * OPTIONAL: the backend ships this field in a separate change that may merge after this one,
   * so for a period it will simply be absent from the response. Absent and `0` both mean "no
   * commission" and must render identically — nothing at all. The backend is the source of
   * truth for the value; this bundle only formats what it is told.
   */
  commissionBps?: number;
}
