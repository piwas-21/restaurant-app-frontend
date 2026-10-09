import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const REQUIRED_FILES = [
  'RestaurantSystem.Api.dll',
  'RestaurantSystem.Api.deps.json',
  'RestaurantSystem.Api.runtimeconfig.json',
  'RestaurantSystem.Domain.dll',
  'RestaurantSystem.Infrastructure.dll',
];
const MANIFEST_FILE_SUFFIXES = ['.dll', '.deps.json', '.runtimeconfig.json'];
const REQUIRED_CHECKPOINTS = [
  'beforeProviderAccountCheck',
  'afterProviderAccountCheck',
  'beforeEfMigration',
  'afterEfMigration',
  'beforeApiStart',
  'afterApiStart',
  'afterBrowserRun',
  'afterFinancialReadback',
  'afterOwnedServicesStopped',
];

function failClosed() {
  throw new Error('The pinned API runtime output is incomplete or unsafe.');
}

function readRegularFile(filename) {
  let descriptor;
  try {
    const linkStat = lstatSync(filename);
    if (!linkStat.isFile() || linkStat.isSymbolicLink()) failClosed();
    descriptor = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.dev !== linkStat.dev || stat.ino !== linkStat.ino || stat.size !== linkStat.size)
      failClosed();
    return readFileSync(descriptor);
  } catch {
    failClosed();
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function collectRuntimeFiles(directory, currentDirectory = directory, files = []) {
  const linkStat = lstatSync(currentDirectory);
  if (!linkStat.isDirectory() || linkStat.isSymbolicLink()) failClosed();
  for (const entry of readdirSync(currentDirectory, { withFileTypes: true }).sort((left, right) =>
    compareText(left.name, right.name),
  )) {
    const filename = path.join(currentDirectory, entry.name);
    const entryStat = lstatSync(filename);
    if (entryStat.isSymbolicLink()) failClosed();
    if (entryStat.isDirectory()) {
      collectRuntimeFiles(directory, filename, files);
      continue;
    }
    if (!entryStat.isFile()) failClosed();
    if (MANIFEST_FILE_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) files.push(filename);
  }
  return files;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function manifestEntry(directory, filename) {
  const bytes = readRegularFile(filename);
  return {
    path: path.relative(directory, filename).split(path.sep).join('/'),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

/** Hash every app-local assembly and the dependency/runtime configuration used by the pinned API. */
export function readApiRuntimeManifest(directory) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) failClosed();
  try {
    const root = path.resolve(directory);
    const rootStat = lstatSync(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) failClosed();

    const filenames = collectRuntimeFiles(root).sort((left, right) =>
      compareText(path.relative(root, left), path.relative(root, right)),
    );
    const entries = filenames.map((filename) => manifestEntry(root, filename));
    const paths = new Set(entries.map((entry) => entry.path));
    if (REQUIRED_FILES.some((filename) => !paths.has(filename))) failClosed();

    const apiAssembly = entries.find((entry) => entry.path === 'RestaurantSystem.Api.dll');
    const digest = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
    return Object.freeze({
      digest,
      apiAssemblySha256: apiAssembly.sha256,
      fileCount: entries.length,
      entries: Object.freeze(entries),
    });
  } catch {
    failClosed();
  }
}

export function sameApiRuntimeManifest(expected, actual) {
  return Boolean(
    expected &&
    actual &&
    typeof expected.digest === 'string' &&
    expected.digest === actual.digest &&
    expected.apiAssemblySha256 === actual.apiAssemblySha256,
  );
}

export function isRuntimeManifestVerified(checkpoints, integrityFailed = false) {
  return Boolean(
    !integrityFailed && REQUIRED_CHECKPOINTS.every((checkpoint) => checkpoints?.[checkpoint]?.matchesBaseline === true),
  );
}

export function requireRuntimeManifestVerified(checkpoints, integrityFailed = false) {
  if (!isRuntimeManifestVerified(checkpoints, integrityFailed))
    throw new Error('The pinned API runtime integrity was not verified.');
}

export function resolveApiRuntimeDirectory(apiProject) {
  if (typeof apiProject !== 'string' || !path.isAbsolute(apiProject)) failClosed();
  const project = readRegularFile(apiProject).toString('utf8');
  const frameworks = [...project.matchAll(/<TargetFramework>\s*(net[0-9]+\.[0-9]+)\s*<\/TargetFramework>/g)];
  if (frameworks.length !== 1) failClosed();
  return path.join(path.dirname(apiProject), 'bin', 'Debug', frameworks[0][1]);
}

export function buildEfDatabaseUpdateArgs(infrastructureProject, apiProject) {
  if (!path.isAbsolute(infrastructureProject) || !path.isAbsolute(apiProject)) failClosed();
  return [
    'ef',
    'database',
    'update',
    '--project',
    infrastructureProject,
    '--startup-project',
    apiProject,
    '--no-build',
  ];
}
