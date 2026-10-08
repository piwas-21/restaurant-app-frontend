import { chmodSync, mkdirSync, realpathSync, statSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import profileGuards from './e2e-p11-stripe-profile.cjs';
import targetGuards from './e2e-p11-target.cjs';
import {
  captureLogged,
  readGeneratedEnvironment,
  runLogged,
  startLogged,
  stopProcess,
  waitUntil,
} from './e2e-p11-stripe-process.mjs';
import { runSequentially } from './e2e-p11-sequence.mjs';

const REQUIRED_POSTGRES_TOOLS = ['initdb', 'pg_ctl', 'pg_isready', 'createdb', 'pg_dump', 'pg_restore'];

function assertExecutable(filename, label) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename))
    throw new Error(`The explicit native ${label} path must be absolute.`);
  let stat;
  try {
    stat = statSync(realpathSync(filename));
  } catch {
    throw new Error(`The explicit native ${label} executable is unavailable.`);
  }
  if (!stat.isFile() || (stat.mode & 0o111) === 0)
    throw new Error(`The explicit native ${label} executable is unavailable.`);
  return realpathSync(filename);
}

export function resolveNativePostgresTools(binDirectory) {
  if (typeof binDirectory !== 'string' || !path.isAbsolute(binDirectory))
    throw new Error('An explicit PostgreSQL 18 binary directory is required.');
  let directory;
  try {
    directory = realpathSync(binDirectory);
  } catch {
    throw new Error('The explicit PostgreSQL 18 binary directory is unavailable.');
  }
  return Object.fromEntries(
    REQUIRED_POSTGRES_TOOLS.map((name) => [name, assertExecutable(path.join(directory, name), `PostgreSQL ${name}`)]),
  );
}

export function resolveNativeRedisTools(serverExecutable) {
  const server = assertExecutable(serverExecutable, 'Redis server');
  const client = assertExecutable(path.join(path.dirname(server), 'redis-cli'), 'Redis client');
  return { server, client };
}

export async function verifyNativePostgresTools(tools, systemEnv, cwd, logfile, { signal } = {}) {
  await runSequentially(Object.entries(tools), async ([name, executable]) => {
    const version = await captureLogged(executable, ['--version'], systemEnv, cwd, logfile, { signal });
    if (!/^\w+(?: \w+)* \(PostgreSQL\) 18(?:\.|\s|$)/.test(version.trim()))
      throw new Error(`The explicit ${name} executable is not PostgreSQL 18.`);
  });
}

async function allocateHighLoopbackPort() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const server = net.createServer();
    const port = await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    });
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (port >= 49152) return String(port);
  }
  throw new Error('The operating system did not allocate a high loopback port.');
}

async function allocateDifferentHighLoopbackPort(excludedPort, attemptsRemaining = 10) {
  if (attemptsRemaining === 0) throw new Error('The operating system did not allocate distinct loopback ports.');
  const port = await allocateHighLoopbackPort();
  return port === excludedPort ? allocateDifferentHighLoopbackPort(excludedPort, attemptsRemaining - 1) : port;
}

function ensurePrivateSubdirectory(parent, name) {
  profileGuards.assertPrivateDirectory(parent);
  const directory = path.join(parent, name);
  mkdirSync(directory, { mode: 0o700 });
  profileGuards.assertPrivateDirectory(directory);
  return directory;
}

async function waitForPostgres(tools, port, user, stateDir, logfile, signal) {
  await waitUntil(
    async (_signal, remaining) => {
      try {
        await captureLogged(
          tools.pg_isready,
          ['--host', '127.0.0.1', '--port', port, '--username', user, '--dbname', 'postgres'],
          {},
          stateDir,
          logfile,
          { timeoutMs: Math.min(5000, remaining), signal: _signal },
        );
        return true;
      } catch {
        return false;
      }
    },
    60_000,
    undefined,
    signal,
  );
}

export async function startNativeP11Services({
  stateDir,
  frontendDir,
  systemEnv,
  postgresBinDirectory,
  redisServerExecutable,
  signal,
}) {
  profileGuards.assertPrivateDirectory(stateDir);
  profileGuards.systemEnvironment(systemEnv);
  const tools = resolveNativePostgresTools(postgresBinDirectory);
  const redisTools = resolveNativeRedisTools(redisServerExecutable);
  const runIdentity = readGeneratedEnvironment(path.join(stateDir, 'compose.env'));
  const pgPort = await allocateHighLoopbackPort();
  const redisPort = await allocateDifferentHighLoopbackPort(pgPort);
  const dataDir = ensurePrivateSubdirectory(stateDir, 'postgres-data');
  const socketDir = ensurePrivateSubdirectory(stateDir, 'postgres-socket');
  const redisDataDir = ensurePrivateSubdirectory(stateDir, 'redis-data');
  const logfile = path.join(stateDir, 'native-services.log');
  const postgresLog = path.join(stateDir, 'postgres-server.log');
  const passwordFile = path.join(stateDir, 'postgres-init-password');
  const redisLog = path.join(stateDir, 'redis-server.log');
  profileGuards.writePrivateEvidenceFile(
    stateDir,
    path.basename(passwordFile),
    `${runIdentity.P11_DATABASE_PASSWORD}\n`,
  );
  let redisProcess;
  const services = {
    stateDir,
    runId: runIdentity.P11_RUN_ID,
    project: runIdentity.P11_COMPOSE_PROJECT,
    args: ['-p', runIdentity.P11_COMPOSE_PROJECT],
    tools,
    dataDir,
    socketDir,
    redisDataDir,
    postgresLog,
    pgPort,
    redisPort,
    systemEnv,
    frontendDir,
    nativeServicesLog: logfile,
    postgresStarted: false,
    postgresStartUncertain: false,
    redisProcess: null,
    runEnv: null,
  };
  try {
    await verifyNativePostgresTools(tools, systemEnv, stateDir, logfile, { signal });
    await runLogged(
      tools.initdb,
      [
        '--pgdata',
        dataDir,
        '--username',
        runIdentity.P11_DATABASE_USER,
        '--pwfile',
        passwordFile,
        '--auth-local=trust',
        '--auth-host=scram-sha-256',
        '--encoding=UTF8',
      ],
      systemEnv,
      frontendDir,
      logfile,
      { timeoutMs: 120_000, signal },
    );
    try {
      await runLogged(
        tools.pg_ctl,
        [
          '--pgdata',
          dataDir,
          '--log',
          postgresLog,
          '--options',
          `--port=${pgPort} --unix_socket_directories=${socketDir} --listen_addresses=127.0.0.1`,
          '--wait',
          'start',
        ],
        systemEnv,
        frontendDir,
        logfile,
        { timeoutMs: 60_000, signal },
      );
      services.postgresStarted = true;
    } catch (error) {
      try {
        await runLogged(tools.pg_ctl, ['--pgdata', dataDir, 'status'], systemEnv, frontendDir, logfile, {
          timeoutMs: 10_000,
        });
        services.postgresStarted = true;
      } catch {
        services.postgresStartUncertain = true;
      }
      throw error;
    }
    chmodSync(postgresLog, 0o600);
    await waitForPostgres(tools, pgPort, runIdentity.P11_DATABASE_USER, stateDir, logfile, signal);
    await runLogged(
      tools.createdb,
      [
        '--host',
        '127.0.0.1',
        '--port',
        pgPort,
        '--username',
        runIdentity.P11_DATABASE_USER,
        '--no-password',
        runIdentity.P11_DATABASE_NAME,
      ],
      { ...systemEnv, PGPASSWORD: runIdentity.P11_DATABASE_PASSWORD },
      frontendDir,
      logfile,
      { timeoutMs: 30_000, signal },
    );
    redisProcess = startLogged(
      redisTools.server,
      [
        '--bind',
        '127.0.0.1',
        '--protected-mode',
        'yes',
        '--port',
        redisPort,
        '--save',
        '',
        '--appendonly',
        'no',
        '--dir',
        redisDataDir,
        '--daemonize',
        'no',
      ],
      systemEnv,
      frontendDir,
      redisLog,
      { signal },
    );
    services.redisProcess = redisProcess;
    await waitUntil(
      async (_signal, remaining) => {
        try {
          const result = await captureLogged(
            redisTools.client,
            ['--no-auth-warning', '-h', '127.0.0.1', '-p', redisPort, 'ping'],
            systemEnv,
            frontendDir,
            logfile,
            { timeoutMs: Math.min(5000, remaining), signal: _signal },
          );
          return result.trim() === 'PONG';
        } catch {
          return false;
        }
      },
      30_000,
      redisProcess,
      signal,
    );
    await runLogged(
      process.execPath,
      [path.join(frontendDir, 'scripts/e2e-p11-target.cjs'), 'configure', stateDir, pgPort, redisPort],
      systemEnv,
      frontendDir,
      logfile,
      { timeoutMs: 30_000, signal },
    );
    services.runEnv = readGeneratedEnvironment(path.join(stateDir, 'runner.env'));
    targetGuards.validateP11LocalIdentity(services.runEnv);
    return services;
  } catch (error) {
    const cleanup = await stopNativeP11Services(services).catch(() => ({ stopFailed: true }));
    if (cleanup.stopFailed)
      throw new Error('Native P11 startup failed and owned-service shutdown was not verified; retain private state.', {
        cause: error,
      });
    throw error;
  }
}

export async function stopNativeP11Services(services) {
  if (!services) return { stopFailed: false };
  let stopFailed = false;
  if (services.redisProcess) {
    try {
      await stopProcess(services.redisProcess);
    } catch {
      stopFailed = true;
    }
  }
  if (services.postgresStarted || services.postgresStartUncertain) {
    try {
      profileGuards.assertPrivateDirectory(services.stateDir);
      await runLogged(
        services.tools.pg_ctl,
        ['--pgdata', services.dataDir, '--mode', 'fast', '--wait', 'stop'],
        services.systemEnv,
        services.stateDir,
        path.join(services.stateDir, 'native-services.log'),
        { timeoutMs: 30_000 },
      );
      services.postgresStarted = false;
      services.postgresStartUncertain = false;
    } catch {
      stopFailed = true;
    }
  }
  return { stopFailed };
}
