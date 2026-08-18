/**
 * Frontend mirror of the backend `Features/Payments/Dtos/PaymentsOnboardingDto`
 * (SOFRA-PAYMENTS-PLAN §9 P7a).
 *
 * Source of truth: `backend/RestaurantSystem.Api/Features/Payments/`. Keep field names and
 * nullability in lock-step — the .NET camelCase serialiser is what this reflects.
 */

/**
 * The `state` vocabulary. A UNION rather than a boolean because P7b adds a third value
 * (`awaitingVerification`), and a boolean would have to be replaced rather than extended.
 *
 * An unknown value arriving from a newer backend must render as guidance, never crash —
 * see `PaymentsTab`, which treats anything that is not `configured` as not configured.
 */
export type PaymentsOnboardingState = 'notConfigured' | 'configured';

export interface PaymentsOnboardingDto {
  state: PaymentsOnboardingState;
  /** The tenant's own `acct_…`, or null when Stripe is not usable here yet. */
  connectedAccountId: string | null;
  /** The restaurant's own Stripe dashboard. Their login, not ours (Connect Standard). */
  dashboardUrl: string;
}
