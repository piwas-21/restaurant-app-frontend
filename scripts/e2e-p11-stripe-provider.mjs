import { spawn } from 'node:child_process';
import profileGuards from './e2e-p11-stripe-profile.cjs';
import { waitForChildClose } from './e2e-p11-stripe-process.mjs';
import systemTools from './e2e-p11-system-tools.cjs';

const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024;
const PROVIDER_COMMAND_TIMEOUT_MS = 40_000;

const { validateStripeProfile } = profileGuards;

function requireEvidence(condition) {
  if (!condition) throw new Error('Stripe test evidence did not match the frozen application attempt.');
}

export function validateStripeApiOrigin(raw) {
  let origin;
  try {
    origin = new URL(raw);
  } catch {
    throw new Error('The Stripe verification API origin is missing.');
  }
  requireEvidence(
    origin.protocol === 'https:' &&
      origin.hostname === 'api.stripe.com' &&
      !origin.port &&
      !origin.username &&
      !origin.password &&
      origin.pathname === '/' &&
      !origin.search &&
      !origin.hash,
  );
  return origin.origin;
}

/** GET only, normal TLS, credentials on stdin rather than the process argument list. */
export async function stripeRead(profile, origin, resource, connected = true, { signal, curlExecutable } = {}) {
  const accepted = validateStripeProfile(profile);
  requireEvidence(
    /^\/v1\/(accounts\/acct_[A-Za-z0-9]+|balance|checkout\/sessions\/cs_test_[A-Za-z0-9]+|payment_intents\/pi_[A-Za-z0-9]+|charges\/ch_[A-Za-z0-9]+|refunds\?charge=ch_[A-Za-z0-9]+&limit=100)$/.test(
      resource,
    ),
  );
  const apiOrigin = validateStripeApiOrigin(origin);
  const args = [
    '--disable',
    '--silent',
    '--show-error',
    '--max-time',
    '30',
    '--config',
    '-',
    '--write-out',
    '\n%{http_code}',
    `${apiOrigin}${resource}`,
  ];
  const env = Object.fromEntries(
    ['PATH', 'HOME', 'LANG'].filter((name) => process.env[name]).map((name) => [name, process.env[name]]),
  );
  const child = spawn(curlExecutable ?? systemTools.resolveSystemExecutable('curl'), args, {
    env,
    shell: false,
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let body = '';
  let bodyBytes = 0;
  let stderrBytes = 0;
  child.stdout.on('data', (chunk) => {
    bodyBytes += chunk.length;
    if (bodyBytes > MAX_PROVIDER_RESPONSE_BYTES) {
      child.kill('SIGKILL');
      return;
    }
    body += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderrBytes += chunk.length;
  });
  child.stdin.on('error', () => {
    /* A failed child is rejected by its exit status below. */
  });
  const account = connected ? `header = "Stripe-Account: ${accepted.connectedAccountId}"\n` : '';
  child.stdin.end(`user = "${accepted.apiKey}:"\n${account}`);
  const code = await waitForChildClose(child, PROVIDER_COMMAND_TIMEOUT_MS, signal).catch(() => -1);
  requireEvidence(code === 0 && stderrBytes === 0 && bodyBytes <= MAX_PROVIDER_RESPONSE_BYTES);
  const split = body.lastIndexOf('\n');
  requireEvidence(body.slice(split + 1) === '200');
  let value;
  try {
    value = JSON.parse(body.slice(0, split));
  } catch {
    throw new Error('Stripe test response was not JSON.');
  }
  requireEvidence(value && typeof value === 'object' && !value.error);
  return value;
}

export async function verifyTestConnectedAccount(profile, origin, options = {}) {
  const account = await stripeRead(profile, origin, `/v1/accounts/${profile.connectedAccountId}`, false, options);
  requireEvidence(
    account.id === profile.connectedAccountId && account.country === 'CH' && account.charges_enabled === true,
  );
  const balance = await stripeRead(profile, origin, '/v1/balance', true, options);
  requireEvidence(balance.livemode === false);
  return { connectedTestAccountVerified: true, currency: profile.currency };
}

export function verifyCapturedProviderObjects(expected, session, intent, charge) {
  requireEvidence(
    Number.isSafeInteger(expected.amountMinor) && expected.amountMinor > 0 && expected.currency === 'CHF',
  );
  requireEvidence(
    Number.isSafeInteger(expected.refundedMinor) &&
      expected.refundedMinor >= 0 &&
      expected.refundedMinor <= expected.amountMinor,
  );
  const currency = expected.currency.toLowerCase();
  for (const value of [session, intent, charge])
    requireEvidence(value.livemode === false && value.currency === currency);
  requireEvidence(
    session.id === expected.sessionId &&
      session.client_reference_id === expected.attemptId &&
      session.mode === 'payment' &&
      session.status === 'complete' &&
      session.payment_status === 'paid' &&
      session.amount_total === expected.amountMinor &&
      session.payment_intent === intent.id,
  );
  for (const value of [session, intent])
    requireEvidence(
      value.metadata?.account_payment_attempt === expected.attemptId &&
        value.metadata?.sofra_payment_schema === 'account-payment-v1',
    );
  requireEvidence(
    intent.id === expected.intentId &&
      intent.status === 'succeeded' &&
      intent.amount === expected.amountMinor &&
      intent.amount_received === expected.amountMinor &&
      intent.latest_charge === charge.id,
  );
  requireEvidence(
    charge.id === expected.chargeId &&
      charge.payment_intent === intent.id &&
      charge.paid === true &&
      charge.captured === true &&
      charge.disputed === false &&
      charge.amount === expected.amountMinor &&
      charge.amount_captured === expected.amountMinor &&
      charge.amount_refunded === expected.refundedMinor,
  );
  return { capturedMinor: expected.amountMinor, refundedMinor: expected.refundedMinor, currency: expected.currency };
}
