import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import profileGuards from './e2e-p11-stripe-profile.cjs';
import { localP11StripeTarget } from './e2e-p11-stripe-test-target.mjs';
import { stripeRunEvidenceFields, verifyStripeFinancialEvidence } from './e2e-p11-stripe-financial-evidence.mjs';

const ORIGIN = 'https://api.stripe.com';
const AMOUNTS = [
  ['Items', 1500],
  ['Amount', 501],
  ['Equal', 1250],
  ['Equal', 1249],
];
const REFUND_METADATA = {
  sofra_amendment_refund_schema: 'amendment-refund-v1',
};

function createFixtureData(profile) {
  const serviceSessionId = randomUUID();
  const attempts = AMOUNTS.map(([mode, amountMinor]) => ({
    attemptId: randomUUID(),
    operationId: randomUUID(),
    mode,
    amountMinor,
  }));
  const storedAttempts = attempts.map((attempt, index) => ({
    attempt_id: attempt.attemptId,
    operation_id: attempt.operationId,
    mode: attempt.mode,
    state: 'Captured',
    amount_minor: String(attempt.amountMinor),
    currency: 'CHF',
    provider_session_id: `cs_test_session${index + 1}`,
    provider_intent_id: `pi_intent${index + 1}`,
    provider_charge_id: `ch_charge${index + 1}`,
    provider_account_id: profile.connectedAccountId,
    provider_live_mode: false,
    provider_captured_minor: String(attempt.amountMinor),
    provider_refunded_minor: String(attempt.amountMinor),
    reconciliation_required: false,
  }));
  const resolutionOperationId = randomUUID();
  const operation = {
    id: resolutionOperationId,
    state: 'Resolved',
    currency: 'CHF',
    credit_minor: '4500',
    refund_minor: '4500',
    unpaid_waived_minor: '0',
  };
  const refundLegs = storedAttempts.map((attempt, index) => ({
    operation_id: resolutionOperationId,
    refund_leg_id: randomUUID(),
    refund_attempt_id: randomUUID(),
    account_payment_attempt_id: attempt.attempt_id,
    amount_minor: attempt.amount_minor,
    currency: 'CHF',
    state: 'Succeeded',
    custody: 'StripeDirect',
    provider_refund_id: `re_refund${index + 1}`,
    provider_refund_status: 'succeeded',
    provider_charge_id: attempt.provider_charge_id,
    provider_intent_id: attempt.provider_intent_id,
    provider_account_id: profile.connectedAccountId,
    provider_live_mode: false,
  }));
  const sessionMetadata = (attemptId) => ({
    account_payment_attempt: attemptId,
    sofra_payment_schema: 'account-payment-v1',
  });
  const providerObjects = new Map();
  for (let index = 0; index < storedAttempts.length; index += 1) {
    const attempt = attempts[index];
    const stored = storedAttempts[index];
    const leg = refundLegs[index];
    const session = {
      id: stored.provider_session_id,
      mode: 'payment',
      livemode: false,
      currency: 'chf',
      client_reference_id: attempt.attemptId,
      status: 'complete',
      payment_status: 'paid',
      amount_total: attempt.amountMinor,
      payment_intent: stored.provider_intent_id,
      metadata: sessionMetadata(attempt.attemptId),
    };
    const intent = {
      id: stored.provider_intent_id,
      livemode: false,
      currency: 'chf',
      status: 'succeeded',
      amount: attempt.amountMinor,
      amount_received: attempt.amountMinor,
      latest_charge: stored.provider_charge_id,
      metadata: sessionMetadata(attempt.attemptId),
    };
    const charge = {
      id: stored.provider_charge_id,
      livemode: false,
      currency: 'chf',
      payment_intent: stored.provider_intent_id,
      paid: true,
      captured: true,
      disputed: false,
      amount: attempt.amountMinor,
      amount_captured: attempt.amountMinor,
      amount_refunded: attempt.amountMinor,
    };
    const refund = {
      id: leg.provider_refund_id,
      object: 'refund',
      amount: attempt.amountMinor,
      currency: 'chf',
      status: 'succeeded',
      charge: stored.provider_charge_id,
      payment_intent: stored.provider_intent_id,
      metadata: {
        ...REFUND_METADATA,
        amendment_resolution_operation: resolutionOperationId,
        amendment_refund_leg: leg.refund_leg_id,
        amendment_refund_attempt: leg.refund_attempt_id,
      },
    };
    providerObjects.set(`/v1/checkout/sessions/${stored.provider_session_id}`, session);
    providerObjects.set(`/v1/payment_intents/${stored.provider_intent_id}`, intent);
    providerObjects.set(`/v1/charges/${stored.provider_charge_id}`, charge);
    providerObjects.set(`/v1/refunds?charge=${stored.provider_charge_id}&limit=100`, {
      object: 'list',
      data: [refund],
      has_more: false,
    });
  }
  return {
    payments: { serviceSessionId, expectedAttempts: attempts, storedAttempts },
    refunds: { operation, refundLegs },
    providerObjects,
  };
}

async function fixture(t) {
  const stateDir = mkdtempSync(path.join(tmpdir(), 'p11-financial-evidence-'));
  const evidenceRoot = path.join(stateDir, 'stripe-evidence');
  const runId = randomBytes(8).toString('hex');
  const { evidenceDir: runDirectory, browserDir } = profileGuards.ensurePrivateArtifactDirectories(runId, evidenceRoot);
  const runEnv = localP11StripeTarget(runId);
  const compose = {
    stateDir,
    runId,
    project: runEnv.P11_COMPOSE_PROJECT,
    args: ['compose', '--env-file', path.join(runDirectory, 'compose.env'), '-p', runEnv.P11_COMPOSE_PROJECT],
  };
  const profile = {
    profile: 'account-splits-test-v1',
    apiKey: `sk_test_${randomBytes(16).toString('hex')}`,
    connectedAccountId: `acct_${randomBytes(8).toString('hex')}`,
    currency: 'CHF',
  };
  const data = createFixtureData(profile);
  const paymentPath = path.join(browserDir, 'refunded-attempts.json');
  const refundPath = path.join(browserDir, 'refund-evidence.json');
  writeFileSync(paymentPath, JSON.stringify(data.payments), { mode: 0o600, flag: 'wx' });
  writeFileSync(refundPath, JSON.stringify(data.refunds), { mode: 0o600, flag: 'wx' });
  t.after(() => rmSync(stateDir, { recursive: true, force: true }));
  return {
    runId,
    runEnv,
    compose,
    evidenceDir: runDirectory,
    browserDir,
    profile,
    ...data,
    paymentPath,
    refundPath,
  };
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
  return verifyStripeFinancialEvidence({
    runEnv: overrides.runEnv ?? fixtureValue.runEnv,
    compose: overrides.compose ?? fixtureValue.compose,
    evidenceDir: overrides.evidenceDir ?? fixtureValue.evidenceDir,
    browserDir: overrides.browserDir ?? fixtureValue.browserDir,
    profile: overrides.profile ?? fixtureValue.profile,
    origin: overrides.origin ?? ORIGIN,
    readStripe: reader,
  });
}

function mutateJson(filename, mutate) {
  const value = JSON.parse(readFileSync(filename, 'utf8'));
  mutate(value);
  writeFileSync(filename, JSON.stringify(value), { mode: 0o600 });
}

test('proves all four exact connected-account captures and full app-linked refunds with 16 fresh GETs', async (t) => {
  const current = await fixture(t);
  const calls = [];
  const refund = current.providerObjects.get('/v1/refunds?charge=ch_charge1&limit=100').data[0];
  assert.equal(refund.object, 'refund');
  assert.equal(Object.hasOwn(refund, 'livemode'), false);
  const proof = await verify(current, makeReader(current, calls));

  assert.deepEqual(proof, {
    verified: true,
    providerMode: 'test',
    currency: 'CHF',
    capturedAttemptCount: 4,
    capturedMinor: 4500,
    refundLegCount: 4,
    refundedMinor: 4500,
    unresolvedRefundCount: 0,
    refundListHasMore: false,
    connectedAccountScoped: true,
    providerReadCount: 16,
  });
  assert.equal(calls.length, 16);
  assert.equal(
    calls.every((call) => call.origin === ORIGIN && call.connected === true),
    true,
  );
  assert.equal(
    calls.every((call) => call.accountId === current.profile.connectedAccountId),
    true,
  );
  const expectedResources = current.refunds.refundLegs.flatMap((leg) => {
    const attempt = current.payments.storedAttempts.find(
      (value) => value.attempt_id === leg.account_payment_attempt_id,
    );
    return [
      `/v1/checkout/sessions/${attempt.provider_session_id}`,
      `/v1/payment_intents/${attempt.provider_intent_id}`,
      `/v1/charges/${attempt.provider_charge_id}`,
      `/v1/refunds?charge=${attempt.provider_charge_id}&limit=100`,
    ];
  });
  assert.deepEqual(calls.map((call) => call.resource).sort(), expectedResources.sort());
  assert.equal(stripeRunEvidenceFields(proof).providerCleanupVerified, true);
  assert.deepEqual(stripeRunEvidenceFields(undefined), { providerCleanupVerified: false });
  assert.deepEqual(stripeRunEvidenceFields({ ...proof, refundedMinor: 4499 }), {
    providerCleanupVerified: false,
  });
  assert.deepEqual(stripeRunEvidenceFields({ ...proof, refundListHasMore: true }), {
    providerCleanupVerified: false,
  });
});

test('rejects missing, changed-money, duplicate-identity, and cross-account application rows before Stripe reads', async (t) => {
  const changes = [
    (current) => mutateJson(current.paymentPath, (value) => value.storedAttempts.pop()),
    (current) => mutateJson(current.paymentPath, (value) => (value.storedAttempts[0].amount_minor = '1499')),
    (current) => mutateJson(current.paymentPath, (value) => (value.expectedAttempts[0].amountMinor = 1499)),
    (current) =>
      mutateJson(
        current.paymentPath,
        (value) => (value.expectedAttempts[1].operationId = value.expectedAttempts[0].operationId),
      ),
    (current) =>
      mutateJson(current.paymentPath, (value) => (value.storedAttempts[0].provider_account_id = 'acct_otherpayer')),
    (current) => mutateJson(current.paymentPath, (value) => (value.storedAttempts[0].provider_refunded_minor = '1499')),
  ];
  for (const change of changes) {
    const current = await fixture(t);
    change(current);
    const calls = [];
    await assert.rejects(verify(current, makeReader(current, calls)));
    assert.equal(calls.length, 0);
  }
});

test('requires one exact resolved CHF operation and four succeeded StripeDirect receipt legs', async (t) => {
  const changes = [
    (current) => mutateJson(current.refundPath, (value) => (value.operation.credit_minor = '4499')),
    (current) => mutateJson(current.refundPath, (value) => (value.operation.refund_minor = '4499')),
    (current) => mutateJson(current.refundPath, (value) => (value.operation.unpaid_waived_minor = '1')),
    (current) => mutateJson(current.refundPath, (value) => value.refundLegs.pop()),
    (current) => mutateJson(current.refundPath, (value) => (value.refundLegs[0].custody = 'Manual')),
    (current) => mutateJson(current.refundPath, (value) => (value.refundLegs[0].state = 'Pending')),
    (current) => mutateJson(current.refundPath, (value) => (value.refundLegs[0].amount_minor = '1499')),
    (current) =>
      mutateJson(current.refundPath, (value) => (value.refundLegs[0].account_payment_attempt_id = randomUUID())),
    (current) =>
      mutateJson(current.refundPath, (value) => (value.refundLegs[0].provider_account_id = 'acct_otherpayer')),
  ];
  for (const change of changes) {
    const current = await fixture(t);
    change(current);
    const calls = [];
    await assert.rejects(verify(current, makeReader(current, calls)));
    assert.equal(calls.length, 0);
  }
});

test('rejects live, wrong-money, and cross-linked Session, Intent, or Charge responses', async (t) => {
  const mutations = [
    ['/v1/checkout/sessions/cs_test_session1', (value) => (value.livemode = true)],
    ['/v1/checkout/sessions/cs_test_session1', (value) => (value.amount_total = 1499)],
    ['/v1/checkout/sessions/cs_test_session1', (value) => (value.client_reference_id = randomUUID())],
    ['/v1/payment_intents/pi_intent1', (value) => (value.livemode = true)],
    ['/v1/payment_intents/pi_intent1', (value) => (value.amount_received = 1499)],
    ['/v1/payment_intents/pi_intent1', (value) => (value.latest_charge = 'ch_other')],
    ['/v1/charges/ch_charge1', (value) => (value.livemode = true)],
    ['/v1/charges/ch_charge1', (value) => (value.amount_refunded = 1499)],
    ['/v1/charges/ch_charge1', (value) => (value.payment_intent = 'pi_other')],
  ];
  for (const [resource, mutate] of mutations) {
    const current = await fixture(t);
    const original = structuredClone(current.providerObjects.get(resource));
    const calls = [];
    const reader = async (profile, origin, requested, connected) => {
      calls.push({ requested, connected });
      if (requested !== resource) return structuredClone(current.providerObjects.get(requested));
      const value = structuredClone(original);
      mutate(value);
      return value;
    };
    await assert.rejects(verify(current, reader));
    assert.equal(
      calls.every((call) => call.connected === true),
      true,
    );
  }
});

test('requires the exact full succeeded refund, canonical metadata, and a complete list per charge', async (t) => {
  const mutations = [
    (value) => (value.data[0].object = 'charge'),
    (value) => (value.data[0].amount = 1499),
    (value) => (value.data[0].status = 'pending'),
    (value) => (value.data[0].charge = 'ch_other'),
    (value) => (value.data[0].payment_intent = 'pi_other'),
    (value) => (value.data[0].id = 're_unlinked'),
    (value) => (value.data[0].metadata.sofra_amendment_refund_schema = 'wrong-schema'),
    (value) => (value.data[0].metadata.amendment_resolution_operation = randomUUID()),
    (value) => (value.data[0].metadata.amendment_refund_leg = randomUUID()),
    (value) => (value.data[0].metadata.amendment_refund_attempt = randomUUID()),
    (value) => (value.data[0].metadata.unexpected = 'extra'),
    (value) => (value.data[0].currency = 'eur'),
    (value) => (value.has_more = true),
    (value) => (value.data = []),
    (value) => value.data.push({ ...value.data[0], id: 're_unresolved', status: 'pending' }),
    (value) => value.data.push({ ...value.data[0], id: 're_unlinked-second' }),
  ];
  for (const mutate of mutations) {
    const current = await fixture(t);
    const resource = '/v1/refunds?charge=ch_charge1&limit=100';
    const original = structuredClone(current.providerObjects.get(resource));
    const reader = async (_profile, _origin, requested) => {
      if (requested !== resource) return structuredClone(current.providerObjects.get(requested));
      const value = structuredClone(original);
      mutate(value);
      return value;
    };
    await assert.rejects(verify(current, reader));
  }
});

test('run identity is validated before any evidence open or connected-account GET', async (t) => {
  const current = await fixture(t);
  const calls = [];
  chmodSync(current.paymentPath, 0o644);
  await assert.rejects(
    verify(current, makeReader(current, calls), {
      compose: { ...current.compose, runId: randomBytes(8).toString('hex') },
    }),
    /active disposable Compose run/,
  );
  assert.equal(calls.length, 0);
});

test('reads only mode-0600 no-follow evidence files with a bounded size', async (t) => {
  const privateFile = await fixture(t);
  chmodSync(privateFile.paymentPath, 0o644);
  await assert.rejects(verify(privateFile), /mode-0600/);

  const symlinkFile = await fixture(t);
  const target = path.join(symlinkFile.browserDir, 'payment-evidence-target.json');
  renameSync(symlinkFile.paymentPath, target);
  symlinkSync(target, symlinkFile.paymentPath);
  await assert.rejects(verify(symlinkFile), /safely opened/);

  const oversizedFile = await fixture(t);
  writeFileSync(oversizedFile.paymentPath, Buffer.alloc(300 * 1024), { mode: 0o600 });
  assert.equal(lstatSync(oversizedFile.paymentPath).mode & 0o777, 0o600);
  await assert.rejects(verify(oversizedFile), /within the size limit/);
});
