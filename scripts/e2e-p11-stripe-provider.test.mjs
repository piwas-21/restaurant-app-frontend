import test from 'node:test';
import assert from 'node:assert/strict';
import { stripeRead, validateStripeApiOrigin, verifyCapturedProviderObjects } from './e2e-p11-stripe-provider.mjs';

// Independent fixed provider shapes: expected cents are not derived from this verifier.
const expected = {
  attemptId: '44f12379-4bbc-4f05-a787-742a957470fd',
  amountMinor: 1001,
  refundedMinor: 0,
  currency: 'CHF',
  sessionId: 'cs_test_fixture',
  intentId: 'pi_fixture',
  chargeId: 'ch_fixture',
};
const metadata = { account_payment_attempt: expected.attemptId, sofra_payment_schema: 'account-payment-v1' };
function providerObjects() {
  return {
    session: {
      id: 'cs_test_fixture',
      mode: 'payment',
      livemode: false,
      currency: 'chf',
      client_reference_id: expected.attemptId,
      status: 'complete',
      payment_status: 'paid',
      amount_total: 1001,
      payment_intent: 'pi_fixture',
      metadata: { ...metadata },
    },
    intent: {
      id: 'pi_fixture',
      livemode: false,
      currency: 'chf',
      status: 'succeeded',
      amount: 1001,
      amount_received: 1001,
      latest_charge: 'ch_fixture',
      metadata: { ...metadata },
    },
    charge: {
      id: 'ch_fixture',
      livemode: false,
      currency: 'chf',
      payment_intent: 'pi_fixture',
      paid: true,
      captured: true,
      disputed: false,
      amount: 1001,
      amount_captured: 1001,
      amount_refunded: 0,
    },
  };
}

test('verifies exact Session, Intent and Charge evidence for one frozen test attempt', () => {
  const { session, intent, charge } = providerObjects();
  assert.deepEqual(verifyCapturedProviderObjects(expected, session, intent, charge), {
    capturedMinor: 1001,
    refundedMinor: 0,
    currency: 'CHF',
  });
});

test('a return or paid Session alone cannot substitute for exact captured money', () => {
  for (const [object, field, value] of [
    ['session', 'payment_status', 'unpaid'],
    ['session', 'status', 'open'],
    ['intent', 'amount_received', 1000],
    ['intent', 'status', 'processing'],
    ['charge', 'captured', false],
    ['charge', 'amount_captured', 1000],
    ['charge', 'disputed', true],
    ['charge', 'amount_refunded', 1],
  ]) {
    const objects = providerObjects();
    objects[object][field] = value;
    assert.throws(() => verifyCapturedProviderObjects(expected, objects.session, objects.intent, objects.charge));
  }
});

test('rejects wrong mode, currency, attempt metadata, and cross-linked provider objects', () => {
  for (const [object, field, value] of [
    ['session', 'livemode', true],
    ['intent', 'livemode', true],
    ['charge', 'livemode', true],
    ['intent', 'currency', 'eur'],
    ['session', 'client_reference_id', 'another-attempt'],
    ['session', 'payment_intent', 'pi_other'],
    ['intent', 'latest_charge', 'ch_other'],
    ['charge', 'payment_intent', 'pi_other'],
  ]) {
    const objects = providerObjects();
    objects[object][field] = value;
    assert.throws(() => verifyCapturedProviderObjects(expected, objects.session, objects.intent, objects.charge));
  }
  for (const object of ['session', 'intent']) {
    const objects = providerObjects();
    objects[object].metadata.account_payment_attempt = 'another-attempt';
    assert.throws(() => verifyCapturedProviderObjects(expected, objects.session, objects.intent, objects.charge));
  }
});

test('never sends a key to arbitrary, credential-bearing or non-TLS verification origins', () => {
  assert.equal(validateStripeApiOrigin('https://api.stripe.com'), 'https://api.stripe.com');
  for (const raw of [
    'http://api.stripe.com',
    'https://api.stripe.com.evil.invalid',
    'https://name:secret@api.stripe.com', // pragma: allowlist secret -- Synthetic rejected basic-auth URL
    'https://api.stripe.com/proxy',
    'https://api.stripe.com?key=secret',
    'https://api.stripe.com#fragment',
    'https://api.stripe.com:444',
  ])
    assert.throws(() => validateStripeApiOrigin(raw));
});

test('live credentials are rejected before any provider subprocess or request', async () => {
  await assert.rejects(
    stripeRead(
      {
        profile: 'account-splits-test-v1',
        apiKey: `sk_live_${'a1'.repeat(16)}`,
        connectedAccountId: `acct_${'b2'.repeat(8)}`,
        currency: 'CHF',
      },
      'https://api.stripe.com',
      '/v1/balance',
    ),
    /full test secret/,
  );
});
