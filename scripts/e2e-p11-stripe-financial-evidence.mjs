import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from 'node:fs';
import path from 'node:path';
import targetGuards from './e2e-p11-target.cjs';
import profileGuards from './e2e-p11-stripe-profile.cjs';
import { stripeRead, validateStripeApiOrigin, verifyCapturedProviderObjects } from './e2e-p11-stripe-provider.mjs';
import { runSequentially } from './e2e-p11-sequence.mjs';

const MAX_EVIDENCE_BYTES = 256 * 1024;
const EXPECTED_CURRENCY = 'CHF';
const EXPECTED_TOTAL_MINOR = 4500;
const EXPECTED_ATTEMPTS = [
  ['Items', 1500],
  ['Amount', 501],
  ['Equal', 1250],
  ['Equal', 1249],
];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const PROVIDER_IDS = {
  session: /^cs_test_[A-Za-z0-9]+$/,
  intent: /^pi_[A-Za-z0-9]+$/,
  charge: /^ch_[A-Za-z0-9]+$/,
  refund: /^re_[A-Za-z0-9]+$/,
};
const REFUND_METADATA_KEYS = [
  'sofra_amendment_refund_schema',
  'amendment_resolution_operation',
  'amendment_refund_leg',
  'amendment_refund_attempt',
];

function requireEvidence(
  condition,
  message = 'Stripe financial evidence did not match the accepted application records.',
) {
  if (!condition) throw new Error(message);
}

function hasExactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function requireUuid(value) {
  requireEvidence(typeof value === 'string' && UUID.test(value));
  return value;
}

function requireProviderId(value, pattern) {
  requireEvidence(typeof value === 'string' && pattern.test(value));
  return value;
}

function requireMoneyString(value) {
  requireEvidence(typeof value === 'string' && value.length <= 15 && /^(?:0|[1-9]\d*)$/.test(value));
  return BigInt(value);
}

function requireUnique(values) {
  requireEvidence(new Set(values).size === values.length);
}

function privateDirectory(directory, uid) {
  let descriptor;
  let stat;
  try {
    const linkStat = lstatSync(directory);
    if (!linkStat.isDirectory() || linkStat.isSymbolicLink())
      throw new Error('Stripe evidence directories must be run-owned mode-0700 directories.');
    descriptor = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    stat = fstatSync(descriptor);
    requireEvidence(
      stat.isDirectory() &&
        stat.uid === uid &&
        (stat.mode & 0o777) === 0o700 &&
        stat.dev === linkStat.dev &&
        stat.ino === linkStat.ino,
      'Stripe evidence directories must be run-owned mode-0700 directories.',
    );
  } catch {
    throw new Error('The private Stripe evidence directory is unavailable.');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readPrivateJson(filename, uid) {
  if (constants.O_NOFOLLOW === undefined) throw new Error('This platform cannot safely read Stripe evidence files.');
  let descriptor;
  try {
    descriptor = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW | (constants.O_NONBLOCK ?? 0));
    const stat = fstatSync(descriptor);
    requireEvidence(
      stat.isFile() &&
        stat.uid === uid &&
        (stat.mode & 0o777) === 0o600 &&
        stat.size > 0 &&
        stat.size <= MAX_EVIDENCE_BYTES,
      'Stripe evidence files must be same-user mode-0600 regular files within the size limit.',
    );
    const chunks = [];
    let bytesRead = 0;
    while (bytesRead <= MAX_EVIDENCE_BYTES) {
      const buffer = Buffer.alloc(Math.min(8192, MAX_EVIDENCE_BYTES + 1 - bytesRead));
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      bytesRead += count;
      requireEvidence(bytesRead <= MAX_EVIDENCE_BYTES, 'Stripe evidence file exceeded the size limit.');
      chunks.push(buffer.subarray(0, count));
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new Error('A private Stripe evidence file is not valid JSON.');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Stripe ')) throw error;
    throw new Error('A private Stripe evidence file could not be safely opened.');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function validateRunIdentity(runEnv, compose, evidenceDir, browserDir) {
  const identity = targetGuards.validateP11LocalIdentity(runEnv);
  requireEvidence(
    compose &&
      compose.runId === identity.runId &&
      compose.project === `tableaccountp11-${identity.runId}` &&
      runEnv.P11_COMPOSE_PROJECT === compose.project &&
      Array.isArray(compose.args),
    'Stripe evidence does not belong to the active disposable Compose run.',
  );
  const projectArg = compose.args.indexOf('-p');
  requireEvidence(projectArg >= 0 && compose.args[projectArg + 1] === compose.project);

  const evidenceRoot = path.dirname(evidenceDir);
  const expectedRunDir = path.join(evidenceRoot, identity.runId);
  const expectedBrowserDir = path.join(expectedRunDir, 'browser');
  requireEvidence(
    path.resolve(evidenceRoot) === path.join(path.resolve(compose.stateDir), 'stripe-evidence') &&
      path.resolve(evidenceDir) === expectedRunDir &&
      path.resolve(browserDir) === expectedBrowserDir,
    'Stripe evidence paths do not match the active run identity.',
  );
  const uid = typeof process.getuid === 'function' ? process.getuid() : undefined;
  requireEvidence(Number.isInteger(uid), 'The current user identity is unavailable.');
  privateDirectory(evidenceRoot, uid);
  privateDirectory(expectedRunDir, uid);
  privateDirectory(expectedBrowserDir, uid);
  return { identity, uid };
}

function readBrowserEvidence(browserDir, uid) {
  return {
    payments: readPrivateJson(path.join(browserDir, 'refunded-attempts.json'), uid),
    refunds: readPrivateJson(path.join(browserDir, 'refund-evidence.json'), uid),
  };
}

function validatePaymentEvidence(payments, selectedAccountId) {
  requireEvidence(hasExactKeys(payments, ['serviceSessionId', 'expectedAttempts', 'storedAttempts']));
  requireUuid(payments.serviceSessionId);
  requireEvidence(Array.isArray(payments.expectedAttempts) && payments.expectedAttempts.length === 4);
  requireEvidence(Array.isArray(payments.storedAttempts) && payments.storedAttempts.length === 4);

  const expected = payments.expectedAttempts.map((value) => {
    requireEvidence(hasExactKeys(value, ['attemptId', 'operationId', 'mode', 'amountMinor']));
    const amountMinor = value.amountMinor;
    requireEvidence(Number.isSafeInteger(amountMinor) && amountMinor > 0);
    return {
      attemptId: requireUuid(value.attemptId),
      operationId: requireUuid(value.operationId),
      mode: value.mode,
      amountMinor,
    };
  });
  requireUnique(expected.map((value) => value.attemptId));
  requireUnique(expected.map((value) => value.operationId));
  requireEvidence(
    JSON.stringify(
      expected
        .map(({ mode, amountMinor }) => `${mode}:${amountMinor}`)
        .sort((left, right) => left.localeCompare(right, 'en')),
    ) ===
      JSON.stringify(
        EXPECTED_ATTEMPTS.map(([mode, amount]) => `${mode}:${amount}`).sort((left, right) =>
          left.localeCompare(right, 'en'),
        ),
      ),
  );
  requireEvidence(expected.reduce((sum, value) => sum + value.amountMinor, 0) === EXPECTED_TOTAL_MINOR);

  const stored = payments.storedAttempts.map((row) => {
    requireEvidence(
      hasExactKeys(row, [
        'attempt_id',
        'operation_id',
        'mode',
        'state',
        'amount_minor',
        'currency',
        'provider_session_id',
        'provider_intent_id',
        'provider_charge_id',
        'provider_account_id',
        'provider_live_mode',
        'provider_captured_minor',
        'provider_refunded_minor',
        'reconciliation_required',
      ]),
    );
    requireEvidence(
      row.state === 'Captured' &&
        row.currency === EXPECTED_CURRENCY &&
        row.provider_account_id === selectedAccountId &&
        row.provider_live_mode === false &&
        row.reconciliation_required === false,
    );
    return {
      attemptId: requireUuid(row.attempt_id),
      operationId: requireUuid(row.operation_id),
      mode: row.mode,
      amountMinor: requireMoneyString(row.amount_minor),
      providerSessionId: requireProviderId(row.provider_session_id, PROVIDER_IDS.session),
      providerIntentId: requireProviderId(row.provider_intent_id, PROVIDER_IDS.intent),
      providerChargeId: requireProviderId(row.provider_charge_id, PROVIDER_IDS.charge),
      providerCapturedMinor: requireMoneyString(row.provider_captured_minor),
      providerRefundedMinor: requireMoneyString(row.provider_refunded_minor),
    };
  });
  for (const field of ['attemptId', 'operationId', 'providerSessionId', 'providerIntentId', 'providerChargeId'])
    requireUnique(stored.map((value) => value[field]));
  requireUnique(expected.map((value) => value.attemptId));

  const storedByAttempt = new Map(stored.map((value) => [value.attemptId, value]));
  requireEvidence(storedByAttempt.size === expected.length);
  for (const value of expected) {
    const row = storedByAttempt.get(value.attemptId);
    requireEvidence(
      row &&
        row.operationId === value.operationId &&
        row.mode === value.mode &&
        row.amountMinor === BigInt(value.amountMinor) &&
        row.providerCapturedMinor === BigInt(value.amountMinor) &&
        row.providerRefundedMinor === BigInt(value.amountMinor),
    );
  }
  return { expected, storedByAttempt };
}

function validateRefundEvidence(refunds, payments) {
  requireEvidence(hasExactKeys(refunds, ['operation', 'refundLegs']));
  const operation = refunds.operation;
  requireEvidence(
    hasExactKeys(operation, ['id', 'state', 'currency', 'credit_minor', 'refund_minor', 'unpaid_waived_minor']) &&
      operation.state === 'Resolved' &&
      operation.currency === EXPECTED_CURRENCY &&
      requireMoneyString(operation.credit_minor) === BigInt(EXPECTED_TOTAL_MINOR) &&
      requireMoneyString(operation.refund_minor) === BigInt(EXPECTED_TOTAL_MINOR) &&
      requireMoneyString(operation.unpaid_waived_minor) === 0n,
  );
  const operationId = requireUuid(operation.id);
  requireEvidence(Array.isArray(refunds.refundLegs) && refunds.refundLegs.length === 4);
  const legs = refunds.refundLegs.map((leg) => {
    requireEvidence(
      hasExactKeys(leg, [
        'operation_id',
        'refund_leg_id',
        'refund_attempt_id',
        'account_payment_attempt_id',
        'amount_minor',
        'currency',
        'state',
        'custody',
        'provider_refund_id',
        'provider_refund_status',
        'provider_charge_id',
        'provider_intent_id',
        'provider_account_id',
        'provider_live_mode',
      ]),
    );
    requireEvidence(
      leg.operation_id === operationId &&
        leg.currency === EXPECTED_CURRENCY &&
        leg.state === 'Succeeded' &&
        leg.custody === 'StripeDirect' &&
        leg.provider_refund_status === 'succeeded' &&
        leg.provider_account_id === payments.selectedAccountId &&
        leg.provider_live_mode === false,
    );
    return {
      operationId,
      legId: requireUuid(leg.refund_leg_id),
      refundAttemptId: requireUuid(leg.refund_attempt_id),
      paymentAttemptId: requireUuid(leg.account_payment_attempt_id),
      amountMinor: requireMoneyString(leg.amount_minor),
      refundId: requireProviderId(leg.provider_refund_id, PROVIDER_IDS.refund),
      chargeId: requireProviderId(leg.provider_charge_id, PROVIDER_IDS.charge),
      intentId: requireProviderId(leg.provider_intent_id, PROVIDER_IDS.intent),
      accountId: leg.provider_account_id,
    };
  });
  for (const field of ['legId', 'refundAttemptId', 'paymentAttemptId', 'refundId'])
    requireUnique(legs.map((value) => value[field]));
  const paymentsById = new Map(payments.expected.map((value) => [value.attemptId, value]));
  requireEvidence(legs.length === paymentsById.size);
  for (const leg of legs) {
    const attempt = paymentsById.get(leg.paymentAttemptId);
    requireEvidence(
      attempt &&
        leg.amountMinor === BigInt(attempt.amountMinor) &&
        payments.storedByAttempt.get(attempt.attemptId)?.providerChargeId === leg.chargeId &&
        payments.storedByAttempt.get(attempt.attemptId)?.providerIntentId === leg.intentId,
    );
  }
  requireEvidence(legs.reduce((sum, value) => sum + value.amountMinor, 0n) === BigInt(EXPECTED_TOTAL_MINOR));
  return { operationId, legs, paymentsById };
}

function validateProviderRefundList(list, leg, paymentAttemptId) {
  requireEvidence(
    list &&
      typeof list === 'object' &&
      list.object === 'list' &&
      list.has_more === false &&
      Array.isArray(list.data) &&
      list.data.length === 1,
    'Stripe refund history is incomplete or contains an extra unresolved or unlinked refund.',
  );
  const refund = list.data[0];
  requireEvidence(
    refund &&
      typeof refund === 'object' &&
      !Array.isArray(refund) &&
      refund.id === leg.refundId &&
      refund.livemode === false &&
      refund.amount === Number(leg.amountMinor) &&
      refund.currency === 'chf' &&
      refund.status === 'succeeded' &&
      refund.charge === leg.chargeId &&
      refund.payment_intent === leg.intentId &&
      hasExactKeys(refund.metadata, REFUND_METADATA_KEYS) &&
      refund.metadata.sofra_amendment_refund_schema === 'amendment-refund-v1' &&
      refund.metadata.amendment_resolution_operation === leg.operationId &&
      refund.metadata.amendment_refund_leg === leg.legId &&
      refund.metadata.amendment_refund_attempt === leg.refundAttemptId,
  );
  requireEvidence(paymentAttemptId === leg.paymentAttemptId);
}

function isCanonicalProof(proof) {
  return (
    hasExactKeys(proof, [
      'verified',
      'providerMode',
      'currency',
      'capturedAttemptCount',
      'capturedMinor',
      'refundLegCount',
      'refundedMinor',
      'unresolvedRefundCount',
      'refundListHasMore',
      'connectedAccountScoped',
      'providerReadCount',
    ]) &&
    proof.verified === true &&
    proof.providerMode === 'test' &&
    proof.currency === EXPECTED_CURRENCY &&
    proof.capturedAttemptCount === 4 &&
    proof.capturedMinor === EXPECTED_TOTAL_MINOR &&
    proof.refundLegCount === 4 &&
    proof.refundedMinor === EXPECTED_TOTAL_MINOR &&
    proof.unresolvedRefundCount === 0 &&
    proof.refundListHasMore === false &&
    proof.connectedAccountScoped === true &&
    proof.providerReadCount === 16
  );
}

/** Only a complete provider proof may set the persisted run marker. */
export function stripeRunEvidenceFields(proof) {
  if (!isCanonicalProof(proof)) return { providerCleanupVerified: false };
  return { providerCleanupVerified: true, providerEvidence: proof };
}

export async function verifyStripeFinancialEvidence({
  runEnv,
  compose,
  evidenceDir,
  browserDir,
  profile,
  origin,
  readStripe = stripeRead,
  signal,
}) {
  const { identity, uid } = validateRunIdentity(runEnv, compose, evidenceDir, browserDir);
  const acceptedProfile = profileGuards.validateStripeProfile(profile);
  const apiOrigin = validateStripeApiOrigin(origin);
  const { payments: rawPayments, refunds: rawRefunds } = readBrowserEvidence(browserDir, uid);
  const payments = validatePaymentEvidence(rawPayments, acceptedProfile.connectedAccountId);
  const refundEvidence = validateRefundEvidence(rawRefunds, {
    ...payments,
    selectedAccountId: acceptedProfile.connectedAccountId,
  });

  let providerReadCount = 0;
  await runSequentially(refundEvidence.legs, async (leg) => {
    const attempt = refundEvidence.paymentsById.get(leg.paymentAttemptId);
    requireEvidence(attempt !== undefined);
    const stored = payments.storedByAttempt.get(attempt.attemptId);
    const session = await readStripe(
      acceptedProfile,
      apiOrigin,
      `/v1/checkout/sessions/${stored.providerSessionId}`,
      true,
      { signal },
    );
    const intent = await readStripe(
      acceptedProfile,
      apiOrigin,
      `/v1/payment_intents/${stored.providerIntentId}`,
      true,
      { signal },
    );
    const charge = await readStripe(acceptedProfile, apiOrigin, `/v1/charges/${stored.providerChargeId}`, true, {
      signal,
    });
    const refundList = await readStripe(
      acceptedProfile,
      apiOrigin,
      `/v1/refunds?charge=${stored.providerChargeId}&limit=100`,
      true,
      { signal },
    );
    providerReadCount += 4;
    verifyCapturedProviderObjects(
      {
        attemptId: attempt.attemptId,
        sessionId: stored.providerSessionId,
        intentId: stored.providerIntentId,
        chargeId: stored.providerChargeId,
        amountMinor: attempt.amountMinor,
        refundedMinor: attempt.amountMinor,
        currency: EXPECTED_CURRENCY,
      },
      session,
      intent,
      charge,
    );
    validateProviderRefundList(refundList, leg, attempt.attemptId);
  });

  requireEvidence(providerReadCount === 16);
  requireEvidence(identity.runId === compose.runId);
  return {
    verified: true,
    providerMode: 'test',
    currency: EXPECTED_CURRENCY,
    capturedAttemptCount: 4,
    capturedMinor: EXPECTED_TOTAL_MINOR,
    refundLegCount: 4,
    refundedMinor: EXPECTED_TOTAL_MINOR,
    unresolvedRefundCount: 0,
    refundListHasMore: false,
    connectedAccountScoped: true,
    providerReadCount,
  };
}
