import { createRequire } from 'node:module';
import path from 'node:path';
import { expect } from '@playwright/test';
import { getE2EDbPool } from '../helpers/db';

const require = createRequire(path.resolve('e2e/p11-stripe/mixedTenderEvidence.ts'));
const { resolvePrivateStripeBrowserArtifactDirectory, writePrivateStripeBrowserEvidence } =
  require('../../scripts/e2e-p11-stripe-profile.cjs') as {
    resolvePrivateStripeBrowserArtifactDirectory: (
      evidenceRoot: string,
      runId: string,
      artifactDirectory: string,
    ) => string;
    writePrivateStripeBrowserEvidence: (
      identity: { evidenceRoot: string; runId: string; artifactDirectory: string },
      filename: string,
      contents: string,
    ) => void;
  };

interface AttemptReadback {
  readonly service_session_id: string;
  readonly attempt_id: string;
  readonly operation_id: string;
  readonly mode: string;
  readonly state: string;
  readonly payment_method: string;
  readonly actor_kind: string;
  readonly amount_minor: string;
  readonly currency: string;
  readonly provider_session_id: string | null;
  readonly provider_intent_id: string | null;
  readonly provider_charge_id: string | null;
  readonly provider_account_id: string | null;
  readonly provider_live_mode: boolean | null;
  readonly provider_captured_minor: string | null;
  readonly provider_refunded_minor: string | null;
  readonly reconciliation_required: boolean | null;
}

interface ResolutionReadback {
  readonly id: string;
  readonly state: string;
  readonly currency: string;
  readonly credit_minor: string;
  readonly refund_minor: string;
  readonly unpaid_waived_minor: string;
  readonly service_session_id: string;
  readonly source_order_id: string;
  readonly amendment_id: string;
}

/** Store only run-owned IDs and bounded financial facts; never customer identity or credentials. */
export async function retainMixedTenderEvidence(
  sessionId: string,
  orderId: string,
  amendmentId: string,
  expected: { onlineOperationId: string; cashOperationId: string },
) {
  const identity = {
    evidenceRoot: process.env.P11_STRIPE_EVIDENCE_ROOT ?? '',
    runId: process.env.P11_RUN_ID ?? '',
    artifactDirectory: process.env.P11_STRIPE_ARTIFACT_DIR ?? '',
  };
  resolvePrivateStripeBrowserArtifactDirectory(identity.evidenceRoot, identity.runId, identity.artifactDirectory);
  const pool = getE2EDbPool();
  const attemptResult = await pool.query<AttemptReadback>(
    `SELECT a.service_session_id, a.id AS attempt_id, a.operation_id, a.mode, a.state, a.payment_method, a.actor_kind,
       a.amount_minor::text, a.currency, j.provider_session_id, j.provider_intent_id, j.provider_charge_id,
       j.provider_account_id, j.provider_live_mode, j.provider_captured_minor::text,
       j.provider_refunded_minor::text, j.reconciliation_required
     FROM account_payment_attempts a
     LEFT JOIN account_checkout_journals j ON j.attempt_id = a.id
     WHERE a.service_session_id = $1 AND a.operation_id = ANY($2::uuid[])
     ORDER BY a.operation_id`,
    [sessionId, [expected.onlineOperationId, expected.cashOperationId]],
  );
  expect(attemptResult.rows).toHaveLength(2);
  const online = attemptResult.rows.find((value) => value.operation_id === expected.onlineOperationId);
  const cash = attemptResult.rows.find((value) => value.operation_id === expected.cashOperationId);
  expect(online).toMatchObject({
    mode: 'Amount',
    state: 'Captured',
    payment_method: 'OnlinePayment',
    actor_kind: 'GuestParticipant',
    amount_minor: '501',
    currency: 'CHF',
    provider_live_mode: false,
    provider_captured_minor: '501',
    reconciliation_required: false,
  });
  const cachedOnlineRefundedMinor = online!.provider_refunded_minor;
  if (typeof cachedOnlineRefundedMinor !== 'string') {
    throw new TypeError('The online checkout refund snapshot is missing.');
  }
  expect(cachedOnlineRefundedMinor).toMatch(/^(0|[1-9]\d{0,18})$/);
  expect(BigInt(cachedOnlineRefundedMinor)).toBeLessThanOrEqual(BigInt(online!.provider_captured_minor!));
  expect(cash).toMatchObject({
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
  });
  const capturedTotals = await pool.query<{ count: string; amount_minor: string }>(
    `SELECT COUNT(*)::text AS count, COALESCE(SUM(amount_minor), 0)::text AS amount_minor
     FROM account_payment_attempts WHERE service_session_id = $1 AND state = 'Captured'`,
    [sessionId],
  );
  expect(capturedTotals.rows).toEqual([{ count: '2', amount_minor: '1500' }]);

  const allocations = await pool.query(
    `SELECT attempt_id, order_id, order_item_id, start_ordinal, unit_count, minor_per_unit, amount_minor
     FROM account_payment_allocations
     WHERE attempt_id = ANY($1::uuid[]) AND order_id = $2
     ORDER BY attempt_id, start_ordinal`,
    [[online!.attempt_id, cash!.attempt_id], orderId],
  );
  expect(allocations.rows).toHaveLength(2);
  for (const attempt of [online!, cash!]) {
    expect(allocations.rows.find((value) => value.attempt_id === attempt.attempt_id)).toMatchObject({
      order_id: orderId,
      start_ordinal: 1,
      unit_count: 1,
      minor_per_unit: attempt.amount_minor,
      amount_minor: attempt.amount_minor,
    });
  }
  const onlineAllocation = allocations.rows.find((value) => value.attempt_id === online!.attempt_id)!;
  const cashAllocation = allocations.rows.find((value) => value.attempt_id === cash!.attempt_id)!;
  expect({
    order_item_id: cashAllocation.order_item_id,
    start_ordinal: cashAllocation.start_ordinal,
    unit_count: cashAllocation.unit_count,
  }).toEqual({
    order_item_id: onlineAllocation.order_item_id,
    start_ordinal: onlineAllocation.start_ordinal,
    unit_count: onlineAllocation.unit_count,
  });
  expect(BigInt(onlineAllocation.amount_minor) + BigInt(cashAllocation.amount_minor)).toBe(BigInt(1500));

  const receiptResult = await pool.query(
    `SELECT id, attempt_id, policy_version, currency, payment_method, exact_amount_minor, adjustment_minor,
       due_amount_minor, received_minor, change_minor, actor_kind, actor_role
     FROM account_cash_collection_receipts WHERE attempt_id = $1`,
    [cash!.attempt_id],
  );
  expect(receiptResult.rows).toEqual([
    {
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      attempt_id: cash!.attempt_id,
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
  ]);

  const resolutionResult = await pool.query<ResolutionReadback>(
    `SELECT id, state, currency, credit_minor::text, refund_minor::text, unpaid_waived_minor::text,
       service_session_id, source_order_id, amendment_id
     FROM order_amendment_resolution_operations
     WHERE service_session_id = $1 AND source_order_id = $2 AND amendment_id = $3`,
    [sessionId, orderId, amendmentId],
  );
  expect(resolutionResult.rows).toHaveLength(1);
  const resolution = resolutionResult.rows[0];
  expect(resolution).toMatchObject({
    service_session_id: sessionId,
    source_order_id: orderId,
    amendment_id: amendmentId,
    state: 'Resolved',
    currency: 'CHF',
    credit_minor: '1500',
    refund_minor: '1500',
    unpaid_waived_minor: '0',
  });

  const legs = await pool.query(
    `SELECT id, operation_id, account_payment_attempt_id, custody, state, amount_minor::text, currency,
       provider_account_id, provider_live_mode, provider_charge_id, provider_intent_id
     FROM order_amendment_refund_legs WHERE operation_id = $1 ORDER BY account_payment_attempt_id`,
    [resolution.id],
  );
  expect(legs.rows).toHaveLength(2);
  expect(legs.rows.find((value) => value.account_payment_attempt_id === online!.attempt_id)).toMatchObject({
    operation_id: resolution.id,
    custody: 'StripeDirect',
    state: 'Succeeded',
    amount_minor: '501',
    currency: 'CHF',
    provider_live_mode: false,
    provider_charge_id: online!.provider_charge_id,
    provider_intent_id: online!.provider_intent_id,
    provider_account_id: online!.provider_account_id,
  });
  expect(legs.rows.find((value) => value.account_payment_attempt_id === cash!.attempt_id)).toMatchObject({
    operation_id: resolution.id,
    custody: 'ManualTill',
    state: 'Succeeded',
    amount_minor: '999',
    currency: 'CHF',
    provider_account_id: null,
    provider_live_mode: null,
    provider_charge_id: null,
    provider_intent_id: null,
  });

  const legIds = legs.rows.map((value) => value.id as string);
  const providerRefunds = await pool.query(
    `SELECT refund_leg_id, refund_attempt_id, state, amount_minor::text, currency, provider_refund_id,
       provider_refund_status, provider_charge_id, provider_intent_id, provider_account_id, provider_live_mode
     FROM order_amendment_refund_evidence
     WHERE refund_leg_id = ANY($1::uuid[]) AND kind = 'ProviderObservation' AND state = 'Succeeded'`,
    [legIds],
  );
  expect(providerRefunds.rows).toHaveLength(1);
  const providerRefund = providerRefunds.rows[0];
  expect(typeof providerRefund.currency).toBe('string');
  expect(providerRefund.currency.toUpperCase()).toBe('CHF');
  expect(providerRefund).toMatchObject({
    refund_leg_id: legs.rows.find((value) => value.account_payment_attempt_id === online!.attempt_id)?.id,
    state: 'Succeeded',
    amount_minor: '501',
    provider_charge_id: online!.provider_charge_id,
    provider_intent_id: online!.provider_intent_id,
    provider_account_id: online!.provider_account_id,
    provider_live_mode: false,
  });

  const cashIntent = await pool.query(
    `SELECT id, refund_leg_id, attempt_id, collection_receipt_id, policy_version, currency,
       original_exact_amount_minor::text, original_adjustment_minor::text, original_due_amount_minor::text,
       previously_refunded_exact_minor::text, previously_refunded_cash_minor::text,
       exact_refund_amount_minor::text, refund_adjustment_minor::text, cash_refund_amount_minor::text,
       retained_exact_amount_minor::text, retained_cash_due_minor::text
     FROM account_cash_refund_intents WHERE refund_leg_id = $1`,
    [legs.rows.find((value) => value.account_payment_attempt_id === cash!.attempt_id)?.id],
  );
  expect(cashIntent.rows).toHaveLength(1);
  expect(cashIntent.rows[0]).toMatchObject({
    refund_leg_id: legs.rows.find((value) => value.account_payment_attempt_id === cash!.attempt_id)?.id,
    attempt_id: cash!.attempt_id,
    collection_receipt_id: receiptResult.rows[0].id,
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
  });
  const cashEvidence = await pool.query(
    `SELECT exact_refund_amount_minor::text, refund_adjustment_minor::text, cash_returned_minor::text,
       currency, actor_role
     FROM account_cash_refund_evidence WHERE intent_id = $1`,
    [cashIntent.rows[0].id],
  );
  expect(cashEvidence.rows).toEqual([
    {
      exact_refund_amount_minor: '999',
      refund_adjustment_minor: '1',
      cash_returned_minor: '1000',
      currency: 'CHF',
      actor_role: 'Admin',
    },
  ]);

  const reversals = await pool.query(
    `SELECT r.refund_leg_id, a.attempt_id, r.order_id, r.order_item_id, r.start_ordinal, r.unit_count,
       r.minor_per_unit::text, r.amount_minor::text
     FROM account_payment_allocation_reversals r
     JOIN account_payment_allocations a ON a.id = r.allocation_id
     WHERE r.refund_leg_id = ANY($1::uuid[]) ORDER BY a.attempt_id`,
    [legIds],
  );
  expect(reversals.rows).toHaveLength(2);
  for (const attempt of [online!, cash!]) {
    const allocation = allocations.rows.find((value) => value.attempt_id === attempt.attempt_id)!;
    const refundLeg = legs.rows.find((value) => value.account_payment_attempt_id === attempt.attempt_id)!;
    expect(reversals.rows.find((value) => value.attempt_id === attempt.attempt_id)).toMatchObject({
      refund_leg_id: refundLeg.id,
      order_id: orderId,
      order_item_id: allocation.order_item_id,
      start_ordinal: 1,
      unit_count: 1,
      minor_per_unit: allocation.minor_per_unit,
      amount_minor: allocation.amount_minor,
    });
  }

  writePrivateStripeBrowserEvidence(
    identity,
    'mixed-tender-evidence.json',
    JSON.stringify(
      {
        serviceSessionId: sessionId,
        orderId,
        amendmentId,
        expectedAttempts: [
          { ...online, role: 'online' },
          { ...cash, role: 'cash' },
        ],
        allocations: allocations.rows,
        cashReceipt: receiptResult.rows[0],
        resolution,
        refundLegs: legs.rows,
        providerRefunds: providerRefunds.rows,
        cashRefundIntent: cashIntent.rows[0],
        cashRefundEvidence: cashEvidence.rows[0],
        allocationReversals: reversals.rows,
      },
      null,
      2,
    ),
  );
}
