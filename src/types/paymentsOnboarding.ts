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
  /** The restaurant's own Stripe dashboard. Their login, not ours (Connect Standard). */
  dashboardUrl: string;
  /**
   * How many KYC fields Stripe is still waiting for, or null when we do not know — which covers
   * both "nothing to ask about" and "the read was refused". A COUNT and never the field list:
   * those names are the restaurant's own identity data and Stripe shows them on the page where
   * they can act on them.
   */
  requirementsDue: number | null;
}
