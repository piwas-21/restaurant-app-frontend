import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStripeAcceptanceScenario } from './e2e-p11-stripe-scenarios.mjs';

test('keeps four-phone as the default and only selects its existing spec', () => {
  assert.deepEqual(resolveStripeAcceptanceScenario(), {
    name: 'four-phone',
    testSpec: 'e2e/p11-stripe/tests/table-payment-checkout.e2e.ts',
  });
  assert.deepEqual(resolveStripeAcceptanceScenario('four-phone'), resolveStripeAcceptanceScenario());
});

test('selects the dedicated mixed-tender spec without changing the four-phone oracle', () => {
  assert.deepEqual(resolveStripeAcceptanceScenario('mixed-tender'), {
    name: 'mixed-tender',
    testSpec: 'e2e/p11-stripe/tests/table-account-mixed-tender.e2e.ts',
  });
});

test('rejects arbitrary and misspelled scenario values', () => {
  for (const value of ['../../e2e/tests', 'Four-Phone', '', null, ['mixed-tender']])
    assert.throws(() => resolveStripeAcceptanceScenario(value), /explicit local Stripe acceptance scenarios/);
});
