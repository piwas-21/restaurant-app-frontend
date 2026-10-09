import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
import {
  mixedTenderRunEvidenceFields,
  verifyMixedTenderFinancialEvidence,
} from './e2e-p11-stripe-mixed-financial-evidence.mjs';
import { startStripeListener } from './e2e-p11-stripe-listener.mjs';
import { verifyTestConnectedAccount } from './e2e-p11-stripe-provider.mjs';
import {
  buildEfDatabaseUpdateArgs,
  isRuntimeManifestVerified,
  readApiRuntimeManifest,
  requireRuntimeManifestVerified,
  resolveApiRuntimeDirectory,
  sameApiRuntimeManifest,
} from './e2e-p11-stripe-runtime-manifest.mjs';
import { startNativeP11Services, stopNativeP11Services } from './e2e-p11-native-postgres.mjs';
import { snapshotNativeP11Database } from './e2e-p11-native-postgres-snapshot.mjs';
import { resolveStripeAcceptanceScenario } from './e2e-p11-stripe-scenarios.mjs';
import systemTools from './e2e-p11-system-tools.cjs';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [
  profileFile,
  backendDir,
  stripeExecutable,
  expectedBackendHead,
  stackMode = 'compose',
  postgresBinDirectory,
  redisServerExecutable,
  scenario = 'four-phone',
] = process.argv.slice(2);
const stripeOrigin = 'https://api.stripe.com';
const COMMAND_TIMEOUT_MS = 5 * 60 * 1000;
const PLAYWRIGHT_TIMEOUT_MS = 30 * 60 * 1000;
const SNAPSHOT_TIMEOUT_MS = 2 * 60 * 1000;

async function captureGit(args, cwd, logfile, signal) {
  return captureLogged(
    systemTools.resolveSystemExecutable('git'),
    args,
    profileGuards.systemEnvironment(process.env),
    cwd,
    logfile,
    {
      timeoutMs: 30_000,
      signal,
    },
  );
}

function validateRunnerConfiguration() {
  targetGuards.validateInheritedP11Environment();
  if (process.versions.node.split('.')[0] !== '22') throw new Error('This acceptance runner requires Node 22.');
  const selectedScenario = resolveStripeAcceptanceScenario(scenario);
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
  const testSpec = path.join(frontendDir, selectedScenario.testSpec);
  if (![apiProject, infrastructure, config, stripeExecutable, testSpec].every(existsSync))
    throw new Error('Acceptance source, browser configuration or isolated Stripe CLI is missing.');
  return {
    apiProject,
    apiRuntimeDirectory: resolveApiRuntimeDirectory(apiProject),
    infrastructure,
    config,
    scenario: selectedScenario.name,
    testSpec,
  };
}

async function verifySourcePins(resources) {
  const backendHead = (
    await captureGit(['rev-parse', 'HEAD'], backendDir, resources.orchestrationLog, resources.signal)
  ).trim();
  const dirtyBackend = await captureGit(
    ['status', '--porcelain', '--untracked-files=all'],
    backendDir,
    resources.orchestrationLog,
    resources.signal,
  );
  if (backendHead !== expectedBackendHead || dirtyBackend.trim())
    throw new Error('The backend revision differs from the approved acceptance source.');
  const frontendHead = (
    await captureGit(['rev-parse', 'HEAD'], frontendDir, resources.orchestrationLog, resources.signal)
  ).trim();
  const dirtyFrontend = await captureGit(
    ['status', '--porcelain', '--untracked-files=all'],
    frontendDir,
    resources.orchestrationLog,
    resources.signal,
  );
  if (dirtyFrontend.trim()) throw new Error('Commit the frontend acceptance source before running this profile.');
  return { backendHead, frontendHead };
}

function runtimeManifestSummary(manifest, matchesBaseline) {
  return {
    manifestSha256: manifest.digest,
    apiAssemblySha256: manifest.apiAssemblySha256,
    fileCount: manifest.fileCount,
    matchesBaseline,
  };
}

function recordRuntimeManifestCheckpoint(resources, checkpoint) {
  resources.runtimeCheckpoints ??= {};
  try {
    const manifest = readApiRuntimeManifest(resources.apiRuntimeDirectory);
    const matchesBaseline = sameApiRuntimeManifest(resources.runtimeBaseline, manifest);
    resources.runtimeCheckpoints[checkpoint] = runtimeManifestSummary(manifest, matchesBaseline);
    if (!matchesBaseline) resources.runtimeIntegrityFailed = true;
    return matchesBaseline;
  } catch {
    resources.runtimeCheckpoints[checkpoint] = { verified: false };
    resources.runtimeIntegrityFailed = true;
    return false;
  }
}

function requireRuntimeManifestCheckpoint(resources, checkpoint) {
  if (!recordRuntimeManifestCheckpoint(resources, checkpoint))
    throw new Error('The pinned API runtime changed or could not be verified during acceptance setup.');
}

function runtimeManifestEvidence(resources) {
  return {
    policy: 'prebuilt-no-build',
    efDatabaseUpdateNoBuild: true,
    apiLaunchNoBuild: true,
    beforeProviderAccountCheck: resources.runtimeCheckpoints?.beforeProviderAccountCheck ?? null,
    checkpoints: resources.runtimeCheckpoints ?? {},
    verified: isRuntimeManifestVerified(resources.runtimeCheckpoints, resources.runtimeIntegrityFailed),
  };
}

function writeSourceEvidenceIfReady(resources) {
  if (!resources.evidenceDir || resources.sourceEvidenceWritten) return;
  profileGuards.writePrivateEvidenceFile(
    resources.evidenceDir,
    'source.json',
    JSON.stringify({
      ...resources.sourcePins,
      profile: profileGuards.PROFILE,
      runtime: runtimeManifestEvidence(resources),
    }),
  );
  resources.sourceEvidenceWritten = true;
}

async function createOwnedStack(resources, config, sourcePins) {
  const { signal } = resources;
  resources.dockerExecutable = stackMode === 'compose' ? systemTools.resolveSystemExecutable('docker') : undefined;
  resources.dockerContext =
    stackMode === 'compose'
      ? await resolveLocalDockerContext(
          resources.system,
          frontendDir,
          resources.orchestrationLog,
          resources.dockerExecutable,
        )
      : undefined;
  await verifyTestConnectedAccount(resources.profile, stripeOrigin, { signal });
  requireRuntimeManifestCheckpoint(resources, 'afterProviderAccountCheck');
  resources.target = path.join(frontendDir, 'scripts/e2e-p11-target.cjs');
  await runLogged(
    process.execPath,
    [resources.target, 'init', resources.state],
    resources.system,
    frontendDir,
    resources.orchestrationLog,
    {
      timeoutMs: COMMAND_TIMEOUT_MS,
      signal,
    },
  );
  if (stackMode === 'native-pg18') {
    resources.nativeServices = await startNativeP11Services({
      stateDir: resources.state,
      frontendDir,
      systemEnv: resources.system,
      postgresBinDirectory,
      redisServerExecutable,
      signal,
    });
    resources.runEnv = resources.nativeServices.runEnv;
    resources.compose = {
      stateDir: resources.state,
      runId: resources.nativeServices.runId,
      project: resources.nativeServices.project,
      args: resources.nativeServices.args,
    };
  } else {
    resources.compose = createStripeComposeContext(
      resources.state,
      frontendDir,
      resources.system,
      resources.dockerContext,
      resources.dockerExecutable,
    );
  }
  const artifactDirectories = profileGuards.ensurePrivateArtifactDirectories(
    resources.compose.runId,
    path.join(resources.state, 'stripe-evidence'),
  );
  resources.evidenceDir = artifactDirectories.evidenceDir;
  resources.browserDir = artifactDirectories.browserDir;
  resources.sourcePins = sourcePins;
  if (stackMode === 'compose') await configureComposeStack(resources);
  targetGuards.validateP11LocalIdentity(resources.runEnv);
  resources.browserEnv = profileGuards.buildStripeBrowserEnvironment(
    resources.runEnv,
    resources.system,
    resources.profile,
    resources.browserDir,
  );
  profileGuards.validateStripeBrowserEnvironment(resources.browserEnv);
  resources.offlineEnv = { ...resources.system, ...resources.runEnv, DOTNET_USE_POLLING_FILE_WATCHER: '1' };
}

async function configureComposeStack(resources) {
  const { compose, dockerContext, dockerExecutable, system, state, signal, orchestrationLog } = resources;
  const currentDockerContext = await resolveLocalDockerContext(system, frontendDir, orchestrationLog, dockerExecutable);
  if (currentDockerContext.name !== dockerContext.name || currentDockerContext.endpoint !== dockerContext.endpoint)
    throw new Error('The local Docker context changed before the isolated stack could start.');
  await runStripeCompose(compose, ['up', '-d'], { timeoutMs: 10 * 60 * 1000, signal });
  await waitUntil(
    (probeSignal, remaining) => probeComposeServices(compose, probeSignal, remaining),
    90_000,
    undefined,
    signal,
  );
  const postgresPort = parseStripeComposePort(
    await captureStripeCompose(compose, ['port', 'postgres', '5432'], { signal }),
  );
  const redisPort = parseStripeComposePort(await captureStripeCompose(compose, ['port', 'redis', '6379'], { signal }));
  await runLogged(
    process.execPath,
    [resources.target, 'configure', state, postgresPort, redisPort],
    system,
    frontendDir,
    orchestrationLog,
    { timeoutMs: COMMAND_TIMEOUT_MS, signal },
  );
  resources.runEnv = readGeneratedEnvironment(path.join(state, 'runner.env'));
}

async function probeComposeServices(compose, signal, remaining) {
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
}

async function migrateAndSeed(resources, { apiProject, infrastructure }) {
  const { offlineEnv, signal, orchestrationLog } = resources;
  requireRuntimeManifestCheckpoint(resources, 'beforeEfMigration');
  let migrationFailed = false;
  try {
    await runLogged(
      'dotnet',
      buildEfDatabaseUpdateArgs(infrastructure, apiProject),
      offlineEnv,
      backendDir,
      orchestrationLog,
      { timeoutMs: 10 * 60 * 1000, signal },
    );
  } catch {
    migrationFailed = true;
  }
  const runtimeUnchangedAfterMigration = recordRuntimeManifestCheckpoint(resources, 'afterEfMigration');
  if (migrationFailed) throw new Error('The no-build database migration failed; private run evidence is retained.');
  if (!runtimeUnchangedAfterMigration)
    throw new Error('The API runtime changed during the no-build database migration.');
  await runLogged(
    process.execPath,
    [path.join(frontendDir, 'scripts/e2e-seed.mjs')],
    offlineEnv,
    frontendDir,
    orchestrationLog,
    { timeoutMs: COMMAND_TIMEOUT_MS, signal },
  );
}

async function startBrowserApi(resources, { apiProject, config, scenario, testSpec }) {
  const { signal, runEnv, profile, system, state, evidenceDir, browserDir, browserEnv } = resources;
  const listenerStartup = await startStripeListener(stripeExecutable, state, runEnv, profile, system, { signal });
  resources.listener = listenerStartup.listener;
  const environments = profileGuards.buildStripeProcessEnvironments(
    runEnv,
    system,
    profile,
    listenerStartup.signingSecret,
  );
  requireRuntimeManifestCheckpoint(resources, 'beforeApiStart');
  resources.api = startLogged(
    'dotnet',
    ['run', '--project', apiProject, '--no-build', '--no-launch-profile'],
    { ...environments.api, DOTNET_USE_POLLING_FILE_WATCHER: '1' },
    backendDir,
    path.join(evidenceDir, 'backend.log'),
    { signal },
  );
  await waitUntil(
    (probeSignal, remaining) => probeApiHealth(runEnv.E2E_API_BASE_URL, probeSignal, remaining),
    120_000,
    resources.api,
    signal,
  );
  requireRuntimeManifestCheckpoint(resources, 'afterApiStart');
  profileGuards.validateStripeBrowserEnvironment(browserEnv);
  await runLogged(
    process.execPath,
    [path.join(frontendDir, 'node_modules/@playwright/test/cli.js'), 'test', '--config', config, testSpec],
    browserEnv,
    frontendDir,
    path.join(evidenceDir, 'browser.log'),
    { timeoutMs: PLAYWRIGHT_TIMEOUT_MS, signal },
  );
  requireRuntimeManifestCheckpoint(resources, 'afterBrowserRun');
  const verifyFinancialEvidence =
    scenario === 'mixed-tender' ? verifyMixedTenderFinancialEvidence : verifyStripeFinancialEvidence;
  const proof = await verifyFinancialEvidence({
    runEnv,
    compose: resources.compose,
    evidenceDir,
    browserDir,
    profile,
    origin: stripeOrigin,
    signal,
  });
  const evidenceFields =
    scenario === 'mixed-tender' ? mixedTenderRunEvidenceFields(proof) : stripeRunEvidenceFields(proof);
  if (!evidenceFields.providerCleanupVerified)
    throw new Error('The connected Stripe financial evidence was incomplete.');
  requireRuntimeManifestCheckpoint(resources, 'afterFinancialReadback');
  resources.providerProof = proof;
  resources.scenario = scenario;
  resources.completed = true;
}

async function probeApiHealth(apiOrigin, signal, remaining) {
  try {
    const timeout = AbortSignal.timeout(Math.min(2000, remaining));
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    return (await fetch(`${apiOrigin}/api/health`, { signal: requestSignal })).ok;
  } catch {
    return false;
  }
}

async function finalizeRun(resources, uninstallSignalHandlers) {
  const cleanup = await stopOwnedProcessesAndSnapshot([resources.api, resources.listener], async () => {
    if (resources.nativeServices && resources.evidenceDir)
      return snapshotNativeP11Database(resources.nativeServices, resources.runEnv, resources.evidenceDir, {
        timeoutMs: SNAPSHOT_TIMEOUT_MS,
      });
    if (resources.compose && resources.evidenceDir)
      return snapshotStripeDatabase(resources.compose, resources.runEnv, resources.evidenceDir, {
        timeoutMs: SNAPSHOT_TIMEOUT_MS,
      });
    return undefined;
  });
  const nativeStopFailed = resources.nativeServices
    ? (await stopNativeP11Services(resources.nativeServices)).stopFailed
    : false;
  recordRuntimeManifestCheckpoint(resources, 'afterOwnedServicesStopped');
  const cleanupFailed = cleanup.stopFailed || cleanup.snapshotFailed || nativeStopFailed;
  const snapshotVerified = cleanup.snapshotResult !== undefined;
  const runtimeIntegrityVerified = runtimeManifestEvidence(resources).verified;
  const evidenceFields =
    resources.scenario === 'mixed-tender'
      ? mixedTenderRunEvidenceFields(resources.providerProof)
      : stripeRunEvidenceFields(resources.providerProof);
  try {
    writeSourceEvidenceIfReady(resources);
    if (resources.compose && resources.evidenceDir) {
      profileGuards.writePrivateEvidenceFile(
        resources.evidenceDir,
        'run.json',
        JSON.stringify({
          result:
            resources.completed &&
            snapshotVerified &&
            !cleanupFailed &&
            evidenceFields.providerCleanupVerified &&
            runtimeIntegrityVerified
              ? 'provider-financial-evidence-verified'
              : 'failed',
          onlineProvider: 'stripe-test',
          scenario: resources.scenario ?? 'four-phone',
          databaseRuntime: resources.nativeServices ? 'native-postgres18-redis' : 'compose-postgres16-redis',
          snapshot: cleanup.snapshotResult ?? null,
          sourcePins: resources.sourcePins ?? null,
          runtime: runtimeManifestEvidence(resources),
          ...evidenceFields,
        }),
      );
    }
  } finally {
    uninstallSignalHandlers();
    process.stdout.write(
      `Private Stripe acceptance state retained: ${resources.state ?? 'not-created'}; snapshot verified: ${snapshotVerified}.\n`,
    );
  }
  if (cleanupFailed) throw new Error('Acceptance cleanup or the bounded database snapshot did not complete.');
  requireRuntimeManifestVerified(resources.runtimeCheckpoints, resources.runtimeIntegrityFailed);
}

async function main() {
  const cancellation = new AbortController();
  const uninstallSignalHandlers = installCancellationHandlers(cancellation);
  const resources = {
    signal: cancellation.signal,
    completed: false,
    runtimeCheckpoints: {},
    runtimeIntegrityFailed: false,
  };
  try {
    const runnerConfig = validateRunnerConfiguration();
    resources.scenario = runnerConfig.scenario;
    resources.profile = profileGuards.readStripeProfile(profileFile);
    resources.system = profileGuards.systemEnvironment(process.env);
    resources.state = mkdtempSync(path.join(tmpdir(), 'table-account-p11-stripe-'));
    profileGuards.assertPrivateDirectory(resources.state);
    resources.orchestrationLog = path.join(resources.state, 'orchestration.log');
    const sourcePins = await verifySourcePins(resources);
    resources.sourcePins = sourcePins;
    resources.apiRuntimeDirectory = runnerConfig.apiRuntimeDirectory;
    resources.runtimeCheckpoints = {};
    resources.runtimeIntegrityFailed = false;
    resources.runtimeBaseline = readApiRuntimeManifest(resources.apiRuntimeDirectory);
    resources.runtimeCheckpoints.beforeProviderAccountCheck = runtimeManifestSummary(resources.runtimeBaseline, true);
    await createOwnedStack(resources, runnerConfig, sourcePins);
    await migrateAndSeed(resources, runnerConfig);
    await startBrowserApi(resources, runnerConfig);
  } finally {
    await finalizeRun(resources, uninstallSignalHandlers);
  }
}

await main().catch(() => {
  process.stderr.write(
    'Stripe acceptance stopped; inspect its private run state. No production activity is claimed.\n',
  );
  if (process.exitCode === undefined || process.exitCode === 0) process.exitCode = 1;
});
