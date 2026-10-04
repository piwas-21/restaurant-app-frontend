// This helper must remain CommonJS for Playwright's test collector.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isIP } = require('node:net');

const DISPOSABLE_DATABASE_HOSTS = new Set(['localhost', 'postgres']);
const TARGET_OVERRIDE_QUERY_KEYS = new Set([
  'database',
  'dbname',
  'host',
  'hostaddr',
  'password',
  'port',
  'user',
  'username',
]);
const LIBPQ_QUERY_ENV = new Map([
  ['application_name', 'PGAPPNAME'],
  ['connect_timeout', 'PGCONNECT_TIMEOUT'],
  ['fallback_application_name', 'PGFALLBACKAPPNAME'],
  ['gssencmode', 'PGGSSENCMODE'],
  ['keepalives', 'PGKEEPALIVES'],
  ['keepalives_count', 'PGKEEPALIVESCOUNT'],
  ['keepalives_idle', 'PGKEEPALIVESIDLE'],
  ['keepalives_interval', 'PGKEEPALIVESINTERVAL'],
  ['options', 'PGOPTIONS'],
  ['sslcert', 'PGSSLCERT'],
  ['sslcrl', 'PGSSLCRL'],
  ['sslcrldir', 'PGSSLCRLDIR'],
  ['sslkey', 'PGSSLKEY'],
  ['sslmode', 'PGSSLMODE'],
  ['sslrootcert', 'PGSSLROOTCERT'],
  ['ssl_max_protocol_version', 'PGSSLMAXPROTOCOLVERSION'],
  ['ssl_min_protocol_version', 'PGSSLMINPROTOCOLVERSION'],
  ['target_session_attrs', 'PGTARGETSESSIONATTRS'],
  ['tcp_user_timeout', 'PGTCPUSER_TIMEOUT'],
]);

function parsePostgresUrl(rawUrl, env = process.env) {
  validateUrlInput(rawUrl);
  parseRawHost(rawUrl);
  const url = parseUrl(rawUrl);
  validatePostgresUrl(url);

  const host = normalizeHost(url.hostname);
  if (host.includes(',')) {
    throw new Error('E2E_DATABASE_URL must not specify a comma-separated host list.');
  }
  const databaseName = parseDatabaseName(url.pathname);
  const port = resolvePort(url, env);

  validateDatabaseIdentity(url, host, databaseName);
  validateConnectionOptions(url);

  return { url, host, databaseName, port };
}

function validateUrlInput(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
    throw new Error('E2E_DATABASE_URL is required before using the E2E database.');
  }
}

function parseRawHost(rawUrl) {
  const authorityMatch = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#]*)/.exec(rawUrl);
  if (!authorityMatch) {
    throw new Error('E2E_DATABASE_URL must be a PostgreSQL URL with a hostname (value hidden).');
  }

  const rawHost = authorityMatch[1].slice(authorityMatch[1].lastIndexOf('@') + 1);
  if (rawHost.includes('%')) {
    throw new Error('E2E_DATABASE_URL must not percent-encode its hostname (value hidden).');
  }
}

function parseUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('E2E_DATABASE_URL is malformed (value hidden).');
  }
  return url;
}

function validatePostgresUrl(url) {
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('E2E_DATABASE_URL must use postgres: or postgresql: (value hidden).');
  }
  if (url.hostname.startsWith('[') && url.hostname.endsWith(']')) {
    throw new Error('E2E_DATABASE_URL does not support bracketed IPv6 hosts (value hidden).');
  }
}

function parseDatabaseName(pathname) {
  const encodedDatabaseName = pathname.startsWith('/') ? pathname.slice(1) : '';
  let pgDatabaseName;
  let databaseName;
  try {
    pgDatabaseName = decodeURI(encodedDatabaseName);
    databaseName = decodeURIComponent(encodedDatabaseName);
  } catch {
    throw new Error('E2E_DATABASE_URL has an invalid database path (value hidden).');
  }
  if (databaseName !== pgDatabaseName) {
    throw new Error('E2E_DATABASE_URL must not encode reserved characters in the database path (value hidden).');
  }
  return databaseName;
}

function validateDatabaseIdentity(url, host, databaseName) {
  const encodedDatabaseName = url.pathname.startsWith('/') ? url.pathname.slice(1) : '';
  if (!host || !databaseName || encodedDatabaseName.includes('/') || databaseName.includes('\0')) {
    throw new Error('E2E_DATABASE_URL must include a hostname and database name (value hidden).');
  }
  if (url.hash) {
    throw new Error('E2E_DATABASE_URL must not include a fragment (value hidden).');
  }
}

function validateConnectionOptions(url) {
  const queryKeys = [...url.searchParams.keys()].map((key) => key.toLowerCase());
  if (queryKeys.some((key) => TARGET_OVERRIDE_QUERY_KEYS.has(key))) {
    throw new Error('E2E_DATABASE_URL query parameters must not override the connection target.');
  }
  if (new Set(queryKeys).size !== queryKeys.length) {
    throw new Error('E2E_DATABASE_URL must not repeat query parameters.');
  }
  if (queryKeys.some((key) => key !== 'ssl' && !LIBPQ_QUERY_ENV.has(key))) {
    throw new Error('E2E_DATABASE_URL contains an unsupported connection option.');
  }
  const sslValue = [...url.searchParams.entries()].find(([key]) => key.toLowerCase() === 'ssl')?.[1];
  if (
    queryKeys.includes('ssl') &&
    (queryKeys.includes('sslmode') || !['true', 'false'].includes(sslValue?.toLowerCase() ?? ''))
  ) {
    throw new Error('E2E_DATABASE_URL has an unsupported SSL option.');
  }
}

function resolvePort(url, env) {
  const rawPort = url.port || env.PGPORT || '5432';
  if (typeof rawPort !== 'string' || !/^\d+$/.test(rawPort)) {
    throw new Error('E2E_DATABASE_URL or PGPORT must specify a valid PostgreSQL port (value hidden).');
  }

  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('E2E_DATABASE_URL or PGPORT must specify a valid PostgreSQL port (value hidden).');
  }

  return String(port);
}

function normalizeHost(host) {
  const unbracketed = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  return unbracketed.toLowerCase();
}

function isRecognizedDisposableHost(host) {
  const ipVersion = isIP(host);
  if (ipVersion === 4) return Number(host.split('.')[0]) === 127;
  if (ipVersion === 6) return host === '::1';
  return DISPOSABLE_DATABASE_HOSTS.has(host);
}

function normalizeExpectedStagingHost(value) {
  if (typeof value !== 'string' || value.length === 0) return undefined;

  let url;
  try {
    url = new URL(`postgres://${value}/`);
  } catch {
    return undefined;
  }

  if (
    !url.hostname ||
    (url.hostname.startsWith('[') && url.hostname.endsWith(']')) ||
    url.hostname.includes(',') ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    return undefined;
  }
  return normalizeHost(url.hostname);
}

function normalizeExpectedStagingPort(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) return undefined;
  return String(port);
}

/**
 * Require an explicit database class before any E2E helper opens a writable
 * Postgres connection. The disposable marker is an operator assertion; the
 * endpoint must still be loopback or the documented Docker service alias.
 * Staging requires a second exact acknowledgement and an independently
 * configured hostname/database identity that matches the parsed URL.
 */
function validateE2EDatabaseTarget(env = process.env) {
  const { host, databaseName, port } = parsePostgresUrl(env.E2E_DATABASE_URL, env);

  if (env.E2E_DATABASE_TARGET === 'disposable') {
    if (!isRecognizedDisposableHost(host)) {
      throw new Error('A disposable E2E database must use a recognized loopback or Postgres service-container host.');
    }
    return { target: 'disposable' };
  }

  if (env.E2E_DATABASE_TARGET === 'staging') {
    if (env.E2E_ALLOW_STAGING_DATABASE_WRITES !== 'YES') {
      throw new Error('Staging database writes require E2E_ALLOW_STAGING_DATABASE_WRITES=YES.');
    }

    const expectedHost = normalizeExpectedStagingHost(env.E2E_STAGING_DATABASE_HOST);
    const expectedDatabaseName = env.E2E_STAGING_DATABASE_NAME;
    const expectedPort = normalizeExpectedStagingPort(env.E2E_STAGING_DATABASE_PORT);
    if (
      !expectedHost ||
      typeof expectedDatabaseName !== 'string' ||
      expectedDatabaseName.length === 0 ||
      !expectedPort
    ) {
      throw new Error(
        'Staging database writes require E2E_STAGING_DATABASE_HOST, E2E_STAGING_DATABASE_NAME, and E2E_STAGING_DATABASE_PORT.',
      );
    }
    if (host !== expectedHost || databaseName !== expectedDatabaseName || port !== expectedPort) {
      throw new Error('E2E_DATABASE_URL does not match the configured staging database identity.');
    }
    return { target: 'staging' };
  }

  throw new Error('Set E2E_DATABASE_TARGET to exactly "disposable" or "staging" before database writes.');
}

/** Build libpq environment settings for the guarded SQL seed without putting the URL in argv. */
function createPsqlEnvironment(env = process.env) {
  validateE2EDatabaseTarget(env);
  const { url, host, databaseName, port } = parsePostgresUrl(env.E2E_DATABASE_URL, env);
  const psqlEnv = { ...env };
  delete psqlEnv.E2E_DATABASE_URL;
  delete psqlEnv.PGHOSTADDR;
  delete psqlEnv.PGSERVICE;
  delete psqlEnv.PGSERVICEFILE;

  psqlEnv.PGHOST = host;
  psqlEnv.PGPORT = port;
  psqlEnv.PGDATABASE = databaseName;
  if (url.username) psqlEnv.PGUSER = decodeURIComponent(url.username);
  if (url.password) psqlEnv.PGPASSWORD = decodeURIComponent(url.password);

  for (const [key, value] of url.searchParams.entries()) {
    if (key.toLowerCase() === 'ssl') {
      psqlEnv.PGSSLMODE = value.toLowerCase() === 'true' ? 'require' : 'disable';
      continue;
    }
    const environmentKey = LIBPQ_QUERY_ENV.get(key.toLowerCase());
    if (!environmentKey) throw new Error('E2E_DATABASE_URL contains an unsupported connection option.');
    psqlEnv[environmentKey] = value;
  }

  return psqlEnv;
}

module.exports = { createPsqlEnvironment, validateE2EDatabaseTarget };

if (require.main === module) {
  try {
    const { target } = validateE2EDatabaseTarget();
    process.stdout.write(`E2E database target accepted (${target}).\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'E2E database target rejected.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
