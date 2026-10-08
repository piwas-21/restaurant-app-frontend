const SCENARIOS = Object.freeze({
  'four-phone': 'e2e/p11-stripe/tests/table-payment-checkout.e2e.ts',
  'mixed-tender': 'e2e/p11-stripe/tests/table-account-mixed-tender.e2e.ts',
});

export function resolveStripeAcceptanceScenario(value = 'four-phone') {
  if (typeof value !== 'string' || !Object.hasOwn(SCENARIOS, value))
    throw new Error('Choose one of the explicit local Stripe acceptance scenarios.');
  return Object.freeze({ name: value, testSpec: SCENARIOS[value] });
}
