/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  PROFILE,
  readStripeProfile,
  validateStripeProfile,
  buildStripeBrowserEnvironment,
  buildStripeProcessEnvironments,
  ensurePrivateArtifactDirectories,
  resolvePrivateStripeBrowserArtifactDirectory,
  writePrivateStripeBrowserEvidence,
  writePrivateStripeBrowserSnapshot,
  systemEnvironment,
  validateStripeBrowserEnvironment,
} = require('./e2e-p11-stripe-profile.cjs');
const { validateP11LocalIdentity } = require('./e2e-p11-target.cjs');

const profile = Object.freeze({
  profile: PROFILE,
  apiKey: `sk_test_${'a1'.repeat(16)}`,
  connectedAccountId: `acct_${'b2'.repeat(8)}`,
  currency: 'CHF',
});
const signingSecret = `whsec_${'c3'.repeat(16)}`;

function localTarget() {
  const runId = '1234567890abcdef'; // pragma: allowlist secret -- Synthetic run identifier
  const db = `p11_${runId}`;
  const password = 'd'.repeat(64);
  const jwt = `table-account-p11-${runId}`;
  const env = {
    P11_RUN_ID: runId,
    P11_COMPOSE_PROJECT: `tableaccountp11-${runId}`,
    P11_DATABASE_NAME: db,
    P11_DATABASE_USER: db,
    P11_REDIS_PORT: '55002',
    P11_API_PORT: '55003',
    P11_UI_PORT: '55004',
    P11_PRINTER_API_KEY: 'e'.repeat(64),
    P11_QR_CODE_SECRET: 'f'.repeat(64),
    E2E_DATABASE_TARGET: 'disposable',
    E2E_DATABASE_URL: `postgres://${db}:${password}@127.0.0.1:55001/${db}`,
    E2E_API_BASE_URL: 'http://127.0.0.1:55003',
    E2E_BASE_URL: 'http://127.0.0.1:55004',
    ConnectionStrings__restaurantdb: `Host=127.0.0.1;Port=55001;Database=${db};Username=${db};Password=${password};SSL Mode=Disable`,
    ConnectionStrings__redis: '127.0.0.1:55002',
    ASPNETCORE_ENVIRONMENT: 'Development',
    DOTNET_ENVIRONMENT: 'Development',
    SENTRY_DSN: '',
    JwtSettings__Secret: 'a'.repeat(64),
    JwtSettings__Issuer: jwt,
    JwtSettings__Audience: jwt,
    JwtSettings__TenantSlug: `p11-${runId}`,
    PrinterSettings__ApiKey: 'e'.repeat(64),
    QRCode__SecretKey: 'f'.repeat(64),
  };
  for (const feature of [
    'ServerWorkspaceV2',
    'TableAccountV1',
    'OrderAmendmentsV1',
    'TableGuestVisitsV1',
    'TableVisitReadinessV1',
    'TableAccountPaymentsV1',
    'TableGuestAccountPaymentsV1',
    'ServerAccountCollectionV1',
  ])
    env[`TenantFeatures__${feature}`] = 'true';
  return env;
}

test('requires a closed full-test-key profile with the fixture currency', () => {
  assert.deepEqual(validateStripeProfile(profile), profile);
  for (const changed of [
    { ...profile, apiKey: profile.apiKey.replace('sk_test_', 'sk_live_') },
    { ...profile, apiKey: profile.apiKey.replace('sk_test_', 'rk_test_') },
    { ...profile, currency: 'EUR' },
    { ...profile, profile: 'general-p11' },
    { ...profile, liveMode: false },
    { ...profile, connectedAccountId: '../different-account' },
  ])
    assert.throws(() => validateStripeProfile(changed), /P11 Stripe profile refused/);
  assert.throws(() => validateStripeProfile(null), /invalid profile/);
});

test('only reads small private regular P11 test profile files', () => {
  const dir = fs.mkdtempSync(path.join('/tmp', 'p11-stripe-guard-'));
  const file = path.join(dir, `table-account-p11-stripe-profile-${'a'.repeat(32)}.json`);
  const link = path.join(dir, 'linked.json');
  try {
    fs.writeFileSync(file, JSON.stringify(profile), { mode: 0o600 });
    assert.deepEqual(readStripeProfile(file), profile);
    fs.chmodSync(file, 0o644);
    assert.throws(() => readStripeProfile(file), /mode-0600/);
    fs.chmodSync(file, 0o600);
    fs.symlinkSync(file, link);
    assert.throws(() => readStripeProfile(link));
    fs.writeFileSync(file, JSON.stringify({ ...profile, apiKey: 'sk_live_DO_NOT_DISPLAY_THIS' })); // pragma: allowlist secret -- Synthetic rejected live-key marker
    assert.throws(
      () => readStripeProfile(file),
      (error) => !error.message.includes('DO_NOT_DISPLAY_THIS'),
    );
    fs.writeFileSync(file, ' '.repeat(4097));
    assert.throws(() => readStripeProfile(file), /small mode-0600/);
    assert.throws(() => readStripeProfile('relative.env.production'), /absolute profile/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('isolates API and listener secrets from Playwright and ignores ambient provider settings', () => {
  const processes = buildStripeProcessEnvironments(
    localTarget(),
    {
      PATH: '/usr/bin',
      STRIPE_API_KEY: 'sk_live_unrelated', // pragma: allowlist secret -- Synthetic ambient value
      ANTHROPIC_API_KEY: 'unrelated-secret', // pragma: allowlist secret -- Synthetic ambient value
      AccountCheckoutWebhook__SigningSecret: 'unrelated-secret', // pragma: allowlist secret -- Synthetic ambient value
    },
    profile,
    signingSecret,
  );
  assert.equal(processes.api.Stripe__PlatformApiKey, profile.apiKey);
  assert.equal(processes.api.Stripe__ConnectedAccountId, profile.connectedAccountId);
  assert.equal(processes.api.AccountCheckoutWebhook__SigningSecret, signingSecret);
  assert.equal(processes.api.Modules__Enforce, 'true');
  assert.ok(processes.api.Modules__Enabled.split(',').includes('online-payments'));
  assert.deepEqual(processes.listener, { PATH: '/usr/bin', STRIPE_API_KEY: profile.apiKey });
  assert.equal(processes.browser.P11_STRIPE_PROFILE, PROFILE);
  assert.throws(() => validateStripeBrowserEnvironment(processes.browser), /artifact directory/);
  const browserValues = JSON.stringify(processes.browser);
  for (const secret of [profile.apiKey, signingSecret, 'sk_live_unrelated', 'unrelated-secret'])
    assert.ok(!browserValues.includes(secret));
  assert.equal(processes.api.ANTHROPIC_API_KEY, undefined);
  assert.equal(processes.browser.ANTHROPIC_API_KEY, undefined);
});

test('allows only the exact private run-owned Playwright artifact directory', () => {
  const root = fs.mkdtempSync(path.join('/tmp', 'p11-stripe-artifacts-'));
  try {
    const target = localTarget();
    const directories = ensurePrivateArtifactDirectories('1234567890abcdef', root); // pragma: allowlist secret -- Synthetic run identifier
    const browser = buildStripeBrowserEnvironment(target, {}, profile, directories.browserDir);
    assert.equal(browser.P11_STRIPE_EVIDENCE_ROOT, root);
    assert.equal(validateStripeBrowserEnvironment(browser, root).runId, '1234567890abcdef'); // pragma: allowlist secret -- Synthetic run identifier
    assert.throws(
      () =>
        validateStripeBrowserEnvironment({ ...browser, P11_STRIPE_ARTIFACT_DIR: path.join(root, 'elsewhere') }, root),
      /does not match its private run identity/,
    );
    assert.throws(
      () =>
        validateStripeBrowserEnvironment({ ...browser, P11_STRIPE_EVIDENCE_ROOT: path.join(root, 'elsewhere') }, root),
      /evidence root does not match/,
    );
    fs.chmodSync(directories.browserDir, 0o755);
    assert.throws(() => validateStripeBrowserEnvironment(browser, root), /mode-0700/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('writes browser evidence under a private non-temp run root and rejects outside paths', () => {
  const root = fs.mkdtempSync(path.join(os.homedir(), '.p11-stripe-evidence-root-'));
  const outsideRoot = fs.mkdtempSync(path.join(os.homedir(), '.p11-stripe-evidence-outside-'));
  const runId = '1234567890abcdef'; // pragma: allowlist secret -- Synthetic run identifier
  try {
    const relativeToTemp = path.relative(path.resolve(os.tmpdir()), root);
    assert.ok(relativeToTemp.startsWith('..'));
    const directories = ensurePrivateArtifactDirectories(runId, root);
    assert.equal(
      resolvePrivateStripeBrowserArtifactDirectory(root, runId, directories.browserDir),
      directories.browserDir,
    );
    const identity = { evidenceRoot: root, runId, artifactDirectory: directories.browserDir };
    writePrivateStripeBrowserEvidence(identity, 'diagnostic.json', '{"safe":true}');
    const proofPath = path.join(directories.browserDir, 'diagnostic.json');
    const proofStat = fs.statSync(proofPath);
    assert.ok(proofStat.isFile());
    assert.equal(proofStat.uid, process.getuid());
    assert.equal(proofStat.mode & 0o777, 0o600);
    assert.equal(fs.readFileSync(proofPath, 'utf8'), '{"safe":true}');
    assert.throws(() => writePrivateStripeBrowserEvidence(identity, 'diagnostic.json', '{"changed":true}'));
    assert.equal(fs.readFileSync(proofPath, 'utf8'), '{"safe":true}');
    assert.throws(() => writePrivateStripeBrowserEvidence(identity, 'captured-attempts.json', '{"unsafe":true}'));
    assert.throws(() => writePrivateStripeBrowserSnapshot(identity, 'diagnostic.json', '{"unsafe":true}'));

    writePrivateStripeBrowserSnapshot(identity, 'captured-attempts.json', '{"snapshot":1}');
    writePrivateStripeBrowserSnapshot(identity, 'captured-attempts.json', '{"snapshot":2}');
    writePrivateStripeBrowserSnapshot(identity, 'refunded-attempts.json', '{"refundSnapshot":1}');
    writePrivateStripeBrowserSnapshot(identity, 'refunded-attempts.json', '{"refundSnapshot":2}');
    const snapshotPath = path.join(directories.browserDir, 'captured-attempts.json');
    assert.equal(fs.readFileSync(snapshotPath, 'utf8'), '{"snapshot":2}');
    assert.equal(fs.statSync(snapshotPath).uid, process.getuid());
    assert.equal(fs.statSync(snapshotPath).mode & 0o777, 0o600);
    const refundSnapshotPath = path.join(directories.browserDir, 'refunded-attempts.json');
    assert.equal(fs.readFileSync(refundSnapshotPath, 'utf8'), '{"refundSnapshot":2}');
    assert.equal(fs.statSync(refundSnapshotPath).uid, process.getuid());
    assert.equal(fs.statSync(refundSnapshotPath).mode & 0o777, 0o600);

    fs.rmSync(refundSnapshotPath);
    fs.symlinkSync(proofPath, refundSnapshotPath);
    assert.throws(
      () => writePrivateStripeBrowserSnapshot(identity, 'refunded-attempts.json', '{"snapshot":3}'),
      /existing snapshots must be same-user mode-0600 regular files/,
    );
    assert.ok(fs.lstatSync(refundSnapshotPath).isSymbolicLink());
    assert.equal(fs.readFileSync(proofPath, 'utf8'), '{"safe":true}');

    fs.rmSync(refundSnapshotPath);
    fs.writeFileSync(refundSnapshotPath, '{"mode":"preserve"}', { mode: 0o600 });
    fs.chmodSync(refundSnapshotPath, 0o644);
    assert.throws(
      () => writePrivateStripeBrowserSnapshot(identity, 'refunded-attempts.json', '{"mode":"replace"}'),
      /existing snapshots must be same-user mode-0600 regular files/,
    );
    assert.equal(fs.readFileSync(refundSnapshotPath, 'utf8'), '{"mode":"preserve"}');
    assert.equal(fs.statSync(refundSnapshotPath).mode & 0o777, 0o644);

    fs.chmodSync(refundSnapshotPath, 0o600);
    fs.writeFileSync(refundSnapshotPath, '{"owner":"preserve"}', { mode: 0o600 });
    const originalOwnerOpenSync = fs.openSync;
    const originalFstatSync = fs.fstatSync;
    let targetDescriptor;
    try {
      fs.openSync = function (filename, ...args) {
        const descriptor = Reflect.apply(originalOwnerOpenSync, fs, [filename, ...args]);
        if (filename === refundSnapshotPath) targetDescriptor = descriptor;
        return descriptor;
      };
      fs.fstatSync = function (descriptor, ...args) {
        const stat = Reflect.apply(originalFstatSync, fs, [descriptor, ...args]);
        if (descriptor !== targetDescriptor) return stat;
        return {
          isFile: () => stat.isFile(),
          uid: stat.uid + 1,
          mode: stat.mode,
          nlink: stat.nlink,
          dev: stat.dev,
          ino: stat.ino,
        };
      };
      assert.throws(
        () => writePrivateStripeBrowserSnapshot(identity, 'refunded-attempts.json', '{"owner":"replace"}'),
        /existing snapshots must be same-user mode-0600 regular files/,
      );
    } finally {
      fs.openSync = originalOwnerOpenSync;
      fs.fstatSync = originalFstatSync;
    }
    assert.equal(fs.readFileSync(refundSnapshotPath, 'utf8'), '{"owner":"preserve"}');

    fs.rmSync(refundSnapshotPath);
    fs.mkdirSync(refundSnapshotPath);
    const markerPath = path.join(refundSnapshotPath, 'marker');
    fs.writeFileSync(markerPath, 'directory-preserved', { mode: 0o600 });
    assert.throws(
      () => writePrivateStripeBrowserSnapshot(identity, 'refunded-attempts.json', '{"directory":"replace"}'),
      /existing snapshots must be same-user mode-0600 regular files/,
    );
    assert.equal(fs.readFileSync(markerPath, 'utf8'), 'directory-preserved');

    assert.throws(
      () =>
        writePrivateStripeBrowserSnapshot(
          { ...identity, artifactDirectory: path.join(outsideRoot, runId, 'browser') },
          'captured-attempts.json',
          '{"snapshot":"outside"}',
        ),
      /does not match its private run identity/,
    );
    assert.equal(fs.readFileSync(snapshotPath, 'utf8'), '{"snapshot":2}');
    const beforeFailedWrite = fs.readdirSync(directories.browserDir).sort();
    const originalWriteFileSync = fs.writeFileSync;
    try {
      fs.writeFileSync = function (file, ...args) {
        if (typeof file === 'number') throw new Error('controlled temp write failure');
        return Reflect.apply(originalWriteFileSync, fs, [file, ...args]);
      };
      assert.throws(
        () => writePrivateStripeBrowserSnapshot(identity, 'captured-attempts.json', '{"snapshot":"failed"}'),
        /private snapshot could not be replaced safely/,
      );
    } finally {
      fs.writeFileSync = originalWriteFileSync;
    }
    assert.deepEqual(fs.readdirSync(directories.browserDir).sort(), beforeFailedWrite);
    assert.equal(fs.readFileSync(snapshotPath, 'utf8'), '{"snapshot":2}');

    const originalExclusiveOpenSync = fs.openSync;
    let preexistingTemporaryPath;
    try {
      fs.openSync = function (filename, ...args) {
        const [flags] = args;
        if (
          typeof filename === 'string' &&
          path.dirname(filename) === directories.browserDir &&
          path.basename(filename).startsWith('.captured-attempts.json.') &&
          path.extname(filename) === '.tmp' &&
          (flags & fs.constants.O_EXCL) !== 0
        ) {
          const descriptor = Reflect.apply(originalExclusiveOpenSync, fs, [filename, ...args]);
          fs.writeFileSync(descriptor, 'preexisting-temp-sentinel');
          fs.closeSync(descriptor);
          preexistingTemporaryPath = filename;
          const error = new Error('controlled exclusive-create collision');
          error.code = 'EEXIST';
          throw error;
        }
        return Reflect.apply(originalExclusiveOpenSync, fs, [filename, ...args]);
      };
      assert.throws(
        () => writePrivateStripeBrowserSnapshot(identity, 'captured-attempts.json', '{"snapshot":"collision"}'),
        /private snapshot could not be replaced safely/,
      );
    } finally {
      fs.openSync = originalExclusiveOpenSync;
    }
    assert.ok(preexistingTemporaryPath);
    assert.equal(fs.readFileSync(preexistingTemporaryPath, 'utf8'), 'preexisting-temp-sentinel');
    assert.equal(fs.readFileSync(snapshotPath, 'utf8'), '{"snapshot":2}');
    assert.throws(
      () => resolvePrivateStripeBrowserArtifactDirectory(root, runId, path.join(outsideRoot, runId, 'browser')),
      /does not match its private run identity/,
    );
    assert.throws(
      () => resolvePrivateStripeBrowserArtifactDirectory(root, '0000000000000000', directories.browserDir),
      /does not match its private run identity/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  }
});

test('refuses a symlink at the browser artifact path and inherited Docker endpoint overrides', () => {
  const root = fs.mkdtempSync(path.join('/tmp', 'p11-stripe-artifact-link-'));
  const other = fs.mkdtempSync(path.join('/tmp', 'p11-stripe-artifact-target-'));
  const rootLink = path.join('/tmp', `p11-stripe-artifact-root-link-${process.pid}`);
  try {
    fs.symlinkSync(other, rootLink);
    assert.throws(() => ensurePrivateArtifactDirectories('1234567890abcdef', rootLink), /must not be links/); // pragma: allowlist secret -- Synthetic run identifier
    const processes = buildStripeProcessEnvironments(localTarget(), {}, profile, signingSecret);
    const directories = ensurePrivateArtifactDirectories('1234567890abcdef', root); // pragma: allowlist secret -- Synthetic run identifier
    fs.rmSync(directories.browserDir, { recursive: true });
    fs.symlinkSync(other, directories.browserDir);
    const browser = { ...processes.browser, P11_STRIPE_ARTIFACT_DIR: directories.browserDir };
    assert.throws(() => validateStripeBrowserEnvironment(browser, root), /must not be links/);
    assert.throws(
      () => systemEnvironment({ PATH: '/usr/bin', DOCKER_HOST: 'tcp://remote.invalid:2376' }),
      /Docker endpoint overrides/,
    );
    assert.throws(() => systemEnvironment({ PATH: '/usr/bin', DOCKER_CONTEXT: 'remote' }), /Docker endpoint overrides/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(other, { recursive: true, force: true });
    fs.rmSync(rootLink, { force: true });
  }
});

test('dedicated profile still rejects non-disposable and drifting API identities', () => {
  const remote = localTarget();
  remote.E2E_API_BASE_URL = 'https://staging.example.invalid';
  assert.throws(() => buildStripeProcessEnvironments(remote, {}, profile, signingSecret), /loopback/);
  const drift = localTarget();
  drift.ConnectionStrings__restaurantdb = drift.ConnectionStrings__restaurantdb.replace('55001', '55006');
  assert.throws(() => buildStripeProcessEnvironments(drift, {}, profile, signingSecret), /derived DB endpoint/);
  assert.throws(() => buildStripeProcessEnvironments(localTarget(), {}, profile, 'whsec_short'), /signing secret/);
});

test('browser rejects leaked credentials and the original offline guard remains closed', () => {
  const { browser, api } = buildStripeProcessEnvironments(localTarget(), {}, profile, signingSecret);
  const root = fs.mkdtempSync(path.join('/tmp', 'p11-stripe-browser-negative-'));
  try {
    const directories = ensurePrivateArtifactDirectories('1234567890abcdef', root); // pragma: allowlist secret -- Synthetic run identifier
    const validBrowser = { ...browser, P11_STRIPE_ARTIFACT_DIR: directories.browserDir };
    assert.throws(
      () => validateStripeBrowserEnvironment({ ...validBrowser, STRIPE_SECRET_KEY: profile.apiKey }, root),
      /provider credentials|secrets reached/,
    );
    assert.throws(
      () => validateStripeBrowserEnvironment({ ...validBrowser, STRIPE_SECRET_KEY: '' }, root),
      /provider credentials|secrets reached/,
    );
    assert.throws(
      () =>
        validateStripeBrowserEnvironment(
          { ...validBrowser, AccountCheckoutWebhook__SigningSecret: signingSecret },
          root,
        ),
      /secrets reached/,
    );
    assert.throws(
      () =>
        validateStripeBrowserEnvironment(
          { ...validBrowser, AccountOnlineContribution__SettlementCurrency: 'EUR' },
          root,
        ),
      /currency/,
    );
    assert.throws(() => validateP11LocalIdentity(api), /provider credentials/);
    assert.throws(() => validateP11LocalIdentity(browser), /provider credentials/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
