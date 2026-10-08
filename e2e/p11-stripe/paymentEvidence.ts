import { createRequire } from 'node:module';
import path from 'node:path';
import { expect } from '@playwright/test';
import { getE2EDbPool } from '../helpers/db';
import { assertPaymentAttemptActors } from './paymentEvidenceActorChecks';
import type { CapturedAttempt, StoredAttemptActor } from './paymentEvidenceActorChecks';

export { assertPaymentAttemptActors } from './paymentEvidenceActorChecks';
export type { CapturedAttempt, StoredAttemptActor } from './paymentEvidenceActorChecks';

const require = createRequire(path.resolve('e2e/p11-stripe/paymentEvidence.ts'));
const { resolvePrivateStripeBrowserArtifactDirectory, writePrivateStripeBrowserSnapshot } =
  require('../../scripts/e2e-p11-stripe-profile.cjs') as {
    resolvePrivateStripeBrowserArtifactDirectory: (
      evidenceRoot: string,
      runId: string,
      artifactDirectory: string,
    ) => string;
    writePrivateStripeBrowserSnapshot: (
      identity: { evidenceRoot: string; runId: string; artifactDirectory: string },
      filename: 'captured-attempts.json' | 'refunded-attempts.json',
      contents: string,
    ) => void;
  };

export interface StoredAttempt {
  readonly attempt_id: string;
  readonly operation_id: string;
  readonly mode: string;
  readonly state: string;
  readonly amount_minor: string;
  readonly currency: string;
  readonly provider_session_id: string;
  readonly provider_intent_id: string;
  readonly provider_charge_id: string;
  readonly provider_account_id: string;
  readonly provider_live_mode: boolean;
  readonly provider_captured_minor: string;
  readonly provider_refunded_minor: string;
  readonly reconciliation_required: boolean;
}

/** Read-only application oracle; keep financial evidence outside card-screen browser artifacts. */
export async function retainPaymentEvidence(
  sessionId: string,
  attempts: readonly CapturedAttempt[],
  refunded: boolean,
  releasedCashierOperationId: string,
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
  const result = await getE2EDbPool().query<StoredAttempt>(
    `SELECT a.id AS attempt_id, a.operation_id, a.mode, a.state, a.amount_minor, a.currency,
       j.provider_session_id, j.provider_intent_id, j.provider_charge_id, j.provider_account_id,
       j.provider_live_mode, j.provider_captured_minor, j.provider_refunded_minor, j.reconciliation_required
     FROM account_payment_attempts a JOIN account_checkout_journals j ON j.attempt_id = a.id
     WHERE a.service_session_id = $1 ORDER BY a.created_at, a.id`,
    [sessionId],
  );
  expect(result.rows).toHaveLength(attempts.length);
  for (const expected of attempts) {
    const row = result.rows.find((value) => value.attempt_id === expected.attemptId);
    expect(row).toMatchObject({
      operation_id: expected.operationId,
      mode: expected.mode,
      state: 'Captured',
      amount_minor: String(expected.amountMinor),
      currency: 'CHF',
      provider_live_mode: false,
      reconciliation_required: false,
      provider_captured_minor: String(expected.amountMinor),
      provider_refunded_minor: String(refunded ? expected.amountMinor : 0),
    });
    expect(row?.provider_session_id).toMatch(/^cs_test_[A-Za-z0-9]+$/);
    expect(row?.provider_intent_id).toMatch(/^pi_[A-Za-z0-9]+$/);
    expect(row?.provider_charge_id).toMatch(/^ch_[A-Za-z0-9]+$/);
  }
  const actors = await getE2EDbPool().query<StoredAttemptActor>(
    `SELECT a.id AS attempt_id, a.operation_id, a.actor_id, a.actor_kind, a.state,
       j.attempt_id AS journal_attempt_id
     FROM account_payment_attempts a
     LEFT JOIN account_checkout_journals j ON j.attempt_id = a.id
     WHERE a.service_session_id = $1 ORDER BY a.created_at, a.id`,
    [sessionId],
  );
  assertPaymentAttemptActors(actors.rows, attempts, releasedCashierOperationId);
  writePrivateStripeBrowserSnapshot(
    artifactIdentity,
    refunded ? 'refunded-attempts.json' : 'captured-attempts.json',
    JSON.stringify({ serviceSessionId: sessionId, expectedAttempts: attempts, storedAttempts: result.rows }, null, 2),
  );
  return result.rows;
}
