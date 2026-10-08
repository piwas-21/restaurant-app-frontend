import path from 'node:path';
import profileGuards from './e2e-p11-stripe-profile.cjs';
import { stripeRead, validateStripeApiOrigin, verifyCapturedProviderObjects } from './e2e-p11-stripe-provider.mjs';
import { stripeEvidenceInternals } from './e2e-p11-stripe-financial-evidence.mjs';

// CHF minor units: 501 = CHF 5.01 online; 999 = CHF 9.99 exact cash.
// Cash rounding adds 1 minor (CHF 0.01), so CHF 10.00 is due and received.
const MIXED_EXPECTED_ATTEMPTS = { online: 501, cash: 999 };
const {
  EXPECTED_CURRENCY,
  PROVIDER_IDS,
  UUID,
  hasExactKeys,
  readPrivateJson,
  requireEvidence,
  requireProviderId,
  requireUnique,
  requireUuid,
  validateProviderRefundList,
  validateRunIdentity,
} = stripeEvidenceInternals;

function validateAttempt(value, role, sessionId, selectedAccountId) {
  const amount = MIXED_EXPECTED_ATTEMPTS[role];
  requireEvidence(
    value.mode === 'Amount' &&
      value.service_session_id === sessionId &&
      value.state === 'Captured' &&
      value.amount_minor === String(amount) &&
      value.currency === EXPECTED_CURRENCY,
  );
  const attempt = {
    role,
    attemptId: requireUuid(value.attempt_id),
    operationId: requireUuid(value.operation_id),
    amount,
  };
  if (role === 'online') {
    requireEvidence(
      value.payment_method === 'OnlinePayment' &&
        value.actor_kind === 'GuestParticipant' &&
        value.provider_account_id === selectedAccountId &&
        value.provider_live_mode === false &&
        value.provider_captured_minor === String(amount) &&
        value.provider_refunded_minor === String(amount) &&
        value.reconciliation_required === false,
    );
    return {
      ...attempt,
      sessionId: requireProviderId(value.provider_session_id, PROVIDER_IDS.session),
      intentId: requireProviderId(value.provider_intent_id, PROVIDER_IDS.intent),
      chargeId: requireProviderId(value.provider_charge_id, PROVIDER_IDS.charge),
      accountId: value.provider_account_id,
    };
  }
  requireEvidence(
    value.payment_method === 'Cash' &&
      value.actor_kind === 'Staff' &&
      value.provider_session_id === null &&
      value.provider_intent_id === null &&
      value.provider_charge_id === null &&
      value.provider_account_id === null &&
      value.provider_live_mode === null &&
      value.provider_captured_minor === null &&
      value.provider_refunded_minor === null &&
      value.reconciliation_required === null,
  );
  return attempt;
}

function validateAttempts(values, sessionId, selectedAccountId) {
  requireEvidence(Array.isArray(values) && values.length === 2);
  const attempts = new Map();
  for (const value of values) {
    requireEvidence(
      hasExactKeys(value, [
        'attempt_id',
        'service_session_id',
        'operation_id',
        'mode',
        'state',
        'payment_method',
        'actor_kind',
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
        'role',
      ]),
    );
    const role = value.role;
    requireEvidence(role === 'online' || role === 'cash');
    requireEvidence(!attempts.has(role));
    attempts.set(role, validateAttempt(value, role, sessionId, selectedAccountId));
  }
  requireEvidence(attempts.has('online') && attempts.has('cash'));
  const online = attempts.get('online');
  const cash = attempts.get('cash');
  requireUnique([online.attemptId, cash.attemptId]);
  requireUnique([online.operationId, cash.operationId]);
  return { online, cash };
}

function attemptForPaymentAttemptId(attempts, attemptId) {
  if (attemptId === attempts.online.attemptId) return attempts.online;
  if (attemptId === attempts.cash.attemptId) return attempts.cash;
  return null;
}

function validateAllocation(value, orderId, attempts) {
  requireEvidence(
    hasExactKeys(value, [
      'attempt_id',
      'order_id',
      'order_item_id',
      'start_ordinal',
      'unit_count',
      'minor_per_unit',
      'amount_minor',
    ]),
  );
  const attempt = attemptForPaymentAttemptId(attempts, value.attempt_id);
  requireEvidence(attempt !== null);
  requireEvidence(
    value.order_id === orderId &&
      typeof value.order_item_id === 'string' &&
      UUID.test(value.order_item_id) &&
      value.start_ordinal === 1 &&
      value.unit_count === 1 &&
      value.minor_per_unit === '1500' &&
      value.amount_minor === String(attempt.amount),
  );
  return { ...value, role: attempt.role };
}

function validateAllocations(values, orderId, attempts) {
  requireEvidence(Array.isArray(values) && values.length === 2);
  const allocations = new Map();
  for (const value of values) {
    const allocation = validateAllocation(value, orderId, attempts);
    requireEvidence(!allocations.has(allocation.role));
    allocations.set(allocation.role, allocation);
  }
  const onlineAllocation = allocations.get('online');
  const cashAllocation = allocations.get('cash');
  requireEvidence(
    onlineAllocation.order_item_id === cashAllocation.order_item_id &&
      onlineAllocation.start_ordinal === cashAllocation.start_ordinal &&
      onlineAllocation.unit_count === cashAllocation.unit_count &&
      onlineAllocation.minor_per_unit === cashAllocation.minor_per_unit,
  );
  return { online: onlineAllocation, cash: cashAllocation };
}

function validateCashReceipt(receipt, cashAttemptId) {
  requireEvidence(
    hasExactKeys(receipt, [
      'id',
      'attempt_id',
      'policy_version',
      'currency',
      'payment_method',
      'exact_amount_minor',
      'adjustment_minor',
      'due_amount_minor',
      'received_minor',
      'change_minor',
      'actor_kind',
      'actor_role',
    ]),
  );
  requireEvidence(
    requireUuid(receipt.id) &&
      receipt.attempt_id === cashAttemptId &&
      receipt.policy_version === 'chf-cash-5-rappen-v1' &&
      receipt.currency === EXPECTED_CURRENCY &&
      receipt.payment_method === 'Cash' &&
      receipt.exact_amount_minor === '999' &&
      receipt.adjustment_minor === '1' &&
      receipt.due_amount_minor === '1000' &&
      receipt.received_minor === '1000' &&
      receipt.change_minor === '0' &&
      receipt.actor_kind === 'Staff' &&
      receipt.actor_role === 'Cashier',
  );
  return receipt.id;
}

function validateResolution(operation, sessionId, orderId, amendmentId) {
  requireEvidence(
    hasExactKeys(operation, [
      'id',
      'state',
      'currency',
      'credit_minor',
      'refund_minor',
      'unpaid_waived_minor',
      'service_session_id',
      'source_order_id',
      'amendment_id',
    ]) &&
      operation.service_session_id === sessionId &&
      operation.source_order_id === orderId &&
      operation.amendment_id === amendmentId &&
      operation.state === 'Resolved' &&
      operation.currency === EXPECTED_CURRENCY &&
      operation.credit_minor === '1500' &&
      operation.refund_minor === '1500' &&
      operation.unpaid_waived_minor === '0',
  );
  return requireUuid(operation.id);
}

function validateRefundLeg(value, operationId, attempts, selectedAccountId) {
  requireEvidence(
    hasExactKeys(value, [
      'id',
      'operation_id',
      'account_payment_attempt_id',
      'custody',
      'state',
      'amount_minor',
      'currency',
      'provider_account_id',
      'provider_live_mode',
      'provider_charge_id',
      'provider_intent_id',
    ]),
  );
  const attempt = attemptForPaymentAttemptId(attempts, value.account_payment_attempt_id);
  requireEvidence(attempt !== null);
  const isOnline = attempt.role === 'online';
  requireEvidence(
    value.operation_id === operationId &&
      value.state === 'Succeeded' &&
      value.amount_minor === String(attempt.amount) &&
      value.currency === EXPECTED_CURRENCY &&
      value.custody === (isOnline ? 'StripeDirect' : 'ManualTill') &&
      value.provider_account_id === (isOnline ? selectedAccountId : null) &&
      value.provider_live_mode === (isOnline ? false : null) &&
      value.provider_charge_id === (isOnline ? attempts.online.chargeId : null) &&
      value.provider_intent_id === (isOnline ? attempts.online.intentId : null),
  );
  return {
    operationId,
    legId: requireUuid(value.id),
    attemptId: attempt.attemptId,
    amountMinor: BigInt(attempt.amount),
    custody: value.custody,
    role: attempt.role,
  };
}

function validateRefundLegs(values, operationId, attempts, selectedAccountId) {
  requireEvidence(Array.isArray(values) && values.length === 2);
  const legs = new Map();
  for (const value of values) {
    const leg = validateRefundLeg(value, operationId, attempts, selectedAccountId);
    requireEvidence(!legs.has(leg.role));
    legs.set(leg.role, leg);
  }
  const onlineLeg = legs.get('online');
  const cashLeg = legs.get('cash');
  requireEvidence(onlineLeg && cashLeg);
  requireUnique([onlineLeg.legId, cashLeg.legId]);
  return { online: onlineLeg, cash: cashLeg };
}

function validateProviderRefund(value, onlineLeg, onlineAttempt, selectedAccountId, operationId) {
  requireEvidence(
    hasExactKeys(value, [
      'refund_leg_id',
      'refund_attempt_id',
      'state',
      'amount_minor',
      'currency',
      'provider_refund_id',
      'provider_refund_status',
      'provider_charge_id',
      'provider_intent_id',
      'provider_account_id',
      'provider_live_mode',
    ]) &&
      value.refund_leg_id === onlineLeg.legId &&
      value.state === 'Succeeded' &&
      value.amount_minor === '501' &&
      value.currency === EXPECTED_CURRENCY &&
      value.provider_refund_status === 'succeeded' &&
      value.provider_charge_id === onlineAttempt.chargeId &&
      value.provider_intent_id === onlineAttempt.intentId &&
      value.provider_account_id === selectedAccountId &&
      value.provider_live_mode === false,
  );
  const refund = {
    operationId,
    legId: onlineLeg.legId,
    refundAttemptId: requireUuid(value.refund_attempt_id),
    paymentAttemptId: onlineAttempt.attemptId,
    amountMinor: 501n,
    refundId: requireProviderId(value.provider_refund_id, PROVIDER_IDS.refund),
    chargeId: onlineAttempt.chargeId,
    intentId: onlineAttempt.intentId,
    accountId: selectedAccountId,
  };
  return refund;
}

function validateCashRefund(intent, cashReturn, cashLegId, cashAttemptId, cashReceiptId) {
  requireEvidence(
    hasExactKeys(intent, [
      'id',
      'refund_leg_id',
      'attempt_id',
      'collection_receipt_id',
      'policy_version',
      'currency',
      'original_exact_amount_minor',
      'original_adjustment_minor',
      'original_due_amount_minor',
      'previously_refunded_exact_minor',
      'previously_refunded_cash_minor',
      'exact_refund_amount_minor',
      'refund_adjustment_minor',
      'cash_refund_amount_minor',
      'retained_exact_amount_minor',
      'retained_cash_due_minor',
    ]) &&
      intent.refund_leg_id === cashLegId &&
      intent.attempt_id === cashAttemptId &&
      requireUuid(intent.id) &&
      intent.collection_receipt_id === cashReceiptId &&
      intent.policy_version === 'chf-cash-5-rappen-v1' &&
      intent.currency === EXPECTED_CURRENCY &&
      intent.original_exact_amount_minor === '999' &&
      intent.original_adjustment_minor === '1' &&
      intent.original_due_amount_minor === '1000' &&
      intent.previously_refunded_exact_minor === '0' &&
      intent.previously_refunded_cash_minor === '0' &&
      intent.exact_refund_amount_minor === '999' &&
      intent.refund_adjustment_minor === '1' &&
      intent.cash_refund_amount_minor === '1000' &&
      intent.retained_exact_amount_minor === '0' &&
      intent.retained_cash_due_minor === '0',
  );
  requireEvidence(
    hasExactKeys(cashReturn, [
      'exact_refund_amount_minor',
      'refund_adjustment_minor',
      'cash_returned_minor',
      'currency',
      'actor_role',
    ]) &&
      cashReturn.exact_refund_amount_minor === '999' &&
      cashReturn.refund_adjustment_minor === '1' &&
      cashReturn.cash_returned_minor === '1000' &&
      cashReturn.currency === EXPECTED_CURRENCY &&
      cashReturn.actor_role === 'Admin',
  );
}

function validateAllocationReversals(values, orderId, onlineAllocation, attempts, legs) {
  requireEvidence(Array.isArray(values) && values.length === 2);
  const roles = new Set();
  for (const value of values) {
    requireEvidence(
      hasExactKeys(value, [
        'refund_leg_id',
        'attempt_id',
        'order_id',
        'order_item_id',
        'start_ordinal',
        'unit_count',
        'minor_per_unit',
        'amount_minor',
      ]),
    );
    const attempt = attemptForPaymentAttemptId(attempts, value.attempt_id);
    requireEvidence(
      attempt &&
        value.refund_leg_id === legs[attempt.role].legId &&
        value.order_id === orderId &&
        value.order_item_id === onlineAllocation.order_item_id &&
        value.start_ordinal === 1 &&
        value.unit_count === 1 &&
        value.minor_per_unit === '1500' &&
        value.amount_minor === String(attempt.amount),
    );
    roles.add(attempt.role);
  }
  requireEvidence(roles.has('online') && roles.has('cash'));
}

function validateMixedTenderEvidence(evidence, selectedAccountId) {
  requireEvidence(
    hasExactKeys(evidence, [
      'serviceSessionId',
      'orderId',
      'amendmentId',
      'expectedAttempts',
      'allocations',
      'cashReceipt',
      'resolution',
      'refundLegs',
      'providerRefunds',
      'cashRefundIntent',
      'cashRefundEvidence',
      'allocationReversals',
    ]),
  );
  const sessionId = requireUuid(evidence.serviceSessionId);
  const orderId = requireUuid(evidence.orderId);
  const amendmentId = requireUuid(evidence.amendmentId);
  const attempts = validateAttempts(evidence.expectedAttempts, sessionId, selectedAccountId);
  const allocations = validateAllocations(evidence.allocations, orderId, attempts);
  const cashReceiptId = validateCashReceipt(evidence.cashReceipt, attempts.cash.attemptId);
  const operationId = validateResolution(evidence.resolution, sessionId, orderId, amendmentId);
  const legs = validateRefundLegs(evidence.refundLegs, operationId, attempts, selectedAccountId);
  requireEvidence(Array.isArray(evidence.providerRefunds) && evidence.providerRefunds.length === 1);
  const refund = validateProviderRefund(
    evidence.providerRefunds[0],
    legs.online,
    attempts.online,
    selectedAccountId,
    operationId,
  );
  validateCashRefund(
    evidence.cashRefundIntent,
    evidence.cashRefundEvidence,
    legs.cash.legId,
    attempts.cash.attemptId,
    cashReceiptId,
  );
  validateAllocationReversals(evidence.allocationReversals, orderId, allocations.online, attempts, legs);
  return {
    sessionId,
    orderId,
    online: attempts.online,
    cash: attempts.cash,
    operationId,
    onlineLeg: legs.online,
    cashLeg: legs.cash,
    refund,
  };
}

function isCanonicalMixedTenderProof(proof) {
  return (
    hasExactKeys(proof, [
      'verified',
      'providerMode',
      'currency',
      'capturedAttemptCount',
      'capturedMinor',
      'onlineCapturedMinor',
      'cashCapturedMinor',
      'cashDueMinor',
      'cashReceivedMinor',
      'cashChangeMinor',
      'refundLegCount',
      'refundedMinor',
      'stripeRefundMinor',
      'cashExactRefundMinor',
      'cashAttestedReturnedMinor',
      'cashRefundAdjustmentMinor',
      'unresolvedRefundCount',
      'refundListHasMore',
      'netUnsettledMinor',
      'connectedAccountScoped',
      'providerReadCount',
      'onlineAttemptId',
      'cashAttemptId',
      'resolutionOperationId',
    ]) &&
    proof.verified === true &&
    proof.providerMode === 'test' &&
    proof.currency === EXPECTED_CURRENCY &&
    proof.capturedAttemptCount === 2 &&
    proof.capturedMinor === 1500 &&
    proof.onlineCapturedMinor === 501 &&
    proof.cashCapturedMinor === 999 &&
    proof.cashDueMinor === 1000 &&
    proof.cashReceivedMinor === 1000 &&
    proof.cashChangeMinor === 0 &&
    proof.refundLegCount === 2 &&
    proof.refundedMinor === 1500 &&
    proof.stripeRefundMinor === 501 &&
    proof.cashExactRefundMinor === 999 &&
    proof.cashAttestedReturnedMinor === 1000 &&
    proof.cashRefundAdjustmentMinor === 1 &&
    proof.unresolvedRefundCount === 0 &&
    proof.refundListHasMore === false &&
    proof.netUnsettledMinor === 0 &&
    proof.connectedAccountScoped === true &&
    proof.providerReadCount === 4 &&
    UUID.test(proof.onlineAttemptId) &&
    UUID.test(proof.cashAttemptId) &&
    UUID.test(proof.resolutionOperationId)
  );
}

/** Only this separate mixed-tender proof can set its run marker; the four-phone verifier remains unchanged. */
export function mixedTenderRunEvidenceFields(proof) {
  if (!isCanonicalMixedTenderProof(proof)) return { providerCleanupVerified: false };
  return { providerCleanupVerified: true, providerEvidence: proof };
}

export async function verifyMixedTenderFinancialEvidence({
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
  const evidence = readPrivateJson(path.join(browserDir, 'mixed-tender-evidence.json'), uid);
  const source = validateMixedTenderEvidence(evidence, acceptedProfile.connectedAccountId);
  const session = await readStripe(
    acceptedProfile,
    apiOrigin,
    `/v1/checkout/sessions/${evidence.expectedAttempts.find((value) => value.role === 'online').provider_session_id}`,
    true,
    { signal },
  );
  const intent = await readStripe(
    acceptedProfile,
    apiOrigin,
    `/v1/payment_intents/${evidence.expectedAttempts.find((value) => value.role === 'online').provider_intent_id}`,
    true,
    { signal },
  );
  const charge = await readStripe(
    acceptedProfile,
    apiOrigin,
    `/v1/charges/${evidence.expectedAttempts.find((value) => value.role === 'online').provider_charge_id}`,
    true,
    { signal },
  );
  const refundList = await readStripe(
    acceptedProfile,
    apiOrigin,
    `/v1/refunds?charge=${source.refund.chargeId}&limit=100`,
    true,
    { signal },
  );
  verifyCapturedProviderObjects(
    {
      attemptId: source.online.attemptId,
      sessionId: source.online.sessionId,
      intentId: source.online.intentId,
      chargeId: source.online.chargeId,
      amountMinor: 501,
      refundedMinor: 501,
      currency: EXPECTED_CURRENCY,
    },
    session,
    intent,
    charge,
  );
  validateProviderRefundList(refundList, source.refund, source.online.attemptId);
  requireEvidence(identity.runId === compose.runId);
  return {
    verified: true,
    providerMode: 'test',
    currency: EXPECTED_CURRENCY,
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
    onlineAttemptId: source.online.attemptId,
    cashAttemptId: source.cash.attemptId,
    resolutionOperationId: source.operationId,
  };
}
