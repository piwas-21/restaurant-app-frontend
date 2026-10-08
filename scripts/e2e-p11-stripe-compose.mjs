import { spawn } from 'node:child_process';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';
import targetGuards from './e2e-p11-target.cjs';
import profileGuards from './e2e-p11-stripe-profile.cjs';
import { captureLogged, parseGeneratedEnvironment, runLogged, waitForChildClose } from './e2e-p11-stripe-process.mjs';
import systemTools from './e2e-p11-system-tools.cjs';

const MAX_ARCHIVE_LIST_DIAGNOSTICS = 1024 * 1024;
const MAX_ARCHIVE_LIST_LINE_LENGTH = 4096;
const DOCKER_CONTEXT_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const DOCKER_COMMAND_TIMEOUT_MS = 30_000;

function inspectArchiveLine(line, verifiedTables) {
  const match = /^\s*\d+;\s+\d+\s+\d+\s+TABLE DATA\s+public\s+(orders|table_service_sessions)(?:\s|$)/.exec(line);
  if (match) verifiedTables.add(match[1]);
}

function inspectArchiveChunk(chunk, listingState) {
  const text = listingState.partialLine + chunk.toString('utf8');
  let lineStart = 0;
  while (true) {
    const lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd < 0) break;
    if (!listingState.discardLongLine && lineEnd - lineStart <= MAX_ARCHIVE_LIST_LINE_LENGTH)
      inspectArchiveLine(text.slice(lineStart, lineEnd).replace(/\r$/, ''), listingState.verifiedTables);
    lineStart = lineEnd + 1;
    listingState.discardLongLine = false;
  }
  listingState.partialLine = text.slice(lineStart);
  if (listingState.partialLine.length > MAX_ARCHIVE_LIST_LINE_LENGTH) {
    listingState.partialLine = '';
    listingState.discardLongLine = true;
  }
}

function requireCleanDockerEnvironment(systemEnv) {
  if (Object.keys(systemEnv).some((name) => /^DOCKER_/i.test(name)))
    throw new Error('The acceptance Docker environment contains an unexpected endpoint override.');
}

export function validateLocalDockerEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || !endpoint.startsWith('unix:///'))
    throw new Error('The selected Docker context does not use a local Unix socket.');
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error('The selected Docker context does not use a local Unix socket.');
  }
  let socketPath;
  try {
    const rawPath = endpoint.slice('unix://'.length);
    if (/%(?:2f|5c)/i.test(rawPath)) throw new Error('ambiguous socket path');
    socketPath = decodeURIComponent(rawPath);
  } catch {
    throw new Error('The selected Docker context does not use a local Unix socket.');
  }
  if (
    parsed.protocol !== 'unix:' ||
    parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !path.isAbsolute(socketPath) ||
    socketPath.includes('\0') ||
    socketPath.includes('\\') ||
    socketPath.split(path.sep).some((segment) => segment === '.' || segment === '..')
  )
    throw new Error('The selected Docker context does not use a local Unix socket.');
  return endpoint;
}

export function validateDockerContextName(name) {
  if (typeof name !== 'string' || !DOCKER_CONTEXT_NAME.test(name))
    throw new Error('The selected Docker context name is invalid.');
  return name;
}

function readPrivateComposeEnvironment(stateDir) {
  profileGuards.assertPrivateDirectory(stateDir);
  const envFile = path.join(stateDir, 'compose.env');
  let descriptor;
  try {
    const linkStat = lstatSync(envFile);
    if (!linkStat.isFile() || linkStat.isSymbolicLink()) throw new Error('not a regular file');
    descriptor = openSync(envFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor);
    if (
      !stat.isFile() ||
      stat.uid !== process.getuid() ||
      (stat.mode & 0o777) !== 0o600 ||
      stat.dev !== linkStat.dev ||
      stat.ino !== linkStat.ino
    )
      throw new Error('not a private run file');
    return parseGeneratedEnvironment(readFileSync(descriptor, 'utf8'));
  } catch {
    throw new Error('The Stripe acceptance stack identity could not be read privately.');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function validateComposeIdentity(env, expectedRunId, expectedProject) {
  if (
    !/^[a-f0-9]{16}$/.test(env.P11_RUN_ID ?? '') ||
    env.P11_COMPOSE_PROJECT !== `tableaccountp11-${env.P11_RUN_ID}` ||
    env.P11_DATABASE_NAME !== `p11_${env.P11_RUN_ID}` ||
    env.P11_DATABASE_USER !== env.P11_DATABASE_NAME ||
    !/^[a-f0-9]{64}$/.test(env.P11_DATABASE_PASSWORD ?? '') ||
    env.P11_RUN_ID !== expectedRunId ||
    env.P11_COMPOSE_PROJECT !== expectedProject
  )
    throw new Error('The Stripe acceptance stack does not have a private run-owned identity.');
  return env;
}

export async function resolveLocalDockerContext(systemEnv, cwd, logfile, dockerExecutable) {
  requireCleanDockerEnvironment(systemEnv);
  const command = dockerExecutable ?? systemTools.resolveSystemExecutable('docker');
  const name = validateDockerContextName(
    (
      await captureLogged(command, ['context', 'show'], systemEnv, cwd, logfile, {
        timeoutMs: DOCKER_COMMAND_TIMEOUT_MS,
      })
    ).trim(),
  );
  let endpoint;
  try {
    endpoint = JSON.parse(
      await captureLogged(
        command,
        ['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}', name],
        systemEnv,
        cwd,
        logfile,
        { timeoutMs: DOCKER_COMMAND_TIMEOUT_MS },
      ),
    );
  } catch {
    throw new Error('The selected Docker context endpoint could not be verified.');
  }
  return { name, endpoint: validateLocalDockerEndpoint(endpoint) };
}

export function createStripeComposeContext(stateDir, frontendDir, systemEnv, dockerContext, dockerExecutable) {
  requireCleanDockerEnvironment(systemEnv);
  profileGuards.assertPrivateDirectory(stateDir);
  validateDockerContextName(dockerContext?.name);
  validateLocalDockerEndpoint(dockerContext?.endpoint);
  const envFile = path.join(stateDir, 'compose.env');
  const env = readPrivateComposeEnvironment(stateDir);
  validateComposeIdentity(env, env.P11_RUN_ID, env.P11_COMPOSE_PROJECT);
  return {
    stateDir,
    frontendDir,
    systemEnv,
    dockerExecutable,
    runId: env.P11_RUN_ID,
    project: env.P11_COMPOSE_PROJECT,
    dockerContext,
    args: [
      '--context',
      dockerContext.name,
      'compose',
      '--env-file',
      envFile,
      '-p',
      env.P11_COMPOSE_PROJECT,
      '-f',
      path.join(frontendDir, 'e2e/p11/compose.yaml'),
    ],
    logfile: path.join(stateDir, 'compose.log'),
  };
}

export function runStripeCompose(context, args, options = {}) {
  return runLogged(
    context.dockerExecutable ?? systemTools.resolveSystemExecutable('docker'),
    [...context.args, ...args],
    context.systemEnv,
    context.frontendDir,
    context.logfile,
    options,
  );
}

export function captureStripeCompose(context, args, options = {}) {
  return captureLogged(
    context.dockerExecutable ?? systemTools.resolveSystemExecutable('docker'),
    [...context.args, ...args],
    context.systemEnv,
    context.frontendDir,
    context.logfile,
    options,
  );
}

export function parseStripeComposePort(raw) {
  const match = /^127\.0\.0\.1:(\d+)\s*$/.exec(raw);
  if (!match) throw new Error('A disposable service was not published on IPv4 loopback only.');
  return match[1];
}

async function verifyArchiveListing(context, dump, evidenceDir, timeoutMs, signal) {
  const diagnostics = path.join(evidenceDir, 'database-archive-list.log');
  let dumpFd;
  let diagnosticsFd;
  let child;
  let diagnosticBytes = 0;
  let diagnosticsWriteFailed = false;
  const listingState = { partialLine: '', discardLongLine: false, verifiedTables: new Set() };

  try {
    // The caller has already checked this run's generated identity before any archive open.
    dumpFd = openSync(dump, constants.O_RDONLY | constants.O_NOFOLLOW);
    const dumpStat = fstatSync(dumpFd);
    if (!dumpStat.isFile() || dumpStat.uid !== process.getuid() || (dumpStat.mode & 0o777) !== 0o600)
      throw new Error('The database archive is not private.');
    profileGuards.assertPrivateDirectory(evidenceDir);
    diagnosticsFd = openSync(
      diagnostics,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    const diagnosticsStat = fstatSync(diagnosticsFd);
    if (
      !diagnosticsStat.isFile() ||
      diagnosticsStat.uid !== process.getuid() ||
      (diagnosticsStat.mode & 0o777) !== 0o600
    )
      throw new Error('Archive diagnostics are not private.');
    const args = [...context.args, 'exec', '-T', 'postgres', 'pg_restore', '--list'];
    child = spawn(context.dockerExecutable ?? systemTools.resolveSystemExecutable('docker'), args, {
      env: context.systemEnv,
      cwd: context.frontendDir,
      shell: false,
      detached: process.platform !== 'win32',
      stdio: [dumpFd, 'pipe', diagnosticsFd],
    });
    closeSync(dumpFd);
    dumpFd = undefined;

    child.stdout.on('data', (chunk) => {
      inspectArchiveChunk(chunk, listingState);
      if (diagnosticBytes < MAX_ARCHIVE_LIST_DIAGNOSTICS) {
        const count = Math.min(chunk.length, MAX_ARCHIVE_LIST_DIAGNOSTICS - diagnosticBytes);
        try {
          const written = writeSync(diagnosticsFd, chunk, 0, count);
          diagnosticBytes += written;
        } catch {
          diagnosticsWriteFailed = true;
          child.kill('SIGKILL');
        }
      }
    });

    const code = await waitForChildClose(child, timeoutMs, signal);
    if (listingState.partialLine && !listingState.discardLongLine)
      inspectArchiveLine(listingState.partialLine.replace(/\r$/, ''), listingState.verifiedTables);
    if (diagnosticsWriteFailed || code !== 0)
      throw new Error('Archive listing failed; retain the owned acceptance stack.');
    if (!listingState.verifiedTables.has('orders') || !listingState.verifiedTables.has('table_service_sessions'))
      throw new Error('Archive listing omitted operational data; retain the owned acceptance stack.');
  } catch (error) {
    if (dumpFd !== undefined) closeSync(dumpFd);
    if (child?.exitCode === null && child?.signalCode === null)
      await waitForChildClose(child, 1000).catch(() => undefined);
    if (error instanceof Error && error.message.startsWith('Archive listing omitted operational data')) throw error;
    throw new Error('Archive listing failed; retain the owned acceptance stack.');
  } finally {
    if (diagnosticsFd !== undefined) closeSync(diagnosticsFd);
  }
}

/** Binary stdout has its own descriptor; diagnostic logging cannot corrupt the archive. */
export async function snapshotStripeDatabase(context, runEnv, evidenceDir, { timeoutMs = 120_000, signal } = {}) {
  const composeEnv = readPrivateComposeEnvironment(context.stateDir);
  if (composeEnv.P11_RUN_ID !== context.runId || composeEnv.P11_COMPOSE_PROJECT !== context.project)
    throw new Error('The snapshot does not belong to this acceptance stack.');
  validateComposeIdentity(composeEnv, context.runId, context.project);
  const identity = runEnv ? targetGuards.validateP11LocalIdentity(runEnv) : { runId: composeEnv.P11_RUN_ID };
  if (identity.runId !== context.runId || (runEnv && runEnv.P11_COMPOSE_PROJECT !== context.project))
    throw new Error('The snapshot does not belong to this acceptance stack.');
  profileGuards.assertPrivateDirectory(evidenceDir);
  const deadline = Date.now() + timeoutMs;
  const dump = path.join(evidenceDir, 'database.dump');
  const privateFileFlags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;
  const dumpFd = openSync(dump, privateFileFlags, 0o600);
  let errorFd;
  let child;
  try {
    const dumpStat = fstatSync(dumpFd);
    if (!dumpStat.isFile() || dumpStat.uid !== process.getuid() || (dumpStat.mode & 0o777) !== 0o600)
      throw new Error('Database snapshot archive is not private.');
    errorFd = openSync(
      path.join(evidenceDir, 'database-snapshot.log'),
      constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | constants.O_NOFOLLOW,
      0o600,
    );
    const errorStat = fstatSync(errorFd);
    if (!errorStat.isFile() || errorStat.uid !== process.getuid() || (errorStat.mode & 0o777) !== 0o600)
      throw new Error('Database snapshot diagnostics are not private.');
    child = spawn(
      context.dockerExecutable ?? systemTools.resolveSystemExecutable('docker'),
      [
        ...context.args,
        'exec',
        '-T',
        'postgres',
        'sh',
        '-c',
        'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --format=custom --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
      ],
      {
        env: context.systemEnv,
        cwd: context.frontendDir,
        shell: false,
        detached: process.platform !== 'win32',
        stdio: ['ignore', dumpFd, errorFd],
      },
    );
  } catch {
    closeSync(dumpFd);
    if (errorFd !== undefined) closeSync(errorFd);
    throw new Error('Database snapshot could not be started with private evidence files.');
  }
  closeSync(dumpFd);
  if (errorFd !== undefined) closeSync(errorFd);
  const code = await waitForChildClose(child, timeoutMs, signal).catch(() => -1);
  if (code !== 0) throw new Error('Database snapshot failed; the owned stack must be retained.');
  const descriptor = openSync(dump, constants.O_RDONLY | constants.O_NOFOLLOW);
  const header = Buffer.alloc(5);
  try {
    if (readSync(descriptor, header, 0, 5, 0) !== 5 || header.toString('ascii') !== 'PGDMP')
      throw new Error('Database snapshot is not a PostgreSQL custom archive; retain the owned stack.');
  } finally {
    closeSync(descriptor);
  }
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error('Database snapshot exceeded its deadline; the owned stack must be retained.');
  await verifyArchiveListing(context, dump, evidenceDir, remaining, signal);
  return { dumpBytes: statSync(dump).size, pgdmpVerified: true, operationalDataVerified: true };
}
