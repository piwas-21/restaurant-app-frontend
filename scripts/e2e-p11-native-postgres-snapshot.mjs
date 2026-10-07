import { spawn } from 'node:child_process';
import { closeSync, constants, fstatSync, openSync, readSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import profileGuards from './e2e-p11-stripe-profile.cjs';
import targetGuards from './e2e-p11-target.cjs';
import { captureLogged, waitForChildClose } from './e2e-p11-stripe-process.mjs';

const MAX_ARCHIVE_LIST_BYTES = 1024 * 1024;

export function verifyNativeArchiveListing(listing) {
  const found = new Set();
  for (const line of listing.split('\n')) {
    const match = /^\s*\d+;\s+\d+\s+\d+\s+TABLE DATA\s+public\s+(orders|table_service_sessions)(?:\s|$)/.exec(line);
    if (match) found.add(match[1]);
  }
  if (!found.has('orders') || !found.has('table_service_sessions'))
    throw new Error('The native database snapshot omitted operational data.');
}

export async function snapshotNativeP11Database(services, runEnv, evidenceDir, { timeoutMs = 120_000, signal } = {}) {
  profileGuards.assertPrivateDirectory(services.stateDir);
  profileGuards.assertPrivateDirectory(evidenceDir);
  const identity = targetGuards.validateP11LocalIdentity(runEnv);
  if (
    identity.runId !== services.runId ||
    runEnv.P11_COMPOSE_PROJECT !== services.project ||
    runEnv.P11_DATABASE_PORT !== services.pgPort ||
    runEnv.P11_REDIS_PORT !== services.redisPort
  )
    throw new Error('The native snapshot does not belong to this disposable P11 run.');
  const dump = path.join(evidenceDir, 'database.dump');
  const diagnostics = path.join(evidenceDir, 'database-snapshot.log');
  const listingFile = path.join(evidenceDir, 'database-archive-list.log');
  const dumpFd = openSync(
    dump,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  let diagnosticsFd;
  try {
    diagnosticsFd = openSync(
      diagnostics,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
  } catch (error) {
    closeSync(dumpFd);
    throw error;
  }
  const dumpStat = fstatSync(dumpFd);
  const diagnosticsStat = fstatSync(diagnosticsFd);
  if (
    !dumpStat.isFile() ||
    !diagnosticsStat.isFile() ||
    (dumpStat.mode & 0o777) !== 0o600 ||
    (diagnosticsStat.mode & 0o777) !== 0o600
  ) {
    closeSync(dumpFd);
    closeSync(diagnosticsFd);
    throw new Error('Native database snapshot files are not private.');
  }
  let child;
  try {
    child = spawn(
      services.tools.pg_dump,
      [
        '--host',
        '127.0.0.1',
        '--port',
        services.pgPort,
        '--username',
        runEnv.P11_DATABASE_USER,
        '--dbname',
        runEnv.P11_DATABASE_NAME,
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '--no-password',
      ],
      {
        env: { ...services.systemEnv, PGPASSWORD: runEnv.P11_DATABASE_PASSWORD },
        cwd: services.stateDir,
        shell: false,
        detached: process.platform !== 'win32',
        stdio: ['ignore', dumpFd, diagnosticsFd],
      },
    );
  } catch {
    closeSync(dumpFd);
    closeSync(diagnosticsFd);
    throw new Error('Native database snapshot could not be started with private evidence files.');
  }
  closeSync(dumpFd);
  closeSync(diagnosticsFd);
  const code = await waitForChildClose(child, timeoutMs, signal);
  if (code !== 0) throw new Error('Native database snapshot failed; retain the owned stack.');
  const descriptor = openSync(dump, constants.O_RDONLY | constants.O_NOFOLLOW);
  const header = Buffer.alloc(5);
  try {
    if (readSync(descriptor, header, 0, 5, 0) !== 5 || header.toString('ascii') !== 'PGDMP')
      throw new Error('Native snapshot is not a PostgreSQL custom archive.');
  } finally {
    closeSync(descriptor);
  }
  const listing = await captureLogged(
    services.tools.pg_restore,
    ['--list', dump],
    services.systemEnv,
    services.stateDir,
    path.join(services.stateDir, 'native-services.log'),
    { timeoutMs, maxStdoutBytes: MAX_ARCHIVE_LIST_BYTES, signal },
  );
  verifyNativeArchiveListing(listing);
  writeFileSync(listingFile, listing, { mode: 0o600, flag: 'wx' });
  return {
    dumpBytes: statSync(dump).size,
    pgdmpVerified: true,
    operationalDataVerified: true,
    postgresMajor: 18,
  };
}
