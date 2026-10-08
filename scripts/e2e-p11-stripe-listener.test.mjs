import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import guards from './e2e-p11-stripe-profile.cjs';
import { startStripeListener } from './e2e-p11-stripe-listener.mjs';
import { readGeneratedEnvironment, runLogged, stopProcess } from './e2e-p11-stripe-process.mjs';

const profile = {
  profile: guards.PROFILE,
  apiKey: `sk_test_${'a1'.repeat(16)}`,
  connectedAccountId: `acct_${'b2'.repeat(8)}`,
  currency: 'CHF',
};
const signingSecret = `whsec_${'c3'.repeat(16)}`;

async function fixture(t, code) {
  const state = mkdtempSync('/tmp/table-account-stripe-listener-control.');
  t.after(() => rmSync(state, { recursive: true, force: true }));
  const helper = path.resolve('scripts/e2e-p11-target.cjs');
  const log = path.join(state, 'target.log');
  await runLogged(process.execPath, [helper, 'init', state], {}, state, log);
  await runLogged(process.execPath, [helper, 'configure', state, '55001', '55002'], {}, state, log);
  const executable = path.join(state, 'listener-control');
  writeFileSync(executable, `#!${process.execPath}\n${code}\n`, { mode: 0o700 });
  return { state, executable, env: readGeneratedEnvironment(path.join(state, 'runner.env')) };
}

test('Connect listener uses private configuration and never puts its test credential in arguments', async (t) => {
  const { state, executable, env } = await fixture(
    t,
    `require('node:fs').writeFileSync('invocation.json', JSON.stringify({args: process.argv.slice(2), env: process.env}), {mode: 0o600});
process.stdout.write(${JSON.stringify(signingSecret)});
setInterval(() => {}, 1000);`,
  );
  const started = await startStripeListener(executable, state, env, profile, {
    PATH: process.env.PATH,
    STRIPE_SECRET_KEY: 'unrelated-provider-value', // pragma: allowlist secret -- Synthetic ambient value
    AccountCheckoutWebhook__SigningSecret: 'unrelated-signing-value', // pragma: allowlist secret -- Synthetic ambient value
  });
  t.after(() => stopProcess(started.listener));
  assert.equal(started.signingSecret, signingSecret);
  const invocation = JSON.parse(readFileSync(path.join(state, 'invocation.json'), 'utf8'));
  const config = path.join(state, 'stripe-cli-config', 'config.toml');
  assert.deepEqual(invocation.args.slice(0, 5), ['--config', config, '--color', 'off', 'listen']);
  assert.equal(invocation.args.at(-2), '--forward-connect-to');
  assert.equal(invocation.args.at(-1), `${env.E2E_API_BASE_URL}/api/webhooks/stripe/account-checkouts`);
  assert.ok(invocation.args.includes('charge.refunded') === false);
  assert.ok(invocation.args[6].split(',').includes('charge.refunded'));
  assert.ok(invocation.args.every((value) => !value.includes(profile.apiKey)));
  assert.ok(!invocation.args.includes('--live'));
  assert.equal(invocation.env.STRIPE_API_KEY, profile.apiKey);
  assert.equal(invocation.env.STRIPE_SECRET_KEY, undefined);
  assert.equal(invocation.env.AccountCheckoutWebhook__SigningSecret, undefined);
  assert.equal(statSync(path.dirname(config)).mode & 0o777, 0o700);
  assert.equal(statSync(config).mode & 0o777, 0o600);
  assert.equal(statSync(path.join(state, 'stripe-listener.log')).mode & 0o777, 0o600);
  await stopProcess(started.listener);
});

test('a listener that exits without a signing secret cannot pass readiness', async (t) => {
  const { state, executable, env } = await fixture(t, 'process.exit(4);');
  await assert.rejects(
    startStripeListener(executable, state, env, profile, {}),
    /could not establish its signing secret/,
  );
});

test('invalid local identity and nonabsolute CLI paths are refused before a listener starts', async (t) => {
  const { state, executable, env } = await fixture(t, 'process.exit(0);');
  await assert.rejects(
    startStripeListener(executable, state, { ...env, Stripe__PlatformApiKey: profile.apiKey }, profile, {}),
    /provider credentials or a payment mode were inherited/,
  );
  await assert.rejects(startStripeListener('stripe', state, env, profile, {}), /CLI executable must be explicit/);
  assert.throws(() => statSync(path.join(state, 'stripe-cli-config')), { code: 'ENOENT' });
});
