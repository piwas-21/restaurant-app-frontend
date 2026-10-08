import { chmodSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { getE2EDbPool } from '../helpers/db';
import { retainMixedTenderEvidence } from './mixedTenderEvidence';

jest.mock('../helpers/db', () => ({ getE2EDbPool: jest.fn() }));
jest.mock('@playwright/test', () => ({
  expect: jest.requireActual<typeof import('expect')>('expect').expect,
}));

const loadCommonJs = createRequire(path.resolve('e2e/p11-stripe/mixedTenderEvidence.test.ts'));
const { ensurePrivateArtifactDirectories } = loadCommonJs('../../scripts/e2e-p11-stripe-profile.cjs') as {
  ensurePrivateArtifactDirectories: (runId: string, evidenceRoot: string) => { browserDir: string };
};

const sessionId = '00000000-0000-4000-8000-000000000001';
const orderId = '00000000-0000-4000-8000-000000000002';
const amendmentId = '00000000-0000-4000-8000-000000000003';
const onlineAttemptId = '00000000-0000-4000-8000-000000000004';
const cashAttemptId = '00000000-0000-4000-8000-000000000005';
const onlineOperationId = '00000000-0000-4000-8000-000000000006';
const cashOperationId = '00000000-0000-4000-8000-000000000007';
const resolutionId = '00000000-0000-4000-8000-000000000008';
const itemId = '00000000-0000-4000-8000-000000000009';
const onlineLegId = '00000000-0000-4000-8000-000000000010';
const cashLegId = '00000000-0000-4000-8000-000000000011';
const receiptId = '00000000-0000-4000-8000-000000000012';
const cashIntentId = '00000000-0000-4000-8000-000000000013';

function queryRows(providerCurrency: string) {
  const online = {
    service_session_id: sessionId,
    attempt_id: onlineAttemptId,
    operation_id: onlineOperationId,
    mode: 'Amount',
    state: 'Captured',
    payment_method: 'OnlinePayment',
    actor_kind: 'GuestParticipant',
    amount_minor: '501',
    currency: 'CHF',
    provider_session_id: 'cs_test_mixedsession1',
    provider_intent_id: 'pi_mixedintent1',
    provider_charge_id: 'ch_mixedcharge1',
    provider_account_id: 'acct_mixedtest1',
    provider_live_mode: false,
    provider_captured_minor: '501',
    provider_refunded_minor: '501',
    reconciliation_required: false,
  };
  const cash = {
    service_session_id: sessionId,
    attempt_id: cashAttemptId,
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
  };
  const onlineAllocation = {
    attempt_id: onlineAttemptId,
    order_id: orderId,
    order_item_id: itemId,
    start_ordinal: 1,
    unit_count: 1,
    minor_per_unit: '501',
    amount_minor: '501',
  };
  const cashAllocation = {
    ...onlineAllocation,
    attempt_id: cashAttemptId,
    minor_per_unit: '999',
    amount_minor: '999',
  };
  return new Map<string, unknown[]>([
    ['FROM account_payment_attempts a', [online, cash]],
    ['FROM account_payment_attempts WHERE', [{ count: '2', amount_minor: '1500' }]],
    ['FROM account_payment_allocations', [onlineAllocation, cashAllocation]],
    [
      'FROM account_cash_collection_receipts',
      [
        {
          id: receiptId,
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
      ],
    ],
    [
      'FROM order_amendment_resolution_operations',
      [
        {
          id: resolutionId,
          state: 'Resolved',
          currency: 'CHF',
          credit_minor: '1500',
          refund_minor: '1500',
          unpaid_waived_minor: '0',
          service_session_id: sessionId,
          source_order_id: orderId,
          amendment_id: amendmentId,
        },
      ],
    ],
    [
      'FROM order_amendment_refund_legs WHERE operation_id',
      [
        {
          id: onlineLegId,
          operation_id: resolutionId,
          account_payment_attempt_id: onlineAttemptId,
          custody: 'StripeDirect',
          state: 'Succeeded',
          amount_minor: '501',
          currency: 'CHF',
          provider_account_id: 'acct_mixedtest1',
          provider_live_mode: false,
          provider_charge_id: online.provider_charge_id,
          provider_intent_id: online.provider_intent_id,
        },
        {
          id: cashLegId,
          operation_id: resolutionId,
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
    ],
    [
      'FROM order_amendment_refund_evidence',
      [
        {
          refund_leg_id: onlineLegId,
          refund_attempt_id: '00000000-0000-4000-8000-000000000014',
          state: 'Succeeded',
          amount_minor: '501',
          currency: providerCurrency,
          provider_refund_id: 're_mixedRefund1',
          provider_refund_status: 'succeeded',
          provider_charge_id: online.provider_charge_id,
          provider_intent_id: online.provider_intent_id,
          provider_account_id: online.provider_account_id,
          provider_live_mode: false,
        },
      ],
    ],
    [
      'FROM account_cash_refund_intents',
      [
        {
          id: cashIntentId,
          refund_leg_id: cashLegId,
          attempt_id: cashAttemptId,
          collection_receipt_id: receiptId,
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
      ],
    ],
    [
      'FROM account_cash_refund_evidence',
      [
        {
          exact_refund_amount_minor: '999',
          refund_adjustment_minor: '1',
          cash_returned_minor: '1000',
          currency: 'CHF',
          actor_role: 'Admin',
        },
      ],
    ],
    [
      'FROM account_payment_allocation_reversals',
      [
        {
          refund_leg_id: onlineLegId,
          attempt_id: onlineAttemptId,
          order_id: orderId,
          order_item_id: itemId,
          start_ordinal: 1,
          unit_count: 1,
          minor_per_unit: '501',
          amount_minor: '501',
        },
        {
          refund_leg_id: cashLegId,
          attempt_id: cashAttemptId,
          order_id: orderId,
          order_item_id: itemId,
          start_ordinal: 1,
          unit_count: 1,
          minor_per_unit: '999',
          amount_minor: '999',
        },
      ],
    ],
  ]);
}

describe('P11 mixed-tender evidence collection', () => {
  let evidenceRoot: string;
  let browserDirectory: string;
  let previousEnvironment: Partial<
    Record<'P11_STRIPE_EVIDENCE_ROOT' | 'P11_RUN_ID' | 'P11_STRIPE_ARTIFACT_DIR', string | undefined>
  >;

  beforeEach(() => {
    const runId = '0000000000000000';
    evidenceRoot = mkdtempSync(path.join(os.tmpdir(), 'p11-mixed-evidence-'));
    chmodSync(evidenceRoot, 0o700);
    browserDirectory = ensurePrivateArtifactDirectories(runId, evidenceRoot).browserDir;
    previousEnvironment = {
      P11_STRIPE_EVIDENCE_ROOT: process.env.P11_STRIPE_EVIDENCE_ROOT,
      P11_RUN_ID: process.env.P11_RUN_ID,
      P11_STRIPE_ARTIFACT_DIR: process.env.P11_STRIPE_ARTIFACT_DIR,
    };
    process.env.P11_STRIPE_EVIDENCE_ROOT = evidenceRoot;
    process.env.P11_RUN_ID = runId;
    process.env.P11_STRIPE_ARTIFACT_DIR = browserDirectory;
  });

  afterEach(() => {
    for (const [name, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    rmSync(evidenceRoot, { recursive: true, force: true });
  });

  async function collect(providerCurrency: string) {
    const rows = queryRows(providerCurrency);
    const query = jest.fn(async (statement: string) => {
      for (const [fragment, result] of rows) {
        if (statement.includes(fragment)) return { rows: result };
      }
      throw new Error('Unexpected mixed-tender evidence query.');
    });
    const pool = { query } as unknown as ReturnType<typeof getE2EDbPool>;
    (getE2EDbPool as jest.MockedFunction<typeof getE2EDbPool>).mockReturnValue(pool);
    await retainMixedTenderEvidence(sessionId, orderId, amendmentId, { onlineOperationId, cashOperationId });
    return readFileSync(path.join(browserDirectory, 'mixed-tender-evidence.json'), 'utf8');
  }

  test.each(['CHF', 'chf'])(
    'accepts provider observation currency %s and records exact split scopes',
    async (currency) => {
      const serialized = await collect(currency);
      const evidence = JSON.parse(serialized) as {
        allocations: Array<{
          order_item_id: string;
          start_ordinal: number;
          minor_per_unit: string;
          amount_minor: string;
        }>;
        refundLegs: Array<{ currency: string }>;
        providerRefunds: Array<{ currency: string }>;
        allocationReversals: Array<{ minor_per_unit: string; amount_minor: string }>;
      };
      expect(evidence.allocations.map(({ minor_per_unit, amount_minor }) => [minor_per_unit, amount_minor])).toEqual([
        ['501', '501'],
        ['999', '999'],
      ]);
      expect(evidence.allocations.map(({ order_item_id, start_ordinal }) => [order_item_id, start_ordinal])).toEqual([
        [itemId, 1],
        [itemId, 1],
      ]);
      expect(evidence.allocations.reduce((total, row) => total + Number(row.amount_minor), 0)).toBe(1500);
      expect(evidence.refundLegs.map((row) => row.currency)).toEqual(['CHF', 'CHF']);
      expect(evidence.providerRefunds.map((row) => row.currency)).toEqual([currency]);
      expect(
        evidence.allocationReversals.map(({ minor_per_unit, amount_minor }) => [minor_per_unit, amount_minor]),
      ).toEqual([
        ['501', '501'],
        ['999', '999'],
      ]);
    },
  );

  test('rejects a provider observation with a different currency without writing evidence', async () => {
    await expect(collect('EUR')).rejects.toThrow();
    expect(() => readFileSync(path.join(browserDirectory, 'mixed-tender-evidence.json'), 'utf8')).toThrow();
  });
});
