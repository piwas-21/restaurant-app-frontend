import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  resolveNativePostgresTools,
  resolveNativeRedisTools,
  stopNativeP11Services,
  verifyNativePostgresTools,
} from './e2e-p11-native-postgres.mjs';
import { snapshotNativeP11Database, verifyNativeArchiveListing } from './e2e-p11-native-postgres-snapshot.mjs';
import { readGeneratedEnvironment, runLogged } from './e2e-p11-stripe-process.mjs';

function privateTemp(prefix) {
  const directory = mkdtempSync(`/tmp/${prefix}.`);
  chmodSync(directory, 0o700);
  return directory;
}

test('native PostgreSQL tool discovery requires explicit executable files', (t) => {
  const binDirectory = privateTemp('p11-native-pg-tools');
  t.after(() => rmSync(binDirectory, { recursive: true, force: true }));
  for (const name of ['initdb', 'pg_ctl', 'pg_isready', 'createdb', 'pg_dump', 'pg_restore']) {
    const executable = path.join(binDirectory, name);
    writeFileSync(executable, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    chmodSync(executable, 0o700);
  }
  const tools = resolveNativePostgresTools(binDirectory);
  assert.equal(Object.keys(tools).length, 6);
  assert.ok(Object.values(tools).every((filename) => path.isAbsolute(filename)));
  assert.throws(() => resolveNativePostgresTools('/tmp/not-a-postgres-install'), /binary directory|unavailable/);
});

test('native Redis client is resolved beside the explicit server executable', (t) => {
  const binDirectory = privateTemp('p11-native-redis-tools');
  t.after(() => rmSync(binDirectory, { recursive: true, force: true }));
  for (const name of ['redis-server', 'redis-cli']) {
    const executable = path.join(binDirectory, name);
    writeFileSync(executable, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    chmodSync(executable, 0o700);
  }
  const tools = resolveNativeRedisTools(path.join(binDirectory, 'redis-server'));
  assert.equal(tools.server, realpathSync(path.join(binDirectory, 'redis-server')));
  assert.equal(tools.client, realpathSync(path.join(binDirectory, 'redis-cli')));
  assert.throws(() => resolveNativeRedisTools(path.join(binDirectory, 'missing')), /executable is unavailable/);
});

test('native mode checks every selected Postgres executable is major version 18', async (t) => {
  const state = privateTemp('p11-native-pg-versions');
  t.after(() => rmSync(state, { recursive: true, force: true }));
  const tools = {};
  for (const name of ['initdb', 'pg_ctl', 'pg_isready', 'createdb', 'pg_dump', 'pg_restore']) {
    const executable = path.join(state, name);
    writeFileSync(executable, `#!/bin/sh\nprintf '%s\\n' '${name} (PostgreSQL) 18.1'\n`, { mode: 0o700 });
    chmodSync(executable, 0o700);
    tools[name] = executable;
  }
  const log = path.join(state, 'versions.log');
  const system = { PATH: process.env.PATH ?? '' };
  await verifyNativePostgresTools(tools, system, state, log);
  writeFileSync(tools.pg_dump, "#!/bin/sh\nprintf '%s\\n' 'pg_dump (PostgreSQL) 17.9'\n", { mode: 0o700 });
  chmodSync(tools.pg_dump, 0o700);
  await assert.rejects(verifyNativePostgresTools(tools, system, state, log), /pg_dump executable is not PostgreSQL 18/);
});

test('native snapshot refuses another run before opening evidence files', async (t) => {
  const state = privateTemp('p11-native-pg-identity');
  t.after(() => rmSync(state, { recursive: true, force: true }));
  const helper = path.resolve('scripts/e2e-p11-target.cjs');
  const targetLog = path.join(state, 'target.log');
  await runLogged(process.execPath, [helper, 'init', state], { PATH: process.env.PATH ?? '' }, state, targetLog);
  await runLogged(
    process.execPath,
    [helper, 'configure', state, '55011', '55012'],
    { PATH: process.env.PATH ?? '' },
    state,
    targetLog,
  );
  const runEnv = readGeneratedEnvironment(path.join(state, 'runner.env'));
  const evidence = path.join(state, 'evidence');
  mkdirSync(evidence, { mode: 0o700 });
  const services = {
    stateDir: state,
    runId: '0000000000000000',
    project: runEnv.P11_COMPOSE_PROJECT,
    pgPort: runEnv.P11_DATABASE_PORT,
    redisPort: runEnv.P11_REDIS_PORT,
  };
  await assert.rejects(
    snapshotNativeP11Database(services, runEnv, evidence),
    /does not belong to this disposable P11 run/,
  );
  assert.deepEqual(readdirSync(evidence), []);
});

test('native cleanup does not invoke PostgreSQL shutdown before this run starts it', async () => {
  const result = await stopNativeP11Services({ postgresStarted: false, redisProcess: null });
  assert.deepEqual(result, { stopFailed: false });
});

test('native archive listing requires exact operational table data names', () => {
  assert.doesNotThrow(() =>
    verifyNativeArchiveListing(
      [
        '325; 0 16420 TABLE DATA public orders p11_user',
        '326; 0 16421 TABLE DATA public table_service_sessions p11_user',
      ].join('\n'),
    ),
  );
  for (const listing of [
    '325; 0 16420 TABLE DATA public orders_archive p11_user\n326; 0 16421 TABLE DATA public table_service_sessions_archive p11_user',
    '325; 0 16420 TABLE DATA public.orders p11_user\n326; 0 16421 TABLE DATA public.table_service_sessions p11_user',
    '325; 0 16420 TABLE DATA public orders p11_user',
  ])
    assert.throws(() => verifyNativeArchiveListing(listing), /omitted operational data/);
});
