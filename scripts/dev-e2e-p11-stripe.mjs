import { existsSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import profileGuards from './e2e-p11-stripe-profile.cjs';
import targetGuards from './e2e-p11-target.cjs';
import {
  captureLogged,
  installCancellationHandlers,
  readGeneratedEnvironment,
  runLogged,
  startLogged,
  stopOwnedProcessesAndSnapshot,
  waitUntil,
} from './e2e-p11-stripe-process.mjs';
import {
  captureStripeCompose,
  createStripeComposeContext,
  parseStripeComposePort,
  resolveLocalDockerContext,
  runStripeCompose,
  snapshotStripeDatabase,
} from './e2e-p11-stripe-compose.mjs';
import { stripeRunEvidenceFields, verifyStripeFinancialEvidence } from './e2e-p11-stripe-financial-evidence.mjs';
import { startStripeListener } from './e2e-p11-stripe-listener.mjs';
import { verifyTestConnectedAccount } from './e2e-p11-stripe-provider.mjs';
import { startNativeP11Services, stopNativeP11Services } from './e2e-p11-native-postgres.mjs';
import { snapshotNativeP11Database } from './e2e-p11-native-postgres-snapshot.mjs';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [
  profileFile,
  backendDir,
  stripeExecutable,
  expectedBackendHead,
  stackMode = 'compose',
  postgresBinDirectory,
  redisServerExecutable,
] = process.argv.slice(2);
const stripeOrigin = 'https://api.stripe.com';
const COMMAND_TIMEOUT_MS = 5 * 60 * 1000;
const PLAYWRIGHT_TIMEOUT_MS = 30 * 60 * 1000;
const SNAPSHOT_TIMEOUT_MS = 2 * 60 * 1000;

async function captureGit(args, cwd, logfile, signal) {
  return captureLogged('git', args, profileGuards.systemEnvironment(process.env), cwd, logfile, {
    timeoutMs: 30_000,
    signal,
  });
}

async function main() {
  const cancellation = new AbortController();
  const uninstallSignalHandlers = installCancellationHandlers(cancellation);
  let state;
  let orchestrationLog;
  let compose;
  let nativeServices;
  let runEnv;
  let api;
  let listener;
  let evidenceDir;
  let browserDir;
  let browserEnv;
  let providerProof;
  let completed = false;
  let snapshotVerified = false;
  let cleanupFailed = false;

  try {
    targetGuards.validateInheritedP11Environment();
    if (process.versions.node.split('.')[0] !== '22') throw new Error('This acceptance runner requires Node 22.');
    if (
      !backendDir ||
      !path.isAbsolute(backendDir) ||
      !path.isAbsolute(stripeExecutable ?? '') ||
      !/^[a-f0-9]{40}$/.test(expectedBackendHead ?? '') ||
      !['compose', 'native-pg18'].includes(stackMode) ||
      (stackMode === 'native-pg18' &&
        (!path.isAbsolute(postgresBinDirectory ?? '') || !path.isAbsolute(redisServerExecutable ?? '')))
    )
      throw new Error('Explicit backend, isolated Stripe CLI, source revision and valid stack mode are required.');
    const apiProject = path.join(backendDir, 'RestaurantSystem.Api/RestaurantSystem.Api.csproj');
    const infrastructure = path.join(
      backendDir,
      'RestaurantSystem.Infrastructure/RestaurantSystem.Infrastructure.csproj',
    );
    const config = path.join(frontendDir, 'e2e/p11-stripe/playwright.config.ts');
    if (![apiProject, infrastructure, config, stripeExecutable].every(existsSync))
      throw new Error('Acceptance source, browser configuration or isolated Stripe CLI is missing.');
    const profile = profileGuards.readStripeProfile(profileFile);
    const system = profileGuards.systemEnvironment(process.env);
    state = mkdtempSync('/tmp/table-account-p11-stripe.');
    profileGuards.assertPrivateDirectory(state);
    orchestrationLog = path.join(state, 'orchestration.log');

    const backendHead = (
      await captureGit(['rev-parse', 'HEAD'], backendDir, orchestrationLog, cancellation.signal)
    ).trim();
    const dirtyBackend = await captureGit(
      ['status', '--porcelain', '--untracked-files=all'],
      backendDir,
      orchestrationLog,
      cancellation.signal,
    );
    if (backendHead !== expectedBackendHead || dirtyBackend.trim())
      throw new Error('The backend revision differs from the approved acceptance source.');
    const frontendHead = (
      await captureGit(['rev-parse', 'HEAD'], frontendDir, orchestrationLog, cancellation.signal)
    ).trim();
    const dirtyFrontend = await captureGit(
      ['status', '--porcelain', '--untracked-files=all'],
      frontendDir,
      orchestrationLog,
      cancellation.signal,
    );
    if (dirtyFrontend.trim()) throw new Error('Commit the frontend acceptance source before running this profile.');

    const dockerContext =
      stackMode === 'compose' ? await resolveLocalDockerContext(system, frontendDir, orchestrationLog) : undefined;
    await verifyTestConnectedAccount(profile, stripeOrigin, { signal: cancellation.signal });
    const target = path.join(frontendDir, 'scripts/e2e-p11-target.cjs');
    await runLogged(process.execPath, [target, 'init', state], system, frontendDir, orchestrationLog, {
      timeoutMs: COMMAND_TIMEOUT_MS,
      signal: cancellation.signal,
    });
    if (stackMode === 'native-pg18') {
      nativeServices = await startNativeP11Services({
        stateDir: state,
        frontendDir,
        systemEnv: system,
        postgresBinDirectory,
        redisServerExecutable,
        signal: cancellation.signal,
      });
      runEnv = nativeServices.runEnv;
      compose = {
        runId: nativeServices.runId,
        project: nativeServices.project,
        args: nativeServices.args,
      };
    } else {
      compose = createStripeComposeContext(state, frontendDir, system, dockerContext);
    }
    const artifactDirectories = profileGuards.ensurePrivateArtifactDirectories(compose.runId);
    evidenceDir = artifactDirectories.evidenceDir;
    browserDir = artifactDirectories.browserDir;
    profileGuards.writePrivateEvidenceFile(
      evidenceDir,
      'source.json',
      JSON.stringify({ frontendHead, backendHead, profile: profileGuards.PROFILE }),
    );
    if (stackMode === 'compose') {
      const currentDockerContext = await resolveLocalDockerContext(system, frontendDir, orchestrationLog);
      if (currentDockerContext.name !== dockerContext.name || currentDockerContext.endpoint !== dockerContext.endpoint)
        throw new Error('The local Docker context changed before the isolated stack could start.');
      await runStripeCompose(compose, ['up', '-d'], {
        timeoutMs: 10 * 60 * 1000,
        signal: cancellation.signal,
      });
      await waitUntil(
        async (signal, remaining) => {
          try {
            await captureStripeCompose(
              compose,
              ['exec', '-T', 'postgres', 'sh', '-c', 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
              { signal, timeoutMs: Math.min(10_000, remaining) },
            );
            return (
              (
                await captureStripeCompose(compose, ['exec', '-T', 'redis', 'redis-cli', 'ping'], {
                  signal,
                  timeoutMs: Math.min(10_000, remaining),
                })
              ).trim() === 'PONG'
            );
          } catch {
            return false;
          }
        },
        90_000,
        undefined,
        cancellation.signal,
      );
      const postgresPort = parseStripeComposePort(
        await captureStripeCompose(compose, ['port', 'postgres', '5432'], {
          signal: cancellation.signal,
        }),
      );
      const redisPort = parseStripeComposePort(
        await captureStripeCompose(compose, ['port', 'redis', '6379'], { signal: cancellation.signal }),
      );
      await runLogged(
        process.execPath,
        [target, 'configure', state, postgresPort, redisPort],
        system,
        frontendDir,
        orchestrationLog,
        { timeoutMs: COMMAND_TIMEOUT_MS, signal: cancellation.signal },
      );
      runEnv = readGeneratedEnvironment(path.join(state, 'runner.env'));
    }
    targetGuards.validateP11LocalIdentity(runEnv);
    browserEnv = profileGuards.buildStripeBrowserEnvironment(runEnv, system, profile, browserDir);
    profileGuards.validateStripeBrowserEnvironment(browserEnv);
    const offlineEnv = { ...system, ...runEnv, DOTNET_USE_POLLING_FILE_WATCHER: '1' };
    await runLogged(
      'dotnet',
      ['ef', 'database', 'update', '--project', infrastructure, '--startup-project', apiProject],
      offlineEnv,
      backendDir,
      orchestrationLog,
      { timeoutMs: 10 * 60 * 1000, signal: cancellation.signal },
    );
    await runLogged(
      process.execPath,
      [path.join(frontendDir, 'scripts/e2e-seed.mjs')],
      offlineEnv,
      frontendDir,
      orchestrationLog,
      { timeoutMs: COMMAND_TIMEOUT_MS, signal: cancellation.signal },
    );
    const listening = await startStripeListener(stripeExecutable, state, runEnv, profile, system, {
      signal: cancellation.signal,
    });
    listener = listening.listener;
    const environments = profileGuards.buildStripeProcessEnvironments(runEnv, system, profile, listening.signingSecret);
    const apiEnv = { ...environments.api, DOTNET_USE_POLLING_FILE_WATCHER: '1' };
    api = startLogged(
      'dotnet',
      ['run', '--project', apiProject, '--no-build', '--no-launch-profile'],
      apiEnv,
      backendDir,
      path.join(evidenceDir, 'backend.log'),
      { signal: cancellation.signal },
    );
    await waitUntil(
      async (signal, remaining) => {
        try {
          const timeout = AbortSignal.timeout(Math.min(2000, remaining));
          const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
          return (await fetch(`${runEnv.E2E_API_BASE_URL}/api/health`, { signal: requestSignal })).ok;
        } catch {
          return false;
        }
      },
      120_000,
      api,
      cancellation.signal,
    );
    profileGuards.validateStripeBrowserEnvironment(browserEnv);
    await runLogged(
      process.execPath,
      [path.join(frontendDir, 'node_modules/@playwright/test/cli.js'), 'test', '--config', config],
      browserEnv,
      frontendDir,
      path.join(evidenceDir, 'browser.log'),
      { timeoutMs: PLAYWRIGHT_TIMEOUT_MS, signal: cancellation.signal },
    );
    const proof = await verifyStripeFinancialEvidence({
      runEnv,
      compose,
      evidenceDir,
      browserDir,
      profile,
      origin: stripeOrigin,
      signal: cancellation.signal,
    });
    if (!stripeRunEvidenceFields(proof).providerCleanupVerified)
      throw new Error('The connected Stripe financial evidence was incomplete.');
    providerProof = proof;
    completed = true;
  } finally {
    const cleanup = await stopOwnedProcessesAndSnapshot([api, listener], async () => {
      if (nativeServices && evidenceDir) {
        return snapshotNativeP11Database(nativeServices, runEnv, evidenceDir, {
          timeoutMs: SNAPSHOT_TIMEOUT_MS,
        });
      }
      if (compose && evidenceDir) {
        return snapshotStripeDatabase(compose, runEnv, evidenceDir, {
          timeoutMs: SNAPSHOT_TIMEOUT_MS,
        });
      }
      return undefined;
    });
    let nativeStopFailed = false;
    if (nativeServices) nativeStopFailed = (await stopNativeP11Services(nativeServices)).stopFailed;
    cleanupFailed = cleanup.stopFailed || cleanup.snapshotFailed || nativeStopFailed;
    snapshotVerified = cleanup.snapshotResult !== undefined;
    try {
      if (compose && evidenceDir) {
        profileGuards.writePrivateEvidenceFile(
          evidenceDir,
          'run.json',
          JSON.stringify({
            result: completed && snapshotVerified && !cleanupFailed ? 'provider-financial-evidence-verified' : 'failed',
            onlineProvider: 'stripe-test',
            databaseRuntime: nativeServices ? 'native-postgres18-redis' : 'compose-postgres16-redis',
            snapshot: cleanup.snapshotResult ?? null,
            ...stripeRunEvidenceFields(providerProof),
          }),
        );
      }
    } finally {
      uninstallSignalHandlers();
      process.stdout.write(
        `Private Stripe acceptance state retained: ${state ?? 'not-created'}; snapshot verified: ${snapshotVerified}.\n`,
      );
    }
    if (cleanupFailed) throw new Error('Acceptance cleanup or the bounded database snapshot did not complete.');
  }
}

main().catch(() => {
  process.stderr.write(
    'Stripe acceptance stopped; inspect its private run state. No production activity is claimed.\n',
  );
  if (process.exitCode === undefined || process.exitCode === 0) process.exitCode = 1;
});
