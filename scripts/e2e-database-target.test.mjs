import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { createPsqlEnvironment, validateE2EDatabaseTarget } = require('./e2e-database-target.cjs');
const ConnectionParameters = require('pg/lib/connection-parameters');
const parsePgConnectionString = require('pg-connection-string').parse;
const validatorPath = fileURLToPath(new URL('./e2e-database-target.cjs', import.meta.url));
const disposable = {
  E2E_DATABASE_TARGET: 'disposable',
  E2E_DATABASE_URL: 'postgres://e2e:encoded%40secret@localhost:5432/e2e_disposable', // pragma: allowlist secret -- synthetic no-connection fixture
};

const staging = {
  E2E_DATABASE_TARGET: 'staging',
  E2E_ALLOW_STAGING_DATABASE_WRITES: 'YES',
  E2E_STAGING_DATABASE_HOST: 'staging-db.example.internal',
  E2E_STAGING_DATABASE_NAME: 'staging_e2e',
  E2E_STAGING_DATABASE_PORT: '6432',
  E2E_DATABASE_URL: 'postgresql://e2e:encoded%40secret@staging-db.example.internal:6432/staging_e2e?sslmode=require', // pragma: allowlist secret -- synthetic no-connection fixture
};

test('explicit disposable target accepts loopback and the known Docker Postgres service alias', () => {
  assert.deepEqual(validateE2EDatabaseTarget(disposable), { target: 'disposable' });
  assert.deepEqual(
    validateE2EDatabaseTarget({
      ...disposable,
      E2E_DATABASE_URL: 'postgresql://e2e@postgres:5432/isolated_synthetic',
    }),
    { target: 'disposable' },
  );
  assert.deepEqual(
    validateE2EDatabaseTarget({
      ...disposable,
      E2E_DATABASE_URL: 'postgresql://e2e@127.0.0.2:5432/isolated_synthetic',
    }),
    { target: 'disposable' },
  );
});

test('explicit CI target permits its isolated restaurantdb service container', () => {
  assert.deepEqual(
    validateE2EDatabaseTarget({
      ...disposable,
      E2E_DATABASE_URL: 'postgres://e2e@localhost:5432/restaurantdb',
    }),
    { target: 'disposable' },
  );
});

test('staging requires the exact write acknowledgement and matching configured identity', () => {
  assert.deepEqual(validateE2EDatabaseTarget(staging), { target: 'staging' });
  assert.throws(
    () => validateE2EDatabaseTarget({ ...staging, E2E_ALLOW_STAGING_DATABASE_WRITES: undefined }),
    /E2E_ALLOW_STAGING_DATABASE_WRITES=YES/,
  );
  assert.throws(
    () => validateE2EDatabaseTarget({ ...staging, E2E_ALLOW_STAGING_DATABASE_WRITES: 'yes' }),
    /E2E_ALLOW_STAGING_DATABASE_WRITES=YES/,
  );
  assert.throws(
    () => validateE2EDatabaseTarget({ ...staging, E2E_STAGING_DATABASE_HOST: undefined }),
    /E2E_STAGING_DATABASE_HOST, E2E_STAGING_DATABASE_NAME, and E2E_STAGING_DATABASE_PORT/,
  );
  assert.throws(
    () => validateE2EDatabaseTarget({ ...staging, E2E_STAGING_DATABASE_NAME: undefined }),
    /E2E_STAGING_DATABASE_HOST, E2E_STAGING_DATABASE_NAME, and E2E_STAGING_DATABASE_PORT/,
  );
  assert.throws(
    () => validateE2EDatabaseTarget({ ...staging, E2E_STAGING_DATABASE_PORT: undefined }),
    /E2E_STAGING_DATABASE_HOST, E2E_STAGING_DATABASE_NAME, and E2E_STAGING_DATABASE_PORT/,
  );
  assert.throws(
    () => validateE2EDatabaseTarget({ ...staging, E2E_STAGING_DATABASE_PORT: '6432invalid' }),
    /E2E_STAGING_DATABASE_HOST, E2E_STAGING_DATABASE_NAME, and E2E_STAGING_DATABASE_PORT/,
  );
  assert.throws(
    () => validateE2EDatabaseTarget({ ...staging, E2E_STAGING_DATABASE_PORT: '65536' }),
    /E2E_STAGING_DATABASE_HOST, E2E_STAGING_DATABASE_NAME, and E2E_STAGING_DATABASE_PORT/,
  );
  assert.throws(
    () => validateE2EDatabaseTarget({ ...staging, E2E_STAGING_DATABASE_NAME: 'another_database' }),
    /does not match the configured staging database identity/,
  );
  assert.throws(
    () => validateE2EDatabaseTarget({ ...staging, E2E_STAGING_DATABASE_PORT: '6433' }),
    /does not match the configured staging database identity/,
  );
  assert.throws(
    () =>
      validateE2EDatabaseTarget({
        ...staging,
        E2E_STAGING_DATABASE_HOST: 'different.example.internal',
      }),
    /does not match the configured staging database identity/,
  );
  assert.throws(
    () => validateE2EDatabaseTarget({ ...staging, E2E_STAGING_DATABASE_HOST: '[::1]' }),
    /E2E_STAGING_DATABASE_HOST, E2E_STAGING_DATABASE_NAME, and E2E_STAGING_DATABASE_PORT/,
  );
});

test('rejects reserved database path escapes that pg preserves literally', () => {
  const databaseUrl = 'postgresql://e2e@staging-db.example.internal:6432/staging%3Fe2e';
  assert.equal(parsePgConnectionString(databaseUrl).database, 'staging%3Fe2e');
  assert.throws(
    () =>
      validateE2EDatabaseTarget({
        ...staging,
        E2E_STAGING_DATABASE_NAME: 'staging?e2e',
        E2E_DATABASE_URL: databaseUrl,
      }),
    /must not encode reserved characters in the database path/,
  );
});

test('accepts percent-encoded ordinary database name characters', () => {
  const databaseUrl = 'postgresql://e2e@staging-db.example.internal:6432/staging%2De2e';
  assert.equal(parsePgConnectionString(databaseUrl).database, 'staging-e2e');
  assert.deepEqual(
    validateE2EDatabaseTarget({
      ...staging,
      E2E_STAGING_DATABASE_NAME: 'staging-e2e',
      E2E_DATABASE_URL: databaseUrl,
    }),
    { target: 'staging' },
  );
});

test('rejects comma-separated host lists even when staging identity matches exactly', () => {
  const databaseUrl = 'postgresql://e2e@staging-db.example.internal,backup-db.example.internal:6432/staging_e2e';
  assert.equal(parsePgConnectionString(databaseUrl).host, 'staging-db.example.internal,backup-db.example.internal');
  assert.throws(
    () =>
      validateE2EDatabaseTarget({
        ...staging,
        E2E_STAGING_DATABASE_HOST: 'staging-db.example.internal,backup-db.example.internal',
        E2E_DATABASE_URL: databaseUrl,
      }),
    /must not specify a comma-separated host list/,
  );
});

test('rejects bracketed IPv6 because pg preserves brackets and psql normalizes them', () => {
  const databaseUrl = 'postgresql://e2e@[::1]:5432/e2e_disposable';
  assert.equal(parsePgConnectionString(databaseUrl).host, '[::1]');
  assert.throws(
    () => validateE2EDatabaseTarget({ ...disposable, E2E_DATABASE_URL: databaseUrl }),
    /does not support bracketed IPv6 hosts/,
  );
});

test('preserves trailing-dot hostnames so pg and psql receive the same DNS name', () => {
  const databaseUrl = 'postgresql://e2e@staging-db.example.internal.:6432/staging_e2e';
  const parsedHost = parsePgConnectionString(databaseUrl).host;
  const env = createPsqlEnvironment({
    ...staging,
    E2E_STAGING_DATABASE_HOST: 'staging-db.example.internal.',
    E2E_DATABASE_URL: databaseUrl,
  });

  assert.equal(parsedHost, 'staging-db.example.internal.');
  assert.equal(env.PGHOST, parsedHost);
});

test('staging identity compares the effective inherited port when URL port is omitted', () => {
  const env = {
    ...staging,
    PGPORT: '06432',
    E2E_DATABASE_URL: 'postgresql://e2e@staging-db.example.internal/staging_e2e?sslmode=require',
    E2E_STAGING_DATABASE_PORT: '6432',
  };

  assert.deepEqual(validateE2EDatabaseTarget(env), { target: 'staging' });
  assert.equal(createPsqlEnvironment(env).PGPORT, '6432');
});

for (const [name, changes] of [
  ['missing database marker', { E2E_DATABASE_TARGET: undefined }],
  ['unknown database marker', { E2E_DATABASE_TARGET: 'local' }],
  ['remote URL marked disposable', { E2E_DATABASE_URL: 'postgres://e2e@db.example.internal/restaurantdb' }],
  ['unrecognized local-looking service', { E2E_DATABASE_URL: 'postgres://e2e@db:5432/restaurantdb' }],
  ['non-Postgres protocol', { E2E_DATABASE_URL: 'https://e2e@localhost/restaurantdb' }],
  ['malformed URL', { E2E_DATABASE_URL: 'postgres://%broken' }],
  ['percent-encoded hostname', { E2E_DATABASE_URL: 'postgres://e2e@%6cocalhost/restaurantdb' }],
  ['target override in query', { E2E_DATABASE_URL: 'postgres://e2e@localhost/restaurantdb?host=db.example' }],
  ['staging marker without staging opt-in', { E2E_DATABASE_TARGET: 'staging' }],
  ['invalid inherited port', { E2E_DATABASE_URL: 'postgres://e2e@localhost/e2e_disposable', PGPORT: '6432invalid' }],
]) {
  test(`rejects ${name} without exposing the connection secret`, () => {
    const candidate = {
      ...disposable,
      ...changes,
      E2E_DATABASE_URL: changes.E2E_DATABASE_URL ?? disposable.E2E_DATABASE_URL,
    };
    assert.throws(
      () => validateE2EDatabaseTarget(candidate),
      (error) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message.includes('encoded@secret'), false);
        assert.equal(error.message.includes('encoded%40secret'), false);
        assert.equal(error.message.includes(candidate.E2E_DATABASE_URL), false);
        return true;
      },
    );
  });
}

test('psql connection setup preserves URL identity and removes the URL from its child environment', () => {
  const env = createPsqlEnvironment({ ...disposable, PGHOSTADDR: '192.0.2.20', PGSERVICE: 'unexpected' });
  assert.equal(env.PGHOST, 'localhost');
  assert.equal(env.PGPORT, '5432');
  assert.equal(env.PGDATABASE, 'e2e_disposable');
  assert.equal(env.PGUSER, 'e2e');
  assert.equal(env.PGPASSWORD, 'encoded@secret');
  assert.equal(env.E2E_DATABASE_URL, undefined);
  assert.equal(env.PGHOSTADDR, undefined);
  assert.equal(env.PGSERVICE, undefined);
});

test('staging SSL connection options survive the seed wrapper conversion', () => {
  const env = createPsqlEnvironment(staging);
  assert.equal(env.PGHOST, 'staging-db.example.internal');
  assert.equal(env.PGPORT, '6432');
  assert.equal(env.PGDATABASE, 'staging_e2e');
  assert.equal(env.PGSSLMODE, 'require');
});

test('seed wrapper uses the validated inherited PGPORT that pg resolves', () => {
  const previousPort = process.env.PGPORT;
  process.env.PGPORT = '6432';
  try {
    const databaseUrl = 'postgres://e2e@localhost/e2e_disposable';
    const target = { ...disposable, E2E_DATABASE_URL: databaseUrl, PGPORT: '6432' };
    const poolPort = new ConnectionParameters({ connectionString: databaseUrl }).port;
    const psqlEnv = createPsqlEnvironment(target);

    assert.equal(poolPort, 6432);
    assert.equal(psqlEnv.PGPORT, String(poolPort));
  } finally {
    if (previousPort === undefined) delete process.env.PGPORT;
    else process.env.PGPORT = previousPort;
  }
});

test('URL port takes precedence over inherited PGPORT for pool and seed', () => {
  const databaseUrl = 'postgres://e2e@localhost:5432/e2e_disposable';
  const previousPort = process.env.PGPORT;
  process.env.PGPORT = '6432';
  try {
    const target = { ...disposable, E2E_DATABASE_URL: databaseUrl, PGPORT: '6432' };
    const poolPort = new ConnectionParameters({ connectionString: databaseUrl }).port;
    const psqlEnv = createPsqlEnvironment(target);

    assert.equal(poolPort, 5432);
    assert.equal(psqlEnv.PGPORT, String(poolPort));
  } finally {
    if (previousPort === undefined) delete process.env.PGPORT;
    else process.env.PGPORT = previousPort;
  }
});

test('validator CLI rejects remote disposable targets without printing connection details', () => {
  const connectionUrl = 'postgres://e2e:private-e2e-credential@db.example.internal/restaurantdb'; // pragma: allowlist secret -- synthetic no-connection fixture
  const result = spawnSync(process.execPath, [validatorPath], {
    env: {
      PATH: process.env.PATH ?? '',
      E2E_DATABASE_TARGET: 'disposable',
      E2E_DATABASE_URL: connectionUrl,
    },
    encoding: 'utf8',
  });
  const output = `${result.stdout}${result.stderr}`;

  assert.equal(result.status, 1);
  assert.equal(output.includes(connectionUrl), false);
  assert.equal(output.includes('private-e2e-credential'), false);
});
