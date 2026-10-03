import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function runFixture(
  sidecar,
  source,
  tableGuestSidecar = { table_guest_join_action: 'Join table' },
  accountPaymentSidecar = { accountPayments: { captured: 'Paid contributions' } },
  tableGuestPaymentSidecar = { table_guest_payment_title: 'Table payments' },
) {
  const root = mkdtempSync(join(tmpdir(), 't-keys-sidecar-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'src/locales/order-workspace'), { recursive: true });
    mkdirSync(join(root, 'src/locales/table-guest'), { recursive: true });
    mkdirSync(join(root, 'src/locales/table-guest-payments'), { recursive: true });
    mkdirSync(join(root, 'src/locales/account-payments'), { recursive: true });
    copyFileSync(new URL('./check-t-keys.mjs', import.meta.url), join(root, 'scripts/check-t-keys.mjs'));
    writeFileSync(join(root, 'scripts/t-keys-baseline.json'), '{"defaulted":[]}');
    writeFileSync(join(root, 'src/locales/en.json'), '{"save":"Save"}');
    if (sidecar !== null) writeFileSync(join(root, 'src/locales/order-workspace/en.json'), JSON.stringify(sidecar));
    if (tableGuestSidecar !== null)
      writeFileSync(join(root, 'src/locales/table-guest/en.json'), JSON.stringify(tableGuestSidecar));
    if (tableGuestPaymentSidecar !== null)
      writeFileSync(join(root, 'src/locales/table-guest-payments/en.json'), JSON.stringify(tableGuestPaymentSidecar));
    if (accountPaymentSidecar !== null)
      writeFileSync(join(root, 'src/locales/account-payments/en.json'), JSON.stringify(accountPaymentSidecar));
    writeFileSync(join(root, 'src/fixture.ts'), source);
    const result = spawnSync(process.execPath, [join(root, 'scripts/check-t-keys.mjs')], { encoding: 'utf8' });
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('base and declared lazy keys both resolve without a fallback', () => {
  const result = runFixture({ orderAmendments: { open: 'Amend order' } }, "t('save'); t('orderAmendments.open');");
  assert.equal(result.status, 0, result.output);
});

test('a neighboring missing key remains an error', () => {
  const result = runFixture({ orderAmendments: { open: 'Amend order' } }, "t('orderAmendments.missing');");
  assert.equal(result.status, 1);
  assert.match(result.output, /orderAmendments\.missing/);
});

test('a default for a missing lazy key cannot bypass the baseline', () => {
  const result = runFixture({}, "t('orderAmendments.missing', 'Fallback');");
  assert.equal(result.status, 1);
  assert.match(result.output, /new key\(s\) missing/);
});

test('a deleted declared sidecar fails closed', () => {
  assert.equal(runFixture(null, "t('save');").status, 1);
});

test('table guest keys resolve from their lazy sidecar', () => {
  const result = runFixture({}, "t('table_guest_join_action');", { table_guest_join_action: 'Join table' });
  assert.equal(result.status, 0, result.output);
});

test('missing table guest keys remain an error', () => {
  const result = runFixture({}, "t('table_guest_missing');");
  assert.equal(result.status, 1);
  assert.match(result.output, /table_guest_missing/);
});

test('a deleted table guest sidecar fails closed', () => {
  assert.equal(runFixture({ orderAmendments: { open: 'Amend order' } }, "t('save');", null).status, 1);
});

test('account payment keys resolve from their lazy sidecar', () => {
  const result = runFixture({}, "t('accountPayments.captured');");
  assert.equal(result.status, 0, result.output);
});

test('missing account payment keys remain an error', () => {
  const result = runFixture({}, "t('accountPayments.missing');");
  assert.equal(result.status, 1);
  assert.match(result.output, /accountPayments\.missing/);
});

test('a deleted account payment sidecar fails closed', () => {
  assert.equal(runFixture({}, "t('save');", undefined, null).status, 1);
});

test('table guest payment keys resolve from their lazy sidecar', () => {
  const result = runFixture({}, "t('table_guest_payment_title');");
  assert.equal(result.status, 0, result.output);
});

test('an unused table guest payment key remains an error', () => {
  const result = runFixture({}, "t('table_guest_payment_missing');");
  assert.equal(result.status, 1);
  assert.match(result.output, /table_guest_payment_missing/);
});

test('a deleted table guest payment sidecar fails closed', () => {
  assert.equal(runFixture({}, "t('save');", undefined, undefined, null).status, 1);
});
