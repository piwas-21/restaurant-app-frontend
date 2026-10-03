import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function runFixture(sidecar, source) {
  const root = mkdtempSync(join(tmpdir(), 't-keys-sidecar-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'src/locales/order-workspace'), { recursive: true });
    copyFileSync(new URL('./check-t-keys.mjs', import.meta.url), join(root, 'scripts/check-t-keys.mjs'));
    writeFileSync(join(root, 'scripts/t-keys-baseline.json'), '{"defaulted":[]}');
    writeFileSync(join(root, 'src/locales/en.json'), '{"save":"Save"}');
    if (sidecar !== null)
      writeFileSync(join(root, 'src/locales/order-workspace/en.json'), JSON.stringify(sidecar));
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
