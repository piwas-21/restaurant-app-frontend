import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import guards from './e2e-p11-stripe-profile.cjs';
import targetGuards from './e2e-p11-target.cjs';
import { startLogged, stopProcess, waitUntil } from './e2e-p11-stripe-process.mjs';

const EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
].join(',');

export async function startStripeListener(executable, stateDir, runEnv, profile, systemEnv, { signal } = {}) {
  targetGuards.validateP11LocalIdentity(runEnv);
  if (!path.isAbsolute(executable)) throw new Error('The isolated Stripe CLI executable must be explicit.');
  guards.assertPrivateDirectory(stateDir);
  const configuration = path.join(stateDir, 'stripe-cli-config');
  mkdirSync(configuration, { mode: 0o700 });
  guards.assertPrivateDirectory(configuration);
  const configurationFile = path.join(configuration, 'config.toml');
  guards.writePrivateEvidenceFile(configuration, 'config.toml', '');
  const logfile = path.join(stateDir, 'stripe-listener.log');
  const env = {
    ...guards.buildStripeListenerEnvironment(systemEnv, profile),
    XDG_CONFIG_HOME: configuration,
  };
  const listener = startLogged(
    executable,
    [
      '--config',
      configurationFile,
      '--color',
      'off',
      'listen',
      '--events',
      EVENTS,
      '--forward-connect-to',
      `${runEnv.E2E_API_BASE_URL}/api/webhooks/stripe/account-checkouts`,
    ],
    env,
    stateDir,
    logfile,
    { signal },
  );
  let signingSecret;
  try {
    await waitUntil(
      (activeSignal) => {
        if (activeSignal?.aborted) return false;
        signingSecret = /\bwhsec_[A-Za-z0-9]{16,}\b/.exec(readFileSync(logfile, 'utf8'))?.[0];
        return Boolean(signingSecret);
      },
      30000,
      listener,
      signal,
    );
    return { listener, signingSecret };
  } catch {
    await stopProcess(listener);
    throw new Error('The test Connect listener could not establish its signing secret.');
  }
}
