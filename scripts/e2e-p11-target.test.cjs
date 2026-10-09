/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createRunOwnedStaffCredential,
  validateInheritedP11Environment,
  validateP11LocalIdentity,
  validateP11ArtifactDirectory,
} = require('./e2e-p11-target.cjs');

const runId = '0123456789abcdef';
const databasePort = '55001';
const redisPort = '55002';
const apiPort = '55003';
const uiPort = '55004';
const password = 'a'.repeat(64);
const printerApiKey = 'b'.repeat(64);
const qrCodeSecret = 'c'.repeat(64);
const jwtSigningSecret = 'd'.repeat(64);
const jwtIdentity = `table-account-p11-${runId}`;

function validTarget() {
  return {
    P11_RUN_ID: runId,
    P11_COMPOSE_PROJECT: `tableaccountp11-${runId}`,
    P11_DATABASE_NAME: `p11_${runId}`,
    P11_DATABASE_USER: `p11_${runId}`,
    P11_DATABASE_PORT: databasePort,
    P11_REDIS_PORT: redisPort,
    P11_API_PORT: apiPort,
    P11_UI_PORT: uiPort,
    P11_PRINTER_API_KEY: printerApiKey,
    P11_QR_CODE_SECRET: qrCodeSecret,
    E2E_DATABASE_TARGET: 'disposable',
    E2E_DATABASE_URL: `postgres://p11_${runId}:${password}@127.0.0.1:${databasePort}/p11_${runId}`,
    E2E_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
    E2E_BASE_URL: `http://127.0.0.1:${uiPort}`,
    ASPNETCORE_ENVIRONMENT: 'Development',
    DOTNET_ENVIRONMENT: 'Development',
    SENTRY_DSN: '',
    JwtSettings__Secret: jwtSigningSecret,
    JwtSettings__Issuer: jwtIdentity,
    JwtSettings__Audience: jwtIdentity,
    JwtSettings__TenantSlug: `p11-${runId}`,
    ConnectionStrings__restaurantdb: `Host=127.0.0.1;Port=${databasePort};Database=p11_${runId};Username=p11_${runId};Password=${password};SSL Mode=Disable`,
    ConnectionStrings__redis: `127.0.0.1:${redisPort}`,
    PrinterSettings__ApiKey: printerApiKey,
    QRCode__SecretKey: qrCodeSecret,
    TenantFeatures__ServerWorkspaceV2: 'true',
    TenantFeatures__TableAccountV1: 'true',
    TenantFeatures__OrderAmendmentsV1: 'true',
    TenantFeatures__TableGuestVisitsV1: 'true',
    TenantFeatures__TableVisitReadinessV1: 'true',
    TenantFeatures__TableAccountPaymentsV1: 'true',
    TenantFeatures__TableGuestAccountPaymentsV1: 'true',
    TenantFeatures__ServerAccountCollectionV1: 'true',
  };
}

test('accepts one isolated loopback identity shared by the existing DB guard and backend', () => {
  assert.deepEqual(validateP11LocalIdentity(validTarget()), {
    runId,
    databaseName: `p11_${runId}`,
    databasePort,
    apiPort,
    uiPort,
  });
});

test('Playwright artifacts must be a private directory under the active run state', (t) => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'p11-artifact-control-'));
  fs.chmodSync(state, 0o700);
  const artifact = path.join(state, 'playwright');
  fs.mkdirSync(artifact, { mode: 0o700 });
  t.after(() => fs.rmSync(state, { recursive: true, force: true }));

  assert.equal(validateP11ArtifactDirectory(artifact, state, runId), artifact);
  assert.throws(() => validateP11ArtifactDirectory(path.join(state, 'other'), state, runId), /private run state/);
  fs.chmodSync(artifact, 0o755);
  assert.throws(() => validateP11ArtifactDirectory(artifact, state, runId), /mode-0700/);
});

test('generated runner settings round-trip through the private JSON environment format', (t) => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'p11-runner-env-control-'));
  fs.chmodSync(state, 0o700);
  t.after(() => fs.rmSync(state, { recursive: true, force: true }));
  const helper = path.resolve('scripts/e2e-p11-target.cjs');
  const env = Object.fromEntries(
    ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG'].flatMap((name) =>
      process.env[name] ? [[name, process.env[name]]] : [],
    ),
  );

  execFileSync(process.execPath, [helper, 'init', state], { env, stdio: 'ignore' });
  execFileSync(process.execPath, [helper, 'configure', state, databasePort, redisPort], { env, stdio: 'ignore' });
  const runnerFile = path.join(state, 'runner.env');
  const runner = Object.fromEntries(
    fs
      .readFileSync(runnerFile, 'utf8')
      .trim()
      .split('\n')
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), JSON.parse(line.slice(separator + 1))];
      }),
  );
  assert.equal(fs.statSync(runnerFile).mode & 0o777, 0o600);
  assert.equal(runner.P11_RUN_ID.length, 16);
  assert.match(runner.E2E_DATABASE_URL, /^postgres:\/\/p11_[a-f0-9]{16}:/);
  assert.match(runner.ConnectionStrings__restaurantdb, /;SSL Mode=Disable$/);
});

test('requires both .NET environment selectors to pin Development and clears Sentry', () => {
  const dotnetEnvironment = validTarget();
  dotnetEnvironment.DOTNET_ENVIRONMENT = 'Production';
  assert.throws(() => validateP11LocalIdentity(dotnetEnvironment), /DOTNET_ENVIRONMENT.*Development/i);

  const aspnetEnvironment = validTarget();
  aspnetEnvironment.ASPNETCORE_ENVIRONMENT = 'Production';
  assert.throws(() => validateP11LocalIdentity(aspnetEnvironment), /ASPNETCORE_ENVIRONMENT.*Development/i);

  const sentry = validTarget();
  sentry.SENTRY_DSN = 'https://sentry.example.invalid/123';
  assert.throws(() => validateP11LocalIdentity(sentry), /SENTRY_DSN must be empty/i);
});

test('rejects inherited production environment and Sentry configuration before setup', () => {
  assert.throws(
    () => validateInheritedP11Environment({ DOTNET_ENVIRONMENT: 'Production' }),
    /inherited DOTNET_ENVIRONMENT/i,
  );
  assert.throws(
    () => validateInheritedP11Environment({ SENTRY_DSN: 'https://sentry.example.invalid/123' }),
    /inherited SENTRY_DSN/i,
  );
  assert.doesNotThrow(() => validateInheritedP11Environment({ ASPNETCORE_ENVIRONMENT: 'Development' }));
});

test('rejects inherited JWT identity so a host key cannot enter the local API', () => {
  assert.throws(
    () => validateInheritedP11Environment({ JWTSETTINGS__SECRET: jwtSigningSecret }),
    /inherited JWT identity configuration/i,
  );
  assert.throws(
    () => validateInheritedP11Environment({ JwtSettings__Issuer: jwtIdentity }),
    /inherited JWT identity configuration/i,
  );
});

test('generates unique credentials that satisfy the backend Identity password rules', () => {
  const candidates = ['a'.repeat(64), 'a0c1e2b4'.repeat(8)];
  let candidateAttempts = 0;
  const credential = createRunOwnedStaffCredential(() => candidates[candidateAttempts++]);

  assert.equal(candidateAttempts, 2);
  assert.equal(credential.length, 68);
  assert.match(credential, /[A-Z]/);
  assert.match(credential, /[a-z]/);
  assert.match(credential, /[0-9]/);
  assert.match(credential, /[^a-zA-Z0-9]/);
  assert.ok(new Set(credential).size >= 4);
  assert.doesNotMatch(credential, /(.)\1{2,}/);
  assert.equal(
    [
      'password',
      '123456',
      '12345678',
      'qwerty',
      'admin',
      'welcome',
      'letmein',
      'trustno1',
      'password123',
      'admin123',
    ].includes(credential.toLowerCase()),
    false,
  );

  const duplicateCandidate = 'a0c1e2b4'.repeat(8);
  let duplicateAttempts = 0;
  assert.throws(
    () =>
      createRunOwnedStaffCredential(() => {
        duplicateAttempts += 1;
        return duplicateCandidate;
      }),
    /unique staff credential/i,
  );
  assert.equal(duplicateAttempts, 8);

  const generatedSamples = [createRunOwnedStaffCredential(), createRunOwnedStaffCredential()];
  assert.equal(new Set(generatedSamples).size, 2);
  for (const sample of generatedSamples) {
    assert.equal(sample.length, 68);
    assert.match(sample, /[A-Z]/);
    assert.match(sample, /[a-z]/);
    assert.match(sample, /[0-9]/);
    assert.match(sample, /[^a-zA-Z0-9]/);
    assert.ok(new Set(sample).size >= 4);
    assert.doesNotMatch(sample, /(.)\1{2,}/);
  }
});

test('the backend repeat-pattern oracle distinguishes an invalid triple', () => {
  const backendPattern = /(.)\1{2,}/;
  assert.equal(backendPattern.test('aaa'), true);
  assert.equal(backendPattern.test('aab'), false);
});

test('requires a generated JWT key and exact run-scoped issuer, audience, and tenant slug', () => {
  const missingSecret = validTarget();
  delete missingSecret.JwtSettings__Secret;
  assert.throws(() => validateP11LocalIdentity(missingSecret), /JWT signing key/i);

  const shortSecret = validTarget();
  shortSecret.JwtSettings__Secret = 'd'.repeat(62);
  assert.throws(() => validateP11LocalIdentity(shortSecret), /JWT signing key/i);

  const wrongIssuer = validTarget();
  wrongIssuer.JwtSettings__Issuer = 'table-account-p11-other-run';
  assert.throws(() => validateP11LocalIdentity(wrongIssuer), /JWT signing key/i);

  const wrongAudience = validTarget();
  wrongAudience.JwtSettings__Audience = 'table-account-p11-other-run';
  assert.throws(() => validateP11LocalIdentity(wrongAudience), /JWT signing key/i);

  const wrongTenant = validTarget();
  wrongTenant.JwtSettings__TenantSlug = 'p11-other-run';
  assert.throws(() => validateP11LocalIdentity(wrongTenant), /JWT signing key/i);
});

test('rejects a remote database even when marked disposable', () => {
  const target = validTarget();
  target.E2E_DATABASE_URL = target.E2E_DATABASE_URL.replace('127.0.0.1', 'db.example.invalid');
  target.ConnectionStrings__restaurantdb = target.ConnectionStrings__restaurantdb.replace(
    '127.0.0.1',
    'db.example.invalid',
  );
  assert.throws(() => validateP11LocalIdentity(target), /loopback|disposable/i);
});

test('rejects backend DB drift from the guarded E2E endpoint', () => {
  const target = validTarget();
  target.ConnectionStrings__restaurantdb = target.ConnectionStrings__restaurantdb.replace(databasePort, '55005');
  assert.throws(() => validateP11LocalIdentity(target), /share one derived DB endpoint/i);
});

test('rejects non-loopback UI/API origins and shared low ports', () => {
  const remoteApi = validTarget();
  remoteApi.E2E_API_BASE_URL = 'https://staging.example.invalid';
  assert.throws(() => validateP11LocalIdentity(remoteApi), /loopback/i);

  const sharedPort = validTarget();
  sharedPort.E2E_BASE_URL = 'http://127.0.0.1:3000';
  sharedPort.P11_UI_PORT = '3000';
  assert.throws(() => validateP11LocalIdentity(sharedPort), /high loopback port/i);

  const apiPath = validTarget();
  apiPath.E2E_API_BASE_URL = `http://127.0.0.1:${apiPort}/staging`;
  assert.throws(() => validateP11LocalIdentity(apiPath), /loopback origin/i);
});

test('rejects evidence keys that differ from the local API configuration', () => {
  const printerKey = validTarget();
  printerKey.PrinterSettings__ApiKey = 'd'.repeat(64);
  assert.throws(() => validateP11LocalIdentity(printerKey), /printer-feed evidence key/i);

  const qrSecret = validTarget();
  qrSecret.QRCode__SecretKey = 'd'.repeat(64);
  assert.throws(() => validateP11LocalIdentity(qrSecret), /QR signing key/i);
});

test('rejects inherited staging acknowledgements and provider settings', () => {
  const staging = validTarget();
  staging.E2E_ALLOW_STAGING_DATABASE_WRITES = 'YES';
  assert.throws(() => validateP11LocalIdentity(staging), /staging write acknowledgements/i);

  const provider = validTarget();
  provider.StripeSettings__Mode = 'test';
  assert.throws(() => validateP11LocalIdentity(provider), /provider credentials/i);
});
