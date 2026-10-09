import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildEfDatabaseUpdateArgs,
  isRuntimeManifestVerified,
  readApiRuntimeManifest,
  requireRuntimeManifestVerified,
  resolveApiRuntimeDirectory,
  sameApiRuntimeManifest,
} from './e2e-p11-stripe-runtime-manifest.mjs';

function createRuntimeFixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'p11-runtime-manifest-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [filename, contents] of [
    ['RestaurantSystem.Api.dll', 'api-v1'],
    ['RestaurantSystem.Api.deps.json', '{"api":true}'],
    ['RestaurantSystem.Api.runtimeconfig.json', '{"framework":"net10.0"}'],
    ['RestaurantSystem.Domain.dll', 'domain-v1'],
    ['RestaurantSystem.Infrastructure.dll', 'infrastructure-v1'],
    ['Microsoft.Extensions.DependencyInjection.dll', 'dependency-v1'],
  ])
    writeFileSync(path.join(root, filename), contents);
  return root;
}

test('manifests every app assembly and API dependency/runtime configuration deterministically', (t) => {
  const runtime = createRuntimeFixture(t);
  const first = readApiRuntimeManifest(runtime);
  const second = readApiRuntimeManifest(runtime);

  assert.equal(first.digest, second.digest);
  assert.equal(first.apiAssemblySha256.length, 64);
  assert.deepEqual(
    first.entries.map((entry) => entry.path),
    [
      'Microsoft.Extensions.DependencyInjection.dll',
      'RestaurantSystem.Api.deps.json',
      'RestaurantSystem.Api.dll',
      'RestaurantSystem.Api.runtimeconfig.json',
      'RestaurantSystem.Domain.dll',
      'RestaurantSystem.Infrastructure.dll',
    ],
  );
  assert.equal(sameApiRuntimeManifest(first, second), true);
});

test('fails closed when a required application assembly is missing', (t) => {
  const runtime = createRuntimeFixture(t);
  rmSync(path.join(runtime, 'RestaurantSystem.Infrastructure.dll'));

  assert.throws(() => readApiRuntimeManifest(runtime), /pinned API runtime output is incomplete or unsafe/);
});

test('detects a changed dependency assembly against the preflight manifest', (t) => {
  const runtime = createRuntimeFixture(t);
  const before = readApiRuntimeManifest(runtime);
  writeFileSync(path.join(runtime, 'Microsoft.Extensions.DependencyInjection.dll'), 'dependency-v2');
  const after = readApiRuntimeManifest(runtime);

  assert.equal(sameApiRuntimeManifest(before, after), false);
  assert.notEqual(before.digest, after.digest);
});

test('detects a changed API assembly hash against the preflight manifest', (t) => {
  const runtime = createRuntimeFixture(t);
  const before = readApiRuntimeManifest(runtime);
  writeFileSync(path.join(runtime, 'RestaurantSystem.Api.dll'), 'api-v2');
  const after = readApiRuntimeManifest(runtime);

  assert.equal(sameApiRuntimeManifest(before, after), false);
  assert.notEqual(before.apiAssemblySha256, after.apiAssemblySha256);
});

test('detects nested runtime assembly addition, change, and removal', (t) => {
  const runtime = createRuntimeFixture(t);
  const before = readApiRuntimeManifest(runtime);
  const nestedDirectory = path.join(runtime, 'runtimes', 'osx', 'lib', 'net10.0');
  const nestedAssembly = path.join(nestedDirectory, 'NativeDependency.dll');
  mkdirSync(nestedDirectory, { recursive: true });
  writeFileSync(nestedAssembly, 'nested-v1');
  const added = readApiRuntimeManifest(runtime);
  writeFileSync(nestedAssembly, 'nested-v2');
  const changed = readApiRuntimeManifest(runtime);
  unlinkSync(nestedAssembly);
  const removed = readApiRuntimeManifest(runtime);

  assert.equal(sameApiRuntimeManifest(before, added), false);
  assert.equal(sameApiRuntimeManifest(added, changed), false);
  assert.equal(sameApiRuntimeManifest(before, removed), true);
});

test('rejects symbolic links in the prebuilt runtime directory', (t) => {
  const runtime = createRuntimeFixture(t);
  const target = path.join(runtime, 'RestaurantSystem.Domain.dll');
  const link = path.join(runtime, 'Untrusted.dll');
  rmSync(target);
  symlinkSync(path.join(runtime, 'RestaurantSystem.Api.dll'), target);
  symlinkSync(target, link);

  assert.throws(() => readApiRuntimeManifest(runtime), /pinned API runtime output is incomplete or unsafe/);
});

test('pins the exact net10 Debug output selected by the no-build API launch', (t) => {
  const projectDirectory = mkdtempSync(path.join(tmpdir(), 'p11-api-project-'));
  t.after(() => rmSync(projectDirectory, { recursive: true, force: true }));
  const apiProject = path.join(projectDirectory, 'RestaurantSystem.Api.csproj');
  writeFileSync(
    apiProject,
    '<Project><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>',
  );

  assert.equal(resolveApiRuntimeDirectory(apiProject), path.join(projectDirectory, 'bin', 'Debug', 'net10.0'));
});

test('always disables EF builds and rejects non-absolute project inputs', () => {
  assert.deepEqual(buildEfDatabaseUpdateArgs('/backend/Infrastructure.csproj', '/backend/Api.csproj'), [
    'ef',
    'database',
    'update',
    '--project',
    '/backend/Infrastructure.csproj',
    '--startup-project',
    '/backend/Api.csproj',
    '--no-build',
  ]);
  assert.throws(() => buildEfDatabaseUpdateArgs('relative.csproj', '/backend/Api.csproj'));
});

test('rejects ambiguous or missing target framework metadata', (t) => {
  const projectDirectory = mkdtempSync(path.join(tmpdir(), 'p11-api-project-'));
  t.after(() => rmSync(projectDirectory, { recursive: true, force: true }));
  const apiProject = path.join(projectDirectory, 'RestaurantSystem.Api.csproj');
  writeFileSync(
    apiProject,
    '<Project><PropertyGroup><TargetFramework>net10.0</TargetFramework><TargetFramework>net9.0</TargetFramework></PropertyGroup></Project>',
  );

  assert.throws(() => resolveApiRuntimeDirectory(apiProject), /pinned API runtime output is incomplete or unsafe/);
});

test('requires every runtime checkpoint, including the final post-shutdown manifest, to verify', () => {
  const checkpoints = Object.fromEntries(
    [
      'beforeProviderAccountCheck',
      'afterProviderAccountCheck',
      'beforeEfMigration',
      'afterEfMigration',
      'beforeApiStart',
      'afterApiStart',
      'afterBrowserRun',
      'afterFinancialReadback',
      'afterOwnedServicesStopped',
    ].map((name) => [name, { matchesBaseline: true }]),
  );

  assert.equal(isRuntimeManifestVerified(checkpoints), true);
  checkpoints.afterOwnedServicesStopped.matchesBaseline = false;
  assert.equal(isRuntimeManifestVerified(checkpoints), false);
  assert.throws(() => requireRuntimeManifestVerified(checkpoints), /integrity was not verified/);
  assert.throws(() => requireRuntimeManifestVerified({}), /integrity was not verified/);
});
