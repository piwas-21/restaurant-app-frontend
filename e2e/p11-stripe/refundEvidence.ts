import { createRequire } from 'node:module';
import path from 'node:path';
import { expect } from '@playwright/test';
import { getE2EDbPool } from '../helpers/db';
import type { StoredAttempt } from './paymentEvidence';

const require = createRequire(path.resolve('e2e/p11-stripe/refundEvidence.ts'));
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

interface RefundEvidence {
  readonly operation_id: string;
  readonly refund_leg_id: string;
  readonly refund_attempt_id: string;
  readonly account_payment_attempt_id: string;
  readonly amount_minor: string;
  readonly currency: string;
  readonly provider_observation_currency: string;
  readonly state: string;
  readonly custody: string;
  readonly provider_refund_id: string;
  readonly provider_refund_status: string;
  readonly provider_charge_id: string;
  readonly provider_intent_id: string;
  readonly provider_account_id: string;
  readonly provider_live_mode: boolean;
}

interface ResolutionEvidence {
  readonly id: string;
  readonly state: string;
  readonly currency: string;
  readonly credit_minor: string;
  readonly refund_minor: string;
  readonly unpaid_waived_minor: string;
}

export async function retainRefundEvidence(
  sessionId: string,
  orderId: string,
  amendmentId: string,
  capturedAttempts: readonly StoredAttempt[],
) {
  const artifactIdentity = {
    evidenceRoot: process.env.P11_STRIPE_EVIDENCE_ROOT ?? '',
    runId: process.env.P11_RUN_ID ?? '',
    artifactDirectory: process.env.P11_STRIPE_ARTIFACT_DIR ?? '',
  };
  resolvePrivateStripeBrowserArtifactDirectory(
    artifactIdentity.evidenceRoot,
    artifactIdentity.runId,
    artifactIdentity.artifactDirectory,
  );
  const pool = getE2EDbPool();
  const operation = await pool.query<ResolutionEvidence>(
    `SELECT id, state, currency, credit_minor, refund_minor, unpaid_waived_minor
     FROM order_amendment_resolution_operations
     WHERE service_session_id = $1 AND source_order_id = $2 AND amendment_id = $3`,
    [sessionId, orderId, amendmentId],
  );
  expect(operation.rows).toHaveLength(1);
  expect(operation.rows[0]).toMatchObject({
    state: 'Resolved',
    currency: 'CHF',
    credit_minor: '4500',
    refund_minor: '4500',
    unpaid_waived_minor: '0',
  });
  const legs = await pool.query<{ count: string; amount_minor: string; all_succeeded: boolean }>(
    `SELECT COUNT(*) AS count, SUM(amount_minor)::text AS amount_minor,
       bool_and(state = 'Succeeded' AND custody = 'StripeDirect' AND currency = 'CHF') AS all_succeeded
     FROM order_amendment_refund_legs WHERE operation_id = $1`,
    [operation.rows[0].id],
  );
  expect(legs.rows).toEqual([{ count: '4', amount_minor: '4500', all_succeeded: true }]);
  const result = await pool.query<RefundEvidence>(
    `SELECT l.operation_id, l.id AS refund_leg_id, e.refund_attempt_id,
       l.account_payment_attempt_id, l.amount_minor, l.currency,
       e.currency AS provider_observation_currency, l.state, l.custody,
       e.provider_refund_id, e.provider_refund_status, e.provider_charge_id,
       e.provider_intent_id, e.provider_account_id, e.provider_live_mode
     FROM order_amendment_refund_legs l
     JOIN order_amendment_refund_evidence e ON e.refund_leg_id = l.id
       AND e.kind = 'ProviderObservation' AND e.state = 'Succeeded'
       AND e.amount_minor = l.amount_minor
       AND e.provider_charge_id = l.provider_charge_id
       AND e.provider_intent_id = l.provider_intent_id
       AND e.provider_account_id = l.provider_account_id
       AND e.provider_live_mode = l.provider_live_mode
     WHERE l.operation_id = $1 ORDER BY l.id`,
    [operation.rows[0].id],
  );
  expect(result.rows).toHaveLength(4);
  const refundLegs = result.rows.map(({ provider_observation_currency, ...row }) => {
    expect(provider_observation_currency.toUpperCase()).toBe(row.currency);
    return row;
  });
  expect(new Set(refundLegs.map((value) => value.account_payment_attempt_id)).size).toBe(4);
  expect(new Set(refundLegs.map((value) => value.provider_refund_id)).size).toBe(4);
  expect(refundLegs.map((value) => Number(value.amount_minor)).sort((a, b) => a - b)).toEqual([501, 1249, 1250, 1500]);
  expect(capturedAttempts).toHaveLength(4);
  for (const row of refundLegs) {
    const captured = capturedAttempts.find((value) => value.attempt_id === row.account_payment_attempt_id);
    expect(captured).toBeDefined();
    expect(row).toMatchObject({
      amount_minor: captured?.amount_minor,
      currency: captured?.currency,
      provider_charge_id: captured?.provider_charge_id,
      provider_intent_id: captured?.provider_intent_id,
      provider_account_id: captured?.provider_account_id,
      provider_live_mode: captured?.provider_live_mode,
    });
    expect(row).toMatchObject({
      state: 'Succeeded',
      custody: 'StripeDirect',
      currency: 'CHF',
      provider_live_mode: false,
      provider_refund_status: 'succeeded',
    });
    expect(row.provider_refund_id).toMatch(/^re_[A-Za-z0-9]+$/);
    expect(row.refund_attempt_id).toMatch(/^[a-f0-9-]{36}$/);
  }
  writePrivateStripeBrowserEvidence(
    artifactIdentity,
    'refund-evidence.json',
    JSON.stringify({ operation: operation.rows[0], refundLegs }, null, 2),
  );
}
