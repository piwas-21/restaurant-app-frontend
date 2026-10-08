/* eslint-disable @typescript-eslint/no-require-imports */
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validateP11LocalIdentity } = require('./e2e-p11-target.cjs');

const PROFILE = 'account-splits-test-v1';
const PROFILE_FIELDS = ['profile', 'apiKey', 'connectedAccountId', 'currency'];
const API_FIELDS = [
  'Stripe__Enabled',
  'Stripe__PlatformApiKey',
  'Stripe__ConnectedAccountId',
  'AccountCheckoutWebhook__SigningSecret',
];
const SYSTEM_FIELDS = ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'DOTNET_ROOT'];
const TEST_MODULES = 'core,kitchen-board,cashier,server,printing,online-payments';
const PRIVATE_DIRECTORY_FLAGS = fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW;
const REPLACEABLE_BROWSER_EVIDENCE = new Set(['captured-attempts.json', 'refunded-attempts.json']);

function refuse(reason) {
  throw new Error(`P11 Stripe profile refused: ${reason}`);
}

function validateStripeProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) refuse('invalid profile document.');
  if (Object.keys(value).length !== PROFILE_FIELDS.length || PROFILE_FIELDS.some((name) => !Object.hasOwn(value, name)))
    refuse('unexpected or missing profile fields.');
  if (value.profile !== PROFILE) refuse('the explicit test profile is missing.');
  if (
    typeof value.apiKey !== 'string' || // pragma: allowlist secret -- Public credential field type check
    !/^sk_test_[A-Za-z0-9]{16,}$/.test(value.apiKey) // pragma: allowlist secret -- Public test-key format
  )
    refuse('a full test secret is required.');
  if (typeof value.connectedAccountId !== 'string' || !/^acct_[A-Za-z0-9]{8,}$/.test(value.connectedAccountId))
    refuse('the selected connected account is missing.');
  if (value.currency !== 'CHF') refuse('this acceptance profile requires the seeded CHF catalogue.');
  return Object.freeze({ ...value });
}

/** Read only a private regular file; never follow a link or load a tenant production environment. */
function readStripeProfile(filename) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename))
    refuse('a private absolute profile path is required.');
  if (!/^table-account-p11-stripe-profile-[a-f0-9]{32}\.json$/.test(path.basename(filename)))
    refuse('the profile must be a temporary test document.');
  const descriptor = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || stat.size > 4096)
      refuse('the profile must be a small mode-0600 regular file.');
    if (process.getuid && stat.uid !== process.getuid()) refuse('the profile belongs to another user.');
    let value;
    try {
      value = JSON.parse(fs.readFileSync(descriptor, 'utf8'));
    } catch {
      refuse('invalid profile document.');
    }
    return validateStripeProfile(value);
  } finally {
    fs.closeSync(descriptor);
  }
}

function systemEnvironment(systemEnv) {
  if (Object.keys(systemEnv).some((name) => /^DOCKER_/i.test(name)))
    refuse('ambient Docker endpoint overrides are not accepted.');
  return Object.fromEntries(SYSTEM_FIELDS.filter((name) => systemEnv[name]).map((name) => [name, systemEnv[name]]));
}

function currentUid() {
  if (!process.getuid) refuse('the current user identity is unavailable.');
  return process.getuid();
}

function assertPrivateDirectory(directory) {
  let descriptor;
  try {
    const linkStat = fs.lstatSync(directory);
    if (!linkStat.isDirectory() || linkStat.isSymbolicLink()) refuse('evidence directories must not be links.');
    descriptor = fs.openSync(directory, PRIVATE_DIRECTORY_FLAGS);
    const stat = fs.fstatSync(descriptor);
    if (
      !stat.isDirectory() ||
      stat.uid !== currentUid() ||
      (stat.mode & 0o777) !== 0o700 ||
      stat.dev !== linkStat.dev ||
      stat.ino !== linkStat.ino
    )
      refuse('evidence directories must be same-user mode-0700 directories.');
  } catch (error) {
    if (error.message.startsWith('P11 Stripe profile refused:')) throw error;
    refuse('evidence directories could not be safely opened.');
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function createPrivateDirectory(directory) {
  try {
    fs.mkdirSync(directory, { mode: 0o700 });
  } catch {
    refuse('the private evidence path already exists or could not be created.');
  }
  assertPrivateDirectory(directory);
}

/** Create fresh, exclusive run directories beneath the one fixed evidence root. */
function ensurePrivateArtifactDirectories(runId, root) {
  if (!/^[a-f0-9]{16}$/.test(runId ?? '') || !path.isAbsolute(root))
    refuse('a valid run identity and absolute evidence root are required.');
  try {
    fs.mkdirSync(root, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') refuse('the private evidence root could not be created.');
  }
  assertPrivateDirectory(root);
  const runDirectory = path.join(root, runId);
  createPrivateDirectory(runDirectory);
  const browserDirectory = path.join(runDirectory, 'browser');
  createPrivateDirectory(browserDirectory);
  return { evidenceDir: runDirectory, browserDir: browserDirectory };
}

function writePrivateEvidenceFile(directory, filename, contents) {
  assertPrivateDirectory(directory);
  if (path.basename(filename) !== filename || !filename) refuse('evidence filenames must be simple names.');
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW;
  let descriptor;
  try {
    descriptor = fs.openSync(path.join(directory, filename), flags, 0o600);
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.uid !== currentUid() || (stat.mode & 0o777) !== 0o600)
      refuse('evidence files must be same-user mode-0600 regular files.');
    fs.writeFileSync(descriptor, contents);
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (error.message.startsWith('P11 Stripe profile refused:')) throw error;
    refuse('private evidence could not be written safely.');
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  assertPrivateDirectory(directory);
}

function inspectPrivateSnapshotTarget(directory, filename) {
  const target = path.join(directory, filename);
  let linkStat;
  try {
    linkStat = fs.lstatSync(target);
  } catch (error) {
    if (error.code === 'ENOENT') return { exists: false };
    refuse('snapshot evidence could not be safely inspected.');
  }
  if (!linkStat.isFile() || linkStat.isSymbolicLink())
    refuse('existing snapshots must be same-user mode-0600 regular files.');

  let descriptor;
  try {
    descriptor = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const stat = fs.fstatSync(descriptor);
    if (
      !stat.isFile() ||
      stat.uid !== currentUid() ||
      (stat.mode & 0o777) !== 0o600 ||
      stat.nlink !== 1 ||
      stat.dev !== linkStat.dev ||
      stat.ino !== linkStat.ino
    )
      refuse('existing snapshots must be same-user mode-0600 regular files.');
    return { exists: true, dev: stat.dev, ino: stat.ino };
  } catch (error) {
    if (error.message.startsWith('P11 Stripe profile refused:')) throw error;
    refuse('snapshot evidence could not be safely opened.');
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function replacePrivateSnapshotAtomically(directory, filename, contents) {
  assertPrivateDirectory(directory);
  if (!REPLACEABLE_BROWSER_EVIDENCE.has(filename)) refuse('this browser evidence file cannot be replaced.');
  const target = path.join(directory, filename);
  const original = inspectPrivateSnapshotTarget(directory, filename);
  const temporary = path.join(directory, `.${filename}.${randomUUID()}.tmp`);
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW;
  let descriptor;
  let parentDescriptor;
  let renamed = false;
  try {
    descriptor = fs.openSync(temporary, flags, 0o600);
    const temporaryStat = fs.fstatSync(descriptor);
    if (!temporaryStat.isFile() || temporaryStat.uid !== currentUid() || (temporaryStat.mode & 0o777) !== 0o600)
      refuse('temporary snapshots must be same-user mode-0600 regular files.');
    fs.writeFileSync(descriptor, contents);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;

    assertPrivateDirectory(directory);
    const current = inspectPrivateSnapshotTarget(directory, filename);
    if (
      current.exists !== original.exists ||
      (original.exists && (current.dev !== original.dev || current.ino !== original.ino))
    )
      refuse('snapshot target changed during refresh.');
    fs.renameSync(temporary, target);
    renamed = true;
    parentDescriptor = fs.openSync(directory, PRIVATE_DIRECTORY_FLAGS);
    fs.fsyncSync(parentDescriptor);
    fs.closeSync(parentDescriptor);
    parentDescriptor = undefined;
    assertPrivateDirectory(directory);
    inspectPrivateSnapshotTarget(directory, filename);
  } catch (error) {
    if (error.message.startsWith('P11 Stripe profile refused:')) throw error;
    refuse('private snapshot could not be replaced safely.');
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {}
    }
    if (parentDescriptor !== undefined) {
      try {
        fs.closeSync(parentDescriptor);
      } catch {}
    }
    if (!renamed) {
      try {
        fs.unlinkSync(temporary);
      } catch (error) {
        if (error.code !== 'ENOENT') refuse('temporary snapshot could not be removed safely.');
      }
    }
  }
}

/** Resolve the exact private browser directory generated for this run, regardless of the system temp root. */
function resolvePrivateStripeBrowserArtifactDirectory(evidenceRoot, runId, artifactDirectory) {
  if (
    typeof evidenceRoot !== 'string' ||
    !path.isAbsolute(evidenceRoot) ||
    !/^[a-f0-9]{16}$/.test(runId ?? '') ||
    typeof artifactDirectory !== 'string' ||
    !path.isAbsolute(artifactDirectory)
  )
    refuse('a run-owned browser artifact identity is required.');
  const root = path.resolve(evidenceRoot);
  const runDirectory = path.join(root, runId);
  const browserDirectory = path.join(runDirectory, 'browser');
  if (path.resolve(artifactDirectory) !== browserDirectory)
    refuse('the browser artifact directory does not match its private run identity.');
  assertPrivateDirectory(root);
  assertPrivateDirectory(runDirectory);
  assertPrivateDirectory(browserDirectory);
  return browserDirectory;
}

function writePrivateStripeBrowserEvidence(identity, filename, contents) {
  const directory = resolvePrivateStripeBrowserArtifactDirectory(
    identity?.evidenceRoot,
    identity?.runId,
    identity?.artifactDirectory,
  );
  if (REPLACEABLE_BROWSER_EVIDENCE.has(filename)) refuse('evolving snapshots require the dedicated snapshot writer.');
  writePrivateEvidenceFile(directory, filename, contents);
}

function writePrivateStripeBrowserSnapshot(identity, filename, contents) {
  const directory = resolvePrivateStripeBrowserArtifactDirectory(
    identity?.evidenceRoot,
    identity?.runId,
    identity?.artifactDirectory,
  );
  if (!REPLACEABLE_BROWSER_EVIDENCE.has(filename)) refuse('this browser evidence file cannot be replaced.');
  replacePrivateSnapshotAtomically(directory, filename, contents);
}

function buildStripeListenerEnvironment(systemEnv, profile) {
  const accepted = validateStripeProfile(profile);
  return { ...systemEnvironment(systemEnv), STRIPE_API_KEY: accepted.apiKey };
}

function buildStripeBrowserEnvironment(runEnv, systemEnv, profile, artifactDirectory) {
  validateP11LocalIdentity(runEnv);
  const accepted = validateStripeProfile(profile);
  const common = { ...systemEnvironment(systemEnv), ...runEnv, TZ: 'UTC' };
  const browser = {
    ...common,
    P11_STRIPE_PROFILE: PROFILE,
    AccountOnlineContribution__SettlementCurrency: accepted.currency,
  };
  for (const name of Object.keys(browser)) {
    if (/stripe/i.test(name) && name !== 'P11_STRIPE_PROFILE') delete browser[name];
    if (/signingsecret/i.test(name)) delete browser[name];
  }
  if (artifactDirectory !== undefined) {
    browser.P11_STRIPE_ARTIFACT_DIR = artifactDirectory;
    browser.P11_STRIPE_EVIDENCE_ROOT = path.dirname(path.dirname(artifactDirectory));
  }
  return browser;
}

/** All run identity checks still execute on the original provider-disabled environment. */
function buildStripeProcessEnvironments(runEnv, systemEnv, profile, signingSecret) {
  const identity = validateP11LocalIdentity(runEnv);
  const accepted = validateStripeProfile(profile);
  if (
    typeof signingSecret !== 'string' || // pragma: allowlist secret -- Public signing field type check
    !/^whsec_[A-Za-z0-9]{16,}$/.test(signingSecret) // pragma: allowlist secret -- Public signing format
  )
    refuse('the test listener signing secret is missing.');
  const system = systemEnvironment(systemEnv);
  const common = { ...system, ...runEnv, TZ: 'UTC' };
  const api = {
    ...common,
    Stripe__Enabled: 'true',
    Stripe__PlatformApiKey: accepted.apiKey,
    Stripe__ConnectedAccountId: accepted.connectedAccountId,
    AccountCheckoutWebhook__SigningSecret: signingSecret,
    AccountOnlineContribution__SettlementCurrency: accepted.currency,
    Localization__Currency: accepted.currency,
    EmailSettings__FrontendBaseUrl: runEnv.E2E_BASE_URL,
    Modules__Enforce: 'true',
    Modules__Enabled: TEST_MODULES,
  };
  const browser = buildStripeBrowserEnvironment(runEnv, systemEnv, accepted);
  const listener = buildStripeListenerEnvironment(systemEnv, accepted);
  return { identity, api, browser, listener };
}

function validateStripeBrowserEnvironment(env, evidenceRoot = env.P11_STRIPE_EVIDENCE_ROOT) {
  if (env.P11_STRIPE_PROFILE !== PROFILE) refuse('the browser was not launched by the dedicated profile.');
  if (!env.P11_STRIPE_ARTIFACT_DIR) refuse('the browser artifact directory is missing.');
  const offline = { ...env };
  delete offline.P11_STRIPE_PROFILE;
  delete offline.P11_STRIPE_ARTIFACT_DIR;
  delete offline.P11_STRIPE_EVIDENCE_ROOT;
  const identity = validateP11LocalIdentity(offline);
  if (typeof evidenceRoot !== 'string' || !path.isAbsolute(evidenceRoot))
    refuse('an absolute private evidence root is required.');
  if (env.P11_STRIPE_EVIDENCE_ROOT && path.resolve(env.P11_STRIPE_EVIDENCE_ROOT) !== path.resolve(evidenceRoot))
    refuse('the browser evidence root does not match its private run identity.');
  resolvePrivateStripeBrowserArtifactDirectory(evidenceRoot, identity.runId, env.P11_STRIPE_ARTIFACT_DIR);
  if (
    Object.entries(env).some(
      ([name]) =>
        !['P11_STRIPE_PROFILE', 'P11_STRIPE_ARTIFACT_DIR', 'P11_STRIPE_EVIDENCE_ROOT'].includes(name) &&
        (/stripe/i.test(name) || /signingsecret/i.test(name)),
    )
  )
    refuse('provider secrets reached the browser environment.');
  if (env.AccountOnlineContribution__SettlementCurrency !== 'CHF')
    refuse('browser currency disagrees with this profile.');
  return identity;
}

module.exports = {
  PROFILE,
  API_FIELDS,
  systemEnvironment,
  readStripeProfile,
  validateStripeProfile,
  buildStripeListenerEnvironment,
  buildStripeBrowserEnvironment,
  buildStripeProcessEnvironments,
  assertPrivateDirectory,
  ensurePrivateArtifactDirectories,
  writePrivateEvidenceFile,
  resolvePrivateStripeBrowserArtifactDirectory,
  writePrivateStripeBrowserEvidence,
  writePrivateStripeBrowserSnapshot,
  validateStripeBrowserEnvironment,
};
