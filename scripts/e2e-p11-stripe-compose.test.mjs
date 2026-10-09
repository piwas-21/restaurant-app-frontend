import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  createStripeComposeContext,
  parseStripeComposePort,
  resolveLocalDockerContext,
  snapshotStripeDatabase,
  validateLocalDockerEndpoint,
} from './e2e-p11-stripe-compose.mjs';
import { readGeneratedEnvironment, runLogged } from './e2e-p11-stripe-process.mjs';

const localDockerContext = { name: 'default', endpoint: 'unix:///var/run/docker.sock' };

async function fixture(t) {
  const state = mkdtempSync('/tmp/table-account-stripe-compose-control.');
  t.after(() => rmSync(state, { recursive: true, force: true }));
  const helper = path.resolve('scripts/e2e-p11-target.cjs');
  const log = path.join(state, 'target.log');
  await runLogged(process.execPath, [helper, 'init', state], {}, state, log);
  await runLogged(process.execPath, [helper, 'configure', state, '55001', '55002'], {}, state, log);
  return { state, runEnv: readGeneratedEnvironment(path.join(state, 'runner.env')) };
}

async function initializedFixture(t) {
  const state = mkdtempSync('/tmp/table-account-stripe-compose-initialized.');
  t.after(() => rmSync(state, { recursive: true, force: true }));
  const helper = path.resolve('scripts/e2e-p11-target.cjs');
  await runLogged(process.execPath, [helper, 'init', state], {}, state, path.join(state, 'target.log'));
  return { state };
}

function installFakeDocker(state, context, options = {}) {
  const bin = path.join(state, 'bin');
  const invocations = path.join(state, 'docker-invocations.jsonl');
  mkdirSync(bin, { mode: 0o700 });
  const expectedComposeArgs = JSON.stringify(context.args);
  const expectedArchiveArgs = JSON.stringify([...context.args, 'exec', '-T', 'postgres', 'pg_restore', '--list']);
  const script = [
    `const fs = require('node:fs');`,
    `const args = process.argv.slice(2);`,
    `const invocations = ${JSON.stringify(invocations)};`,
    `fs.appendFileSync(invocations, JSON.stringify({ args, envKeys: Object.keys(process.env).sort() }) + '\\n', { mode: 0o600 });`,
    `fs.chmodSync(invocations, 0o600);`,
    `const composeArgs = ${expectedComposeArgs};`,
    `if (JSON.stringify(args.slice(0, composeArgs.length)) !== JSON.stringify(composeArgs)) process.exit(31);`,
    `if (args.some(argument => String(argument).includes('pg_dump'))) { process.stdout.write(Buffer.from(${JSON.stringify(Buffer.from(options.dump ?? 'PGDMP archive fixture').toString('base64'))}, 'base64')); }`,
    `else if (JSON.stringify(args) === ${JSON.stringify(expectedArchiveArgs)}) {`,
    `  const chunks = [];`,
    `  process.stdin.on('data', chunk => chunks.push(chunk));`,
    `  process.stdin.on('end', () => {`,
    `    if (Buffer.concat(chunks).subarray(0, 5).toString('ascii') !== 'PGDMP') process.exitCode = 32;`,
    `    process.stdout.write(${JSON.stringify(options.listing ?? '')});`,
    `    process.stderr.write('private archive diagnostic\\n');`,
    `    if (process.exitCode !== 32) process.exitCode = ${options.restoreExitCode ?? 0};`,
    `  });`,
    `} else process.exit(33);`,
  ].join('\n');
  writeFileSync(path.join(bin, 'docker'), `#!${process.execPath}\n${script}\n`, { mode: 0o700 });
  chmodSync(path.join(bin, 'docker'), 0o700);
  context.dockerExecutable = path.join(bin, 'docker');
  return { bin, invocations };
}

function validArchiveListing() {
  return [
    '; archive header and unrelated entries',
    '325; 0 16420 TABLE DATA public orders p11_user',
    '326; 0 16421 TABLE DATA public table_service_sessions p11_user',
    '327; 0 16422 TABLE DATA public orders_archive p11_user',
    '328; 0 16423 TABLE DATA public.orders p11_user',
  ].join('\n');
}

function assertPrivateEvidence(directory, filenames) {
  for (const filename of filenames) {
    assert.equal(statSync(path.join(directory, filename)).mode & 0o777, 0o600, `${filename} must be private`);
  }
}

test('only accepts one IPv4 loopback service binding', () => {
  assert.equal(parseStripeComposePort('127.0.0.1:55001\n'), '55001');
  for (const value of [
    '0.0.0.0:55001',
    'localhost:55001',
    '[::]:55001',
    'example.invalid:55001',
    '127.0.0.1:55001\n127.0.0.1:55002',
  ])
    assert.throws(() => parseStripeComposePort(value), /IPv4 loopback only/);
});

test('Docker selection accepts a verified local socket and rejects remote contexts or ambient overrides', async (t) => {
  const { state } = await fixture(t);
  const bin = path.join(state, 'context-bin');
  mkdirSync(bin, { mode: 0o700 });
  const executable = path.join(bin, 'docker');
  const invocations = path.join(state, 'context-invocations.jsonl');
  const writeFake = (endpoint) => {
    writeFileSync(
      executable,
      `#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(invocations)},JSON.stringify(args)+'\\n',{mode:0o600});if(args.join(' ')==='context show')process.stdout.write('default\\n');else if(args.join(' ')==='context inspect --format {{json .Endpoints.docker.Host}} default')process.stdout.write(JSON.stringify(${JSON.stringify(endpoint)}));else process.exit(5);\n`,
      { mode: 0o700 },
    );
    chmodSync(executable, 0o700);
  };
  writeFake(localDockerContext.endpoint);
  const systemEnv = { PATH: bin };
  const local = await resolveLocalDockerContext(systemEnv, state, path.join(state, 'docker-context.log'), executable);
  assert.deepEqual(local, localDockerContext);
  const calls = readFileSync(invocations, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(calls, [
    ['context', 'show'],
    ['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}', 'default'],
  ]);
  writeFake('ssh://docker@remote.invalid');
  await assert.rejects(
    resolveLocalDockerContext(systemEnv, state, path.join(state, 'remote-context.log'), executable),
    /local Unix socket/,
  );
  await assert.rejects(
    resolveLocalDockerContext(
      { ...systemEnv, DOCKER_HOST: 'tcp://remote.invalid:2376' },
      state,
      path.join(state, 'host.log'),
      executable,
    ),
    /endpoint override/,
  );
  for (const endpoint of [
    'tcp://127.0.0.1:2375',
    'ssh://user@host',
    'unix://relative.sock',
    'unix:///tmp/../docker.sock',
  ])
    assert.throws(() => validateLocalDockerEndpoint(endpoint), /local Unix socket/);
});

test('compose context binds its project, database and private credential file to the generated run', async (t) => {
  const { state, runEnv } = await fixture(t);
  const context = createStripeComposeContext(state, process.cwd(), {}, localDockerContext);
  assert.equal(context.runId, runEnv.P11_RUN_ID);
  assert.equal(context.project, runEnv.P11_COMPOSE_PROJECT);
  assert.deepEqual(context.args.slice(0, 7), [
    '--context',
    'default',
    'compose',
    '--env-file',
    path.join(state, 'compose.env'),
    '-p',
    context.project,
  ]);
  const file = path.join(state, 'compose.env');
  const original = readFileSync(file, 'utf8');
  for (const [field, badValue] of [
    ['P11_COMPOSE_PROJECT', 'restaurant-production'],
    ['P11_DATABASE_NAME', 'restaurant'],
    ['P11_DATABASE_USER', 'root'],
    ['P11_DATABASE_PASSWORD', 'not-generated'],
  ]) {
    const changed = original.replace(new RegExp(`^${field}=.*$`, 'm'), `${field}=${JSON.stringify(badValue)}`);
    writeFileSync(file, changed);
    assert.throws(
      () => createStripeComposeContext(state, process.cwd(), {}, localDockerContext),
      /private run-owned identity/,
    );
  }
});

test('run identity mismatch is rejected before any archive file or subprocess is opened', async (t) => {
  const { state, runEnv } = await fixture(t);
  const evidence = path.join(state, 'evidence');
  mkdirSync(evidence, { mode: 0o700 });
  const context = createStripeComposeContext(
    state,
    process.cwd(),
    { PATH: process.env.PATH ?? '' },
    localDockerContext,
  );
  await assert.rejects(
    snapshotStripeDatabase({ ...context, runId: 'another-run' }, runEnv, evidence),
    /does not belong/,
  );
  assert.deepEqual(readdirSync(evidence), []);
});

test('bounded cleanup can retain a started stack snapshot before port configuration exists', async (t) => {
  const { state } = await initializedFixture(t);
  const evidence = path.join(state, 'evidence');
  mkdirSync(evidence, { mode: 0o700 });
  const context = createStripeComposeContext(state, process.cwd(), {}, localDockerContext);
  const fake = installFakeDocker(state, context, { listing: `${validArchiveListing()}\n` });
  context.systemEnv = { PATH: fake.bin };

  const snapshot = await snapshotStripeDatabase(context, undefined, evidence, { timeoutMs: 5000 });

  assert.deepEqual(snapshot, {
    dumpBytes: Buffer.byteLength('PGDMP archive fixture'),
    pgdmpVerified: true,
    operationalDataVerified: true,
  });
  assert.equal(readFileSync(fake.invocations, 'utf8').trim().split('\n').length, 2);
});

test('Postgres 16 container listing verifies both exact operational tables and uses only run-owned compose arguments', async (t) => {
  const { state, runEnv } = await fixture(t);
  const evidence = path.join(state, 'evidence');
  mkdirSync(evidence, { mode: 0o700 });
  const context = createStripeComposeContext(state, process.cwd(), {}, localDockerContext);
  const fake = installFakeDocker(state, context, { listing: `${validArchiveListing()}\n` });
  context.systemEnv = { PATH: fake.bin };

  const result = await snapshotStripeDatabase(context, runEnv, evidence);

  assert.deepEqual(result, {
    dumpBytes: Buffer.byteLength('PGDMP archive fixture'),
    pgdmpVerified: true,
    operationalDataVerified: true,
  });
  const calls = readFileSync(fake.invocations, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].args, [...context.args, 'exec', '-T', 'postgres', 'pg_restore', '--list']);
  assert.equal(
    calls.every((call) => call.envKeys.every((key) => ['PATH', '__CF_USER_TEXT_ENCODING'].includes(key))),
    true,
  );
  assert.equal(
    calls.some((call) => call.args.includes(runEnv.P11_DATABASE_PASSWORD)),
    false,
  );
  assertPrivateEvidence(evidence, ['database.dump', 'database-snapshot.log', 'database-archive-list.log']);
  assert.match(readFileSync(path.join(evidence, 'database-archive-list.log'), 'utf8'), /TABLE DATA public orders/);
});

test('malformed custom archive is retained and is never passed to pg_restore', async (t) => {
  const { state, runEnv } = await fixture(t);
  const evidence = path.join(state, 'evidence');
  mkdirSync(evidence, { mode: 0o700 });
  const context = createStripeComposeContext(state, process.cwd(), {}, localDockerContext);
  const fake = installFakeDocker(state, context, { dump: 'not-a-postgres-archive' });
  context.systemEnv = { PATH: fake.bin };

  await assert.rejects(snapshotStripeDatabase(context, runEnv, evidence), /not a PostgreSQL custom archive/);

  const calls = readFileSync(fake.invocations, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(calls.length, 1);
  assert.ok(calls[0].args.some((argument) => argument.includes('pg_dump')));
  assert.deepEqual(readdirSync(evidence).sort(), ['database-snapshot.log', 'database.dump']);
  assertPrivateEvidence(evidence, ['database.dump', 'database-snapshot.log']);
});

test('archive verification rejects missing operational data while retaining private diagnostics', async (t) => {
  const { state, runEnv } = await fixture(t);
  const evidence = path.join(state, 'evidence');
  mkdirSync(evidence, { mode: 0o700 });
  const context = createStripeComposeContext(state, process.cwd(), {}, localDockerContext);
  const fake = installFakeDocker(state, context, {
    listing: '325; 0 16420 TABLE DATA public orders p11_user\n',
  });
  context.systemEnv = { PATH: fake.bin };

  await assert.rejects(snapshotStripeDatabase(context, runEnv, evidence), /omitted operational data/);

  assert.equal(readFileSync(fake.invocations, 'utf8').trim().split('\n').length, 2);
  assertPrivateEvidence(evidence, ['database.dump', 'database-snapshot.log', 'database-archive-list.log']);
  assert.match(readFileSync(path.join(evidence, 'database-archive-list.log'), 'utf8'), /private archive diagnostic/);
});

test('archive listing does not accept similarly named or dotted table entries', async (t) => {
  const { state, runEnv } = await fixture(t);
  const evidence = path.join(state, 'evidence');
  mkdirSync(evidence, { mode: 0o700 });
  const context = createStripeComposeContext(state, process.cwd(), {}, localDockerContext);
  const fake = installFakeDocker(state, context, {
    listing: [
      '401; 0 16420 TABLE DATA public orders_archive p11_user',
      '402; 0 16421 TABLE DATA public.orders p11_user',
      '403; 0 16422 TABLE DATA public table_service_sessions_archive p11_user',
      '404; 0 16423 TABLE DATA public.table_service_sessions p11_user',
    ].join('\n'),
  });
  context.systemEnv = { PATH: fake.bin };

  await assert.rejects(snapshotStripeDatabase(context, runEnv, evidence), /omitted operational data/);
});

test('nonzero container pg_restore exit cannot verify the snapshot', async (t) => {
  const { state, runEnv } = await fixture(t);
  const evidence = path.join(state, 'evidence');
  mkdirSync(evidence, { mode: 0o700 });
  const context = createStripeComposeContext(state, process.cwd(), {}, localDockerContext);
  const fake = installFakeDocker(state, context, {
    listing: `${validArchiveListing()}\n`,
    restoreExitCode: 17,
  });
  context.systemEnv = { PATH: fake.bin };

  await assert.rejects(snapshotStripeDatabase(context, runEnv, evidence), /Archive listing failed/);

  const calls = readFileSync(fake.invocations, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].args, [...context.args, 'exec', '-T', 'postgres', 'pg_restore', '--list']);
  assert.match(readFileSync(path.join(evidence, 'database-archive-list.log'), 'utf8'), /private archive diagnostic/);
  assertPrivateEvidence(evidence, ['database.dump', 'database-snapshot.log', 'database-archive-list.log']);
});

test('large archive listings remain streaming and diagnostic stdout is capped', async (t) => {
  const { state, runEnv } = await fixture(t);
  const evidence = path.join(state, 'evidence');
  mkdirSync(evidence, { mode: 0o700 });
  const context = createStripeComposeContext(state, process.cwd(), {}, localDockerContext);
  const listing = `${validArchiveListing()}\n${'x'.repeat(1_100_000)}`;
  const fake = installFakeDocker(state, context, { listing });
  context.systemEnv = { PATH: fake.bin };

  const result = await snapshotStripeDatabase(context, runEnv, evidence);

  assert.equal(result.operationalDataVerified, true);
  assert.ok(statSync(path.join(evidence, 'database-archive-list.log')).size <= 1024 * 1024 + 64);
  assertPrivateEvidence(evidence, ['database.dump', 'database-snapshot.log', 'database-archive-list.log']);
});
