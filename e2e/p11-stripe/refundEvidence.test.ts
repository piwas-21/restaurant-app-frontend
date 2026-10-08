import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getE2EDbPool } from '../helpers/db';
import type { StoredAttempt } from './paymentEvidence';
import { retainRefundEvidence } from './refundEvidence';

jest.mock('../helpers/db', () => ({
  getE2EDbPool: jest.fn(),
}));
jest.mock('@playwright/test', () => ({
  expect: jest.requireActual<typeof import('expect')>('expect').expect,
}));

const amounts = [501, 1249, 1250, 1500] as const;
const operation = {
  id: 'operation-1',
  state: 'Resolved',
  currency: 'CHF',
  credit_minor: '4500',
  refund_minor: '4500',
  unpaid_waived_minor: '0',
};

const capturedAttempts: StoredAttempt[] = amounts.map((amount, index) => {
  const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
  return {
    attempt_id: id,
    operation_id: `guest-operation-${index}`,
    mode: 'Amount',
    state: 'Captured',
    amount_minor: String(amount),
    currency: 'CHF',
    provider_session_id: `cs_test_session${index}`,
    provider_intent_id: `pi_test_intent${index}`,
    provider_charge_id: `ch_test_charge${index}`,
    provider_account_id: `acct_testaccount${index}`,
    provider_live_mode: false,
    provider_captured_minor: String(amount),
    provider_refunded_minor: String(amount),
    reconciliation_required: false,
  };
});

function evidenceRows(providerCurrency: string): Record<string, unknown>[] {
  return capturedAttempts.map((attempt, index) => ({
    operation_id: operation.id,
    refund_leg_id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    refund_attempt_id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    account_payment_attempt_id: attempt.attempt_id,
    amount_minor: attempt.amount_minor,
    currency: 'CHF',
    provider_observation_currency: providerCurrency,
    state: 'Succeeded',
    custody: 'StripeDirect',
    provider_refund_id: `re_testRefund${index}`,
    provider_refund_status: 'succeeded',
    provider_charge_id: attempt.provider_charge_id,
    provider_intent_id: attempt.provider_intent_id,
    provider_account_id: attempt.provider_account_id,
    provider_live_mode: false,
  }));
}

describe('P11 refund evidence currency matching', () => {
  let evidenceRoot: string;
  let browserDirectory: string;
  let previousEnvironment: Partial<
    Record<'P11_STRIPE_EVIDENCE_ROOT' | 'P11_RUN_ID' | 'P11_STRIPE_ARTIFACT_DIR', string | undefined>
  >;

  beforeEach(() => {
    const runId = '0000000000000000';
    evidenceRoot = mkdtempSync(path.join(os.tmpdir(), 'p11-refund-evidence-'));
    chmodSync(evidenceRoot, 0o700);
    const runDirectory = path.join(evidenceRoot, runId);
    browserDirectory = path.join(runDirectory, 'browser');
    mkdirSync(runDirectory, { mode: 0o700 });
    mkdirSync(browserDirectory, { mode: 0o700 });
    chmodSync(runDirectory, 0o700);
    chmodSync(browserDirectory, 0o700);

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

  async function collect(providerCurrency: string): Promise<readonly string[]> {
    const rows = evidenceRows(providerCurrency);
    const statements: string[] = [];
    const query = jest.fn(async (statement: string) => {
      statements.push(statement);
      if (statement.includes('FROM order_amendment_resolution_operations')) {
        return { rows: [operation] };
      }
      if (statement.includes('FROM order_amendment_refund_legs WHERE operation_id')) {
        return { rows: [{ count: '4', amount_minor: '4500', all_succeeded: true }] };
      }
      if (statement.includes('FROM order_amendment_refund_legs l')) {
        return { rows };
      }
      throw new Error('Unexpected refund evidence query.');
    });

    const pool = { query } as unknown as ReturnType<typeof getE2EDbPool>;
    (getE2EDbPool as jest.MockedFunction<typeof getE2EDbPool>).mockReturnValue(pool);
    await retainRefundEvidence('session-1', 'order-1', 'amendment-1', capturedAttempts);
    return statements;
  }

  test.each(['chf', 'CHF'])(
    'accepts provider observation currency %s and preserves strict leg currency',
    async (currency) => {
      const statements = await collect(currency);
      const observationQuery = statements.find((statement) => statement.includes('FROM order_amendment_refund_legs l'));
      expect(observationQuery).toContain('e.currency AS provider_observation_currency');
      expect(observationQuery).not.toMatch(/(?:e\.currency\s*=\s*l\.currency|l\.currency\s*=\s*e\.currency)/i);
      const written = JSON.parse(readFileSync(path.join(browserDirectory, 'refund-evidence.json'), 'utf8')) as {
        refundLegs: Array<{ currency: string }>;
      };
      expect(written.refundLegs.map((row) => row.currency)).toEqual(['CHF', 'CHF', 'CHF', 'CHF']);
      expect(written.refundLegs.every((row) => !Object.hasOwn(row, 'provider_observation_currency'))).toBe(true);
    },
  );

  test('rejects a provider observation with a different currency', async () => {
    await expect(collect('EUR')).rejects.toThrow(/Expected: "CHF"/);
    expect(existsSync(path.join(browserDirectory, 'refund-evidence.json'))).toBe(false);
  });
});
