/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { validateE2EDatabaseTarget } = require('./e2e-database-target.cjs');

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);
const EPHEMERAL_PORT_FLOOR = 49152;
const STAFF_CREDENTIAL_SUFFIX = '!aA7';
const MAX_STAFF_CREDENTIAL_ATTEMPTS = 8;
// Matches StrongPasswordValidator; its current sequence-check implementation is a no-op.
const REPEATING_CHARACTER_PATTERN = /(.)\1{2,}/;
const COMMON_PASSWORDS = new Set([
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
]);
const issuedStaffCredentials = new Set();

function fail(message) {
  throw new Error(`P11 local target refused: ${message}`);
}

function envFileValue(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function writeEnvFile(filePath, values) {
  const body = Object.entries(values)
    .map(([key, value]) => `${key}=${envFileValue(value)}`)
    .join('\n');
  fs.writeFileSync(filePath, `${body}\n`, { mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}

async function allocateEphemeralPort() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const server = net.createServer();
    const port = await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          reject(new Error('Could not resolve a loopback port.'));
          return;
        }
        resolve(address.port);
      });
    });
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (port >= EPHEMERAL_PORT_FLOOR) return String(port);
  }
  fail('the OS did not provide a high loopback port.');
}

async function assertLoopbackPortAvailable(port, name) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', () => reject(new Error(`P11 local target refused: ${name} port is already in use.`)));
    server.listen(Number(port), '127.0.0.1', resolve);
  });
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function init(stateDir) {
  validateInheritedP11Environment();
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(stateDir, 0o700);
  const runId = crypto.randomBytes(8).toString('hex');
  const project = `tableaccountp11-${runId}`;
  const values = {
    P11_RUN_ID: runId,
    P11_COMPOSE_PROJECT: project,
    P11_DATABASE_NAME: `p11_${runId}`,
    P11_DATABASE_USER: `p11_${runId}`,
    P11_DATABASE_PASSWORD: crypto.randomBytes(32).toString('hex'),
  };
  writeEnvFile(path.join(stateDir, 'compose.env'), values);
  process.stdout.write('P11 isolated stack identity created. Credentials are stored in a mode-0600 temporary file.\n');
}

function parseComposeConnectionString(raw) {
  if (typeof raw !== 'string' || !raw) fail('the backend database connection string is missing.');
  const result = new Map();
  for (const part of raw.split(';')) {
    if (!part.trim()) continue;
    const separator = part.indexOf('=');
    if (separator < 1) fail('the backend database connection string is malformed.');
    result.set(part.slice(0, separator).trim().toLowerCase(), part.slice(separator + 1).trim());
  }
  return result;
}

function parseLoopbackHttpUrl(name, raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`${name} must be an absolute loopback URL.`);
  }
  if (
    url.protocol !== 'http:' ||
    !LOOPBACK.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    fail(`${name} must be an HTTP loopback origin without credentials, query, or fragment.`);
  }
  const port = url.port || '80';
  if (!Number.isSafeInteger(Number(port)) || Number(port) < EPHEMERAL_PORT_FLOOR) {
    fail(`${name} must use a high loopback port.`);
  }
  return { url, port };
}

function inheritedValue(env, name) {
  const entry = Object.entries(env).find(([key]) => key.toUpperCase() === name);
  return entry?.[1];
}

function validateInheritedP11Environment(env = process.env) {
  for (const name of ['ASPNETCORE_ENVIRONMENT', 'DOTNET_ENVIRONMENT']) {
    const value = inheritedValue(env, name);
    if (value && value.toLowerCase() !== 'development') {
      fail(`an inherited ${name} could select a non-development configuration.`);
    }
  }
  if (inheritedValue(env, 'SENTRY_DSN')) {
    fail('an inherited SENTRY_DSN could send local run data to an external service.');
  }
  for (const name of [
    'JWTSETTINGS__SECRET',
    'JWTSETTINGS__ISSUER',
    'JWTSETTINGS__AUDIENCE',
    'JWTSETTINGS__TENANTSLUG',
  ]) {
    if (inheritedValue(env, name) !== undefined) {
      fail('inherited JWT identity configuration is not allowed; this run generates its own identity.');
    }
  }
}

function createRunOwnedStaffCredential(candidateFactory = () => crypto.randomBytes(32).toString('hex')) {
  for (let attempt = 0; attempt < MAX_STAFF_CREDENTIAL_ATTEMPTS; attempt += 1) {
    const candidate = candidateFactory();
    if (!/^[a-f0-9]{64}$/.test(candidate)) continue;

    const credential = `${candidate}${STAFF_CREDENTIAL_SUFFIX}`;
    if (
      credential.length < 8 ||
      !/[A-Z]/.test(credential) ||
      !/[a-z]/.test(credential) ||
      !/[0-9]/.test(credential) ||
      !/[^a-zA-Z0-9]/.test(credential) ||
      new Set(credential).size < 4 ||
      REPEATING_CHARACTER_PATTERN.test(credential) ||
      COMMON_PASSWORDS.has(credential.toLowerCase()) ||
      issuedStaffCredentials.has(credential)
    ) {
      continue;
    }

    issuedStaffCredentials.add(credential);
    return credential;
  }

  fail('a unique staff credential meeting backend password rules could not be generated.');
}

function validateP11LocalIdentity(env = process.env) {
  if (env.ASPNETCORE_ENVIRONMENT !== 'Development' || env.DOTNET_ENVIRONMENT !== 'Development') {
    fail('both ASPNETCORE_ENVIRONMENT and DOTNET_ENVIRONMENT must be Development.');
  }
  if (env.SENTRY_DSN !== '') fail('SENTRY_DSN must be empty for the local run.');
  const target = validateE2EDatabaseTarget(env);
  if (target.target !== 'disposable' || env.E2E_DATABASE_TARGET !== 'disposable') {
    fail('the existing E2E guard did not accept the target as disposable.');
  }
  if (env.E2E_ALLOW_STAGING_DATABASE_WRITES || env.E2E_STAGING_DATABASE_HOST || env.E2E_STAGING_DATABASE_NAME) {
    fail('staging write acknowledgements must not be inherited.');
  }
  if (env.E2E_REMOTE || env.E2E_MAILPIT_URL) fail('remote browser mode and Mailpit are outside this isolated run.');
  if (!/^[a-f0-9]{16}$/.test(env.P11_RUN_ID ?? '')) fail('the run identity is not unique and well-formed.');

  const runId = env.P11_RUN_ID;
  const jwtIdentity = `table-account-p11-${runId}`;
  if (
    !/^[a-f0-9]{64}$/.test(env.JwtSettings__Secret ?? '') ||
    env.JwtSettings__Issuer !== jwtIdentity ||
    env.JwtSettings__Audience !== jwtIdentity ||
    env.JwtSettings__TenantSlug !== `p11-${runId}`
  ) {
    fail('the JWT signing key and tenant identity must be generated for this isolated run.');
  }
  if (
    env.P11_COMPOSE_PROJECT !== `tableaccountp11-${runId}` ||
    env.P11_DATABASE_NAME !== `p11_${runId}` ||
    env.P11_DATABASE_USER !== `p11_${runId}`
  ) {
    fail('the Compose project and database names do not match this run identity.');
  }
  const expectedDatabase = `p11_${runId}`;
  const expectedUser = `p11_${runId}`;
  const url = new URL(env.E2E_DATABASE_URL);
  const urlDatabase = decodeURIComponent(url.pathname.slice(1));
  const urlUser = decodeURIComponent(url.username);
  const urlPassword = decodeURIComponent(url.password);
  if (
    !LOOPBACK.has(url.hostname.toLowerCase()) ||
    urlDatabase !== expectedDatabase ||
    urlUser !== expectedUser ||
    !/^[a-f0-9]{64}$/.test(urlPassword)
  ) {
    fail('the guarded test DB URL does not match this run-owned loopback database identity.');
  }
  const dbPort = url.port;
  if (!dbPort || Number(dbPort) < EPHEMERAL_PORT_FLOOR) fail('the database must use a high loopback port.');

  const backendDb = parseComposeConnectionString(env.ConnectionStrings__restaurantdb);
  const value = (name) => backendDb.get(name.toLowerCase());
  const backendPort = value('port');
  if (
    value('host') !== url.hostname ||
    backendPort !== dbPort ||
    value('database') !== expectedDatabase ||
    value('username') !== expectedUser ||
    value('password') !== urlPassword ||
    (value('ssl mode') ?? value('sslmode'))?.toLowerCase() !== 'disable'
  ) {
    fail('the backend and guarded test helper do not share one derived DB endpoint.');
  }

  const api = parseLoopbackHttpUrl('E2E_API_BASE_URL', env.E2E_API_BASE_URL);
  const ui = parseLoopbackHttpUrl('E2E_BASE_URL', env.E2E_BASE_URL);
  if (
    api.port !== env.P11_API_PORT ||
    ui.port !== env.P11_UI_PORT ||
    api.port === ui.port ||
    api.port === dbPort ||
    ui.port === dbPort
  ) {
    fail('API, UI, and database must have distinct run-owned ports.');
  }
  const redis = /^(?:127\.0\.0\.1|localhost):(\d+)$/.exec(env.ConnectionStrings__redis ?? '');
  if (!redis || redis[1] !== env.P11_REDIS_PORT || Number(redis[1]) < EPHEMERAL_PORT_FLOOR) {
    fail('the backend Redis endpoint must use this run’s high loopback port.');
  }

  const localOnlyFeatures = [
    'TenantFeatures__ServerWorkspaceV2',
    'TenantFeatures__TableAccountV1',
    'TenantFeatures__OrderAmendmentsV1',
    'TenantFeatures__TableGuestVisitsV1',
    'TenantFeatures__TableVisitReadinessV1',
    'TenantFeatures__TableAccountPaymentsV1',
    'TenantFeatures__TableGuestAccountPaymentsV1',
    'TenantFeatures__ServerAccountCollectionV1',
  ];
  if (localOnlyFeatures.some((name) => env[name] !== 'true'))
    fail('required rollout switches are not enabled for this local process.');
  if (
    !/^[a-f0-9]{64}$/.test(env.PrinterSettings__ApiKey ?? '') ||
    env.P11_PRINTER_API_KEY !== env.PrinterSettings__ApiKey
  ) {
    fail('the local printer-feed evidence key does not match the API configuration.');
  }
  if (!/^[a-f0-9]{64}$/.test(env.QRCode__SecretKey ?? '') || env.P11_QR_CODE_SECRET !== env.QRCode__SecretKey) {
    fail('the QR signing key does not match this local run identity.');
  }
  if (
    Object.entries(env).some(
      ([name, value]) => Boolean(value) && (/stripe/i.test(name) || /^payments__mode$/i.test(name)),
    )
  ) {
    fail('provider credentials or a payment mode were inherited; this harness does not start online checkout.');
  }
  return { runId, databaseName: expectedDatabase, databasePort: dbPort, apiPort: api.port, uiPort: ui.port };
}

async function configure(stateDir, postgresPort, redisPort) {
  validateInheritedP11Environment();
  const composeEnv = fs.readFileSync(path.join(stateDir, 'compose.env'), 'utf8');
  const source = Object.fromEntries(
    composeEnv
      .trim()
      .split('\n')
      .map((line) => {
        const split = line.indexOf('=');
        return [line.slice(0, split), JSON.parse(line.slice(split + 1))];
      }),
  );
  const ports = [String(postgresPort), String(redisPort)];
  if (ports.some((port) => !/^\d+$/.test(port) || Number(port) < EPHEMERAL_PORT_FLOOR)) {
    fail('Compose did not assign high loopback ports to its run-owned services.');
  }
  const [apiPort, uiPort] = await Promise.all([allocateEphemeralPort(), allocateEphemeralPort()]);
  if (new Set([...ports, apiPort, uiPort]).size !== 4) fail('a local port was assigned more than once.');
  const databaseUrl = `postgres://${source.P11_DATABASE_USER}:${source.P11_DATABASE_PASSWORD}@127.0.0.1:${postgresPort}/${source.P11_DATABASE_NAME}`;
  const connectionString = `Host=127.0.0.1;Port=${postgresPort};Database=${source.P11_DATABASE_NAME};Username=${source.P11_DATABASE_USER};Password=${source.P11_DATABASE_PASSWORD};SSL Mode=Disable`;
  const uiUrl = `http://127.0.0.1:${uiPort}`;
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const printerApiKey = crypto.randomBytes(32).toString('hex');
  const qrCodeSecret = crypto.randomBytes(32).toString('hex');
  const jwtSigningSecret = crypto.randomBytes(32).toString('hex');
  const jwtIdentity = `table-account-p11-${source.P11_RUN_ID}`;
  const values = {
    P11_RUN_ID: source.P11_RUN_ID,
    P11_COMPOSE_PROJECT: source.P11_COMPOSE_PROJECT,
    P11_DATABASE_NAME: source.P11_DATABASE_NAME,
    P11_DATABASE_USER: source.P11_DATABASE_USER,
    P11_DATABASE_PASSWORD: source.P11_DATABASE_PASSWORD,
    P11_DATABASE_PORT: String(postgresPort),
    P11_REDIS_PORT: String(redisPort),
    P11_API_PORT: apiPort,
    P11_UI_PORT: uiPort,
    P11_PRINTER_API_KEY: printerApiKey,
    P11_QR_CODE_SECRET: qrCodeSecret,
    E2E_DATABASE_TARGET: 'disposable',
    E2E_DATABASE_URL: databaseUrl,
    E2E_API_BASE_URL: apiUrl,
    E2E_BASE_URL: uiUrl,
    ConnectionStrings__restaurantdb: connectionString,
    ConnectionStrings__redis: `127.0.0.1:${redisPort}`,
    ASPNETCORE_ENVIRONMENT: 'Development',
    DOTNET_ENVIRONMENT: 'Development',
    SENTRY_DSN: '',
    JwtSettings__Secret: jwtSigningSecret,
    JwtSettings__Issuer: jwtIdentity,
    JwtSettings__Audience: jwtIdentity,
    JwtSettings__TenantSlug: `p11-${source.P11_RUN_ID}`,
    ASPNETCORE_URLS: apiUrl,
    CorsSettings__AllowedOrigins__0: uiUrl,
    TenantFeatures__ServerWorkspaceV2: 'true',
    TenantFeatures__TableAccountV1: 'true',
    TenantFeatures__OrderAmendmentsV1: 'true',
    TenantFeatures__TableGuestVisitsV1: 'true',
    TenantFeatures__TableVisitReadinessV1: 'true',
    TenantFeatures__TableAccountPaymentsV1: 'true',
    TenantFeatures__TableGuestAccountPaymentsV1: 'true',
    TenantFeatures__ServerAccountCollectionV1: 'true',
    PrinterSettings__ApiKey: printerApiKey,
    QRCode__SecretKey: qrCodeSecret,
    Modules__Enforce: 'false',
    EmailSettings__EmailsEnabled: 'false',
    StripeSettings__PlatformApiKey: '',
    Stripe__PlatformApiKey: '',
    Stripe__SecretKey: '',
    STRIPE_SECRET_KEY: '',
    Payments__Mode: '',
  };
  writeEnvFile(path.join(stateDir, 'runner.env'), values);
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  process.env.P11_REDIS_PORT = String(redisPort);
  process.env.P11_API_PORT = apiPort;
  process.env.P11_UI_PORT = uiPort;
  const identity = validateP11LocalIdentity(process.env);
  await Promise.all([assertLoopbackPortAvailable(apiPort, 'API'), assertLoopbackPortAvailable(uiPort, 'UI')]);
  process.stdout.write(`P11 target identity verified for run ${identity.runId}; endpoint values are masked.\n`);
}

function main() {
  const [action, stateDir, postgresPort, redisPort] = process.argv.slice(2);
  if (action === 'init' && stateDir) return init(stateDir);
  if (action === 'configure' && stateDir && postgresPort && redisPort)
    return configure(stateDir, postgresPort, redisPort);
  if (action === 'check') {
    const identity = validateP11LocalIdentity(process.env);
    return Promise.all([
      assertLoopbackPortAvailable(identity.apiPort, 'API'),
      assertLoopbackPortAvailable(identity.uiPort, 'UI'),
    ]).then(() => {
      process.stdout.write(`P11 local identity accepted (${identity.runId}).\n`);
    });
  }
  process.stderr.write(
    'Usage: node scripts/e2e-p11-target.cjs init <state-dir> | configure <state-dir> <postgres-port> <redis-port> | check\n',
  );
  process.exitCode = 2;
  return undefined;
}

if (require.main === module) {
  Promise.resolve(main()).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'P11 target setup failed.'}\n`);
    process.exitCode = 1;
  });
}

module.exports = { createRunOwnedStaffCredential, validateInheritedP11Environment, validateP11LocalIdentity };
