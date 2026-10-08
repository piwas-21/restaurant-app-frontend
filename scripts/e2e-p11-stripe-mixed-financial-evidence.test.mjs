import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import profileGuards from './e2e-p11-stripe-profile.cjs';
import { localP11StripeTarget } from './e2e-p11-stripe-test-target.mjs';
import {
  mixedTenderRunEvidenceFields,
  verifyMixedTenderFinancialEvidence,
} from './e2e-p11-stripe-mixed-financial-evidence.mjs';

const ORIGIN = 'https://api.stripe.com';
const REFUND_METADATA = { sofra_amendment_refund_schema: 'amendment-refund-v1' };

function createFixtureData(profile) {
  const serviceSessionId = randomUUID();
  const orderId = randomUUID();
  const orderItemId = randomUUID();
  const amendmentId = randomUUID();
  const onlineAttemptId = randomUUID();
  const onlineOperationId = randomUUID();
  const cashAttemptId = randomUUID();
  const cashOperationId = randomUUID();
  const resolutionOperationId = randomUUID();
  const onlineLegId = randomUUID();
  const cashLegId = randomUUID();
  const cashReceiptId = randomUUID();
  const cashIntentId = randomUUID();
  const refundAttemptId = randomUUID();
  const providerSessionId = 'cs_test_mixedsession1';
  const providerIntentId = 'pi_mixedintent1';
  const providerChargeId = 'ch_mixedcharge1';
  const providerRefundId = 're_mixedrefund1';
  const allocation = (attemptId, amount) => ({
    attempt_id: attemptId,
    order_id: orderId,
    order_item_id: orderItemId,
    start_ordinal: 1,
    unit_count: 1,
    minor_per_unit: String(amount),
    amount_minor: String(amount),
  });
  const online = {
    attempt_id: onlineAttemptId,
    service_session_id: serviceSessionId,
    operation_id: onlineOperationId,
    mode: 'Amount',
    state: 'Captured',
    payment_method: 'OnlinePayment',
    actor_kind: 'GuestParticipant',
    amount_minor: '501',
    currency: 'CHF',
    provider_session_id: providerSessionId,
    provider_intent_id: providerIntentId,
    provider_charge_id: providerChargeId,
    provider_account_id: profile.connectedAccountId,
    provider_live_mode: false,
    provider_captured_minor: '501',
    provider_refunded_minor: '501',
    reconciliation_required: false,
    role: 'online',
  };
  const cash = {
    attempt_id: cashAttemptId,
    service_session_id: serviceSessionId,
    operation_id: cashOperationId,
    mode: 'Amount',
    state: 'Captured',
    payment_method: 'Cash',
    actor_kind: 'Staff',
    amount_minor: '999',
    currency: 'CHF',
    provider_session_id: null,
    provider_intent_id: null,
    provider_charge_id: null,
    provider_account_id: null,
    provider_live_mode: null,
    provider_captured_minor: null,
    provider_refunded_minor: null,
    reconciliation_required: null,
    role: 'cash',
  };
  const providerRefund = {
    refund_leg_id: onlineLegId,
    refund_attempt_id: refundAttemptId,
    state: 'Succeeded',
    amount_minor: '501',
    currency: 'CHF',
    provider_refund_id: providerRefundId,
    provider_refund_status: 'succeeded',
    provider_charge_id: providerChargeId,
    provider_intent_id: providerIntentId,
    provider_account_id: profile.connectedAccountId,
    provider_live_mode: false,
  };
  const evidence = {
    serviceSessionId,
    orderId,
    amendmentId,
    expectedAttempts: [online, cash],
    allocations: [allocation(onlineAttemptId, 501), allocation(cashAttemptId, 999)],
    cashReceipt: {
      id: cashReceiptId,
      attempt_id: cashAttemptId,
      policy_version: 'chf-cash-5-rappen-v1',
      currency: 'CHF',
      payment_method: 'Cash',
      exact_amount_minor: '999',
      adjustment_minor: '1',
      due_amount_minor: '1000',
      received_minor: '1000',
      change_minor: '0',
      actor_kind: 'Staff',
      actor_role: 'Cashier',
    },
    resolution: {
      id: resolutionOperationId,
      state: 'Resolved',
      currency: 'CHF',
      credit_minor: '1500',
      refund_minor: '1500',
      unpaid_waived_minor: '0',
      service_session_id: serviceSessionId,
      source_order_id: orderId,
      amendment_id: amendmentId,
    },
    refundLegs: [
      {
        id: onlineLegId,
        operation_id: resolutionOperationId,
        account_payment_attempt_id: onlineAttemptId,
        custody: 'StripeDirect',
        state: 'Succeeded',
        amount_minor: '501',
        currency: 'CHF',
        provider_account_id: profile.connectedAccountId,
        provider_live_mode: false,
        provider_charge_id: providerChargeId,
        provider_intent_id: providerIntentId,
      },
      {
        id: cashLegId,
        operation_id: resolutionOperationId,
        account_payment_attempt_id: cashAttemptId,
        custody: 'ManualTill',
        state: 'Succeeded',
        amount_minor: '999',
        currency: 'CHF',
        provider_account_id: null,
        provider_live_mode: null,
        provider_charge_id: null,
        provider_intent_id: null,
      },
    ],
    providerRefunds: [providerRefund],
    cashRefundIntent: {
      id: cashIntentId,
      refund_leg_id: cashLegId,
      attempt_id: cashAttemptId,
      collection_receipt_id: cashReceiptId,
      policy_version: 'chf-cash-5-rappen-v1',
      currency: 'CHF',
      original_exact_amount_minor: '999',
      original_adjustment_minor: '1',
      original_due_amount_minor: '1000',
      previously_refunded_exact_minor: '0',
      previously_refunded_cash_minor: '0',
      exact_refund_amount_minor: '999',
      refund_adjustment_minor: '1',
      cash_refund_amount_minor: '1000',
      retained_exact_amount_minor: '0',
      retained_cash_due_minor: '0',
    },
    cashRefundEvidence: {
      exact_refund_amount_minor: '999',
      refund_adjustment_minor: '1',
      cash_returned_minor: '1000',
      currency: 'CHF',
      actor_role: 'Admin',
    },
    allocationReversals: [
      {
        refund_leg_id: onlineLegId,
        attempt_id: onlineAttemptId,
        order_id: orderId,
        order_item_id: orderItemId,
        start_ordinal: 1,
        unit_count: 1,
        minor_per_unit: '501',
        amount_minor: '501',
      },
      {
        refund_leg_id: cashLegId,
        attempt_id: cashAttemptId,
        order_id: orderId,
        order_item_id: orderItemId,
        start_ordinal: 1,
        unit_count: 1,
        minor_per_unit: '999',
        amount_minor: '999',
      },
    ],
  };
  const metadata = {
    account_payment_attempt: onlineAttemptId,
    sofra_payment_schema: 'account-payment-v1',
  };
  const session = {
    id: providerSessionId,
    mode: 'payment',
    livemode: false,
    currency: 'chf',
    client_reference_id: onlineAttemptId,
    status: 'complete',
    payment_status: 'paid',
    amount_total: 501,
    payment_intent: providerIntentId,
    metadata,
  };
  const intent = {
    id: providerIntentId,
    livemode: false,
    currency: 'chf',
    status: 'succeeded',
    amount: 501,
    amount_received: 501,
    latest_charge: providerChargeId,
    metadata,
  };
  const charge = {
    id: providerChargeId,
    livemode: false,
    currency: 'chf',
    payment_intent: providerIntentId,
    paid: true,
    captured: true,
    disputed: false,
    amount: 501,
    amount_captured: 501,
    amount_refunded: 501,
  };
  const refund = {
    id: providerRefundId,
    object: 'refund',
    amount: 501,
    currency: 'chf',
    status: 'succeeded',
    charge: providerChargeId,
    payment_intent: providerIntentId,
    metadata: {
      ...REFUND_METADATA,
      amendment_resolution_operation: resolutionOperationId,
      amendment_refund_leg: onlineLegId,
      amendment_refund_attempt: refundAttemptId,
    },
  };
  const providerObjects = new Map([
    [`/v1/checkout/sessions/${providerSessionId}`, session],
    [`/v1/payment_intents/${providerIntentId}`, intent],
    [`/v1/charges/${providerChargeId}`, charge],
    [`/v1/refunds?charge=${providerChargeId}&limit=100`, { object: 'list', data: [refund], has_more: false }],
  ]);
  return { evidence, providerObjects };
}

async function fixture(t) {
  const stateDir = mkdtempSync(path.join(tmpdir(), 'p11-mixed-evidence-'));
  const evidenceRoot = path.join(stateDir, 'stripe-evidence');
  const runId = randomBytes(8).toString('hex');
  const { evidenceDir, browserDir } = profileGuards.ensurePrivateArtifactDirectories(runId, evidenceRoot);
  const runEnv = localP11StripeTarget(runId);
  const compose = {
    stateDir,
    runId,
    project: runEnv.P11_COMPOSE_PROJECT,
    args: ['compose', '--env-file', path.join(evidenceDir, 'compose.env'), '-p', runEnv.P11_COMPOSE_PROJECT],
  };
  const profile = {
    profile: 'account-splits-test-v1',
    apiKey: `sk_test_${randomBytes(16).toString('hex')}`,
    connectedAccountId: `acct_${randomBytes(8).toString('hex')}`,
    currency: 'CHF',
  };
  const data = createFixtureData(profile);
  const evidencePath = path.join(browserDir, 'mixed-tender-evidence.json');
  writeFileSync(evidencePath, JSON.stringify(data.evidence), { mode: 0o600, flag: 'wx' });
  t.after(() => rmSync(stateDir, { recursive: true, force: true }));
  return { runId, runEnv, compose, evidenceDir, browserDir, profile, evidencePath, ...data };
}

function makeReader(fixtureValue, calls = []) {
  return async (profile, origin, resource, connected) => {
    calls.push({ origin, resource, connected, accountId: profile.connectedAccountId });
    const value = fixtureValue.providerObjects.get(resource);
    if (value === undefined) throw new Error('Unexpected fixture GET resource.');
    return structuredClone(value);
  };
}

function verify(fixtureValue, reader = makeReader(fixtureValue), overrides = {}) {
  return verifyMixedTenderFinancialEvidence({
    runEnv: overrides.runEnv ?? fixtureValue.runEnv,
    compose: overrides.compose ?? fixtureValue.compose,
    evidenceDir: overrides.evidenceDir ?? fixtureValue.evidenceDir,
    browserDir: overrides.browserDir ?? fixtureValue.browserDir,
    profile: overrides.profile ?? fixtureValue.profile,
    origin: overrides.origin ?? ORIGIN,
    readStripe: reader,
  });
}

function mutateEvidence(filename, mutate) {
  const evidence = JSON.parse(readFileSync(filename, 'utf8'));
  mutate(evidence);
  writeFileSync(filename, JSON.stringify(evidence), { mode: 0o600 });
}

test('proves the exact same-unit mixed tender split and linked Stripe refund with four fresh GETs', async (t) => {
  const current = await fixture(t);
  const calls = [];
  const refund = current.providerObjects.get('/v1/refunds?charge=ch_mixedcharge1&limit=100').data[0];
  assert.equal(refund.object, 'refund');
  assert.equal(Object.hasOwn(refund, 'livemode'), false);
  const proof = await verify(current, makeReader(current, calls));
  assert.deepEqual(proof, {
    verified: true,
    providerMode: 'test',
    currency: 'CHF',
    capturedAttemptCount: 2,
    capturedMinor: 1500,
    onlineCapturedMinor: 501,
    cashCapturedMinor: 999,
    cashDueMinor: 1000,
    cashReceivedMinor: 1000,
    cashChangeMinor: 0,
    refundLegCount: 2,
    refundedMinor: 1500,
    stripeRefundMinor: 501,
    cashExactRefundMinor: 999,
    cashAttestedReturnedMinor: 1000,
    cashRefundAdjustmentMinor: 1,
    unresolvedRefundCount: 0,
    refundListHasMore: false,
    netUnsettledMinor: 0,
    connectedAccountScoped: true,
    providerReadCount: 4,
    onlineAttemptId: current.evidence.expectedAttempts[0].attempt_id,
    cashAttemptId: current.evidence.expectedAttempts[1].attempt_id,
    resolutionOperationId: current.evidence.resolution.id,
  });
  assert.equal(calls.length, 4);
  assert.equal(current.evidence.allocations[0].minor_per_unit !== current.evidence.allocations[1].minor_per_unit, true);
  assert.equal(
    current.evidence.allocations.reduce((total, value) => total + Number(value.amount_minor), 0),
    1500,
  );
  assert.equal(
    calls.every((call) => call.origin === ORIGIN && call.connected),
    true,
  );
  assert.equal(
    calls.every((call) => call.accountId === current.profile.connectedAccountId),
    true,
  );
  assert.equal(mixedTenderRunEvidenceFields(proof).providerCleanupVerified, true);
  assert.equal(
    mixedTenderRunEvidenceFields({ ...proof, cashAttestedReturnedMinor: 999 }).providerCleanupVerified,
    false,
  );
});

test('rejects a different source unit before any provider read', async (t) => {
  const current = await fixture(t);
  mutateEvidence(current.evidencePath, (value) => {
    value.allocations[1].order_item_id = randomUUID();
  });
  const calls = [];
  await assert.rejects(() => verify(current, makeReader(current, calls)));
  assert.equal(calls.length, 0);
});

test('rejects a different source ordinal before any provider read', async (t) => {
  const current = await fixture(t);
  mutateEvidence(current.evidencePath, (value) => {
    value.allocations[1].start_ordinal = 2;
  });
  const calls = [];
  await assert.rejects(() => verify(current, makeReader(current, calls)));
  assert.equal(calls.length, 0);
});

test('rejects an allocation amount that does not match its per-unit contribution', async (t) => {
  const current = await fixture(t);
  mutateEvidence(current.evidencePath, (value) => {
    value.allocations[0].minor_per_unit = '1500';
  });
  const calls = [];
  await assert.rejects(() => verify(current, makeReader(current, calls)));
  assert.equal(calls.length, 0);
});

test('rejects a reversal whose amount or capture linkage differs from its allocation', async (t) => {
  const wrongAmount = await fixture(t);
  mutateEvidence(wrongAmount.evidencePath, (value) => {
    value.allocationReversals[0].minor_per_unit = '1500';
  });
  await assert.rejects(() => verify(wrongAmount));

  const wrongCapture = await fixture(t);
  mutateEvidence(wrongCapture.evidencePath, (value) => {
    value.allocationReversals[0].attempt_id = value.expectedAttempts[1].attempt_id;
  });
  await assert.rejects(() => verify(wrongCapture));
});

test('accepts lowercase provider observation currency and rejects other spellings before provider reads', async (t) => {
  const lowercase = await fixture(t);
  mutateEvidence(lowercase.evidencePath, (value) => {
    value.providerRefunds[0].currency = 'chf';
  });
  const calls = [];
  await verify(lowercase, makeReader(lowercase, calls));
  assert.equal(calls.length, 4);

  const wrongCurrency = await fixture(t);
  mutateEvidence(wrongCurrency.evidencePath, (value) => {
    value.providerRefunds[0].currency = 'EUR';
  });
  const rejectedCalls = [];
  await assert.rejects(() => verify(wrongCurrency, makeReader(wrongCurrency, rejectedCalls)));
  assert.equal(rejectedCalls.length, 0);

  for (const invalidCurrency of [' chf', null, '\u0441\u043d\u0066']) {
    const invalid = await fixture(t);
    mutateEvidence(invalid.evidencePath, (value) => {
      value.providerRefunds[0].currency = invalidCurrency;
    });
    const invalidCalls = [];
    await assert.rejects(() => verify(invalid, makeReader(invalid, invalidCalls)));
    assert.equal(invalidCalls.length, 0);
  }
});

test('keeps cash-attempt and refund-leg currency exact uppercase', async (t) => {
  const lowercaseAttempt = await fixture(t);
  mutateEvidence(lowercaseAttempt.evidencePath, (value) => {
    value.expectedAttempts[1].currency = 'chf';
  });
  const attemptCalls = [];
  await assert.rejects(() => verify(lowercaseAttempt, makeReader(lowercaseAttempt, attemptCalls)));
  assert.equal(attemptCalls.length, 0);

  const lowercaseLeg = await fixture(t);
  mutateEvidence(lowercaseLeg.evidencePath, (value) => {
    value.refundLegs[0].currency = 'chf';
  });
  const calls = [];
  await assert.rejects(() => verify(lowercaseLeg, makeReader(lowercaseLeg, calls)));
  assert.equal(calls.length, 0);
});

test('rejects altered cash rounding or cash-return evidence before provider reads', async (t) => {
  const current = await fixture(t);
  mutateEvidence(current.evidencePath, (value) => {
    value.cashRefundIntent.cash_refund_amount_minor = '999';
  });
  const calls = [];
  await assert.rejects(() => verify(current, makeReader(current, calls)));
  assert.equal(calls.length, 0);
});

test('rejects a valid but unrelated cash collection receipt id before any provider read', async (t) => {
  const current = await fixture(t);
  mutateEvidence(current.evidencePath, (value) => {
    value.cashRefundIntent.collection_receipt_id = randomUUID();
  });
  const calls = [];
  await assert.rejects(() => verify(current, makeReader(current, calls)));
  assert.equal(calls.length, 0);
});

test('rejects duplicate refund legs and provider refund history with an extra refund', async (t) => {
  const current = await fixture(t);
  mutateEvidence(current.evidencePath, (value) => value.refundLegs.push(structuredClone(value.refundLegs[1])));
  await assert.rejects(() => verify(current));

  const next = await fixture(t);
  const reader = makeReader(next);
  const original = reader;
  const extraRefundReader = async (...args) => {
    const result = await original(...args);
    if (args[2].startsWith('/v1/refunds?')) result.data.push({ ...result.data[0], id: 're_extra' });
    return result;
  };
  await assert.rejects(() => verify(next, extraRefundReader));
});

test('rejects provider metadata linked to a different payment attempt', async (t) => {
  const current = await fixture(t);
  const reader = makeReader(current);
  const wrongAccountReader = async (...args) => {
    const result = await reader(...args);
    if (args[2].startsWith('/v1/payment_intents/'))
      result.metadata = { ...result.metadata, account_payment_attempt: randomUUID() };
    return result;
  };
  await assert.rejects(() => verify(current, wrongAccountReader));
});
