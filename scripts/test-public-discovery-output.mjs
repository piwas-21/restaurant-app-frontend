#!/usr/bin/env node
// Builds the actual production app, then checks HTTP output against independent API fixtures.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFixtureApi, CANONICAL_ORIGIN } from './public-discovery-fixture.mjs';
import { assertScenario, assertSitemap } from './public-discovery-output-assertions.mjs';
import { browserContract, edgeBrowserContract } from './public-discovery-browser-assertions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexing = !process.argv.includes('--noindex');
const template = process.env.NEXT_PUBLIC_TEMPLATE || 'classic';
const api = await startFixtureApi();
const environment = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: '1',
  API_INTERNAL_URL: `${api.origin}/complete`,
  NEXT_PUBLIC_API_URL: `${api.origin}/complete`,
  NEXT_PUBLIC_IMAGE_BASE_URL: api.origin,
  NEXT_PUBLIC_TENANT_CANONICAL_ORIGIN: CANONICAL_ORIGIN,
  NEXT_PUBLIC_PUBLIC_DEFAULT_LOCALE: 'fr',
  NEXT_PUBLIC_PUBLIC_HOME_LOCALES: 'fr,en,tr,ar',
  NEXT_PUBLIC_PUBLIC_MENU_LOCALES: 'fr,en,tr,ar',
  NEXT_PUBLIC_PUBLIC_INDEXING_ENABLED: String(indexing),
  NEXT_PUBLIC_RESTAURANT_NAME: 'Fixture Restaurant',
  NEXT_PUBLIC_TEMPLATE: template,
  NEXT_PUBLIC_TENANT_COPY_PACK: '',
  NEXT_PUBLIC_TENANT_CURRENCY: 'CHF',
  NEXT_PUBLIC_TENANT_LOCALE: 'fr-CH',
};

async function unusedPort() {
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}
async function build() {
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
    cwd: root,
    env: environment,
    stdio: 'inherit',
  });
  const code = await new Promise((resolve) => child.once('exit', resolve));
  assert.equal(code, 0, 'Production fixture build must succeed');
}
async function standalone(directory, depth = 0) {
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.some((entry) => entry.name === 'server.js' && entry.isFile())) return path.join(directory, 'server.js');
  if (depth < 5)
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        const found = await standalone(path.join(directory, entry.name), depth + 1);
        if (found) return found;
      }
    }
  return null;
}
async function serve(serverFile, scenario) {
  const port = await unusedPort();
  const child = spawn(process.execPath, [serverFile], {
    cwd: path.dirname(serverFile),
    env: { ...environment, API_INTERNAL_URL: `${api.origin}/${scenario}`, HOSTNAME: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostics = '';
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (chunk) => {
      diagnostics = (diagnostics + chunk).slice(-20_000);
    });
  // Next normalizes loopback redirects to localhost; keep navigation/storage on that origin.
  const origin = `http://localhost:${port}`;
  try {
    const deadline = Date.now() + 30_000;
    while (true) {
      if (child.exitCode !== null) throw new Error(`Fixture server exited: ${diagnostics}`);
      try {
        if ((await fetch(`${origin}/robots.txt`)).ok) break;
      } catch {
        /* readiness only */
      }
      if (Date.now() > deadline) throw new Error(`Fixture server timed out: ${diagnostics}`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return {
      origin,
      diagnostics: () => diagnostics,
      close: async () => {
        if (child.exitCode === null) {
          const exited = new Promise((resolve) => child.once('exit', resolve));
          child.kill('SIGTERM');
          await exited;
        }
      },
    };
  } catch (error) {
    child.kill('SIGTERM');
    throw error;
  }
}

try {
  await build();
  const serverFile = await standalone(path.join(root, '.next', 'standalone'));
  assert.ok(serverFile, 'Next standalone server exists');
  await cp(path.join(root, 'public'), path.join(path.dirname(serverFile), 'public'), { recursive: true });
  await cp(path.join(root, '.next', 'static'), path.join(path.dirname(serverFile), '.next', 'static'), {
    recursive: true,
  });
  const scenarios = indexing
    ? [
        'complete',
        'missing',
        'repeated',
        'unknown',
        'override',
        'onepage',
        'bundles',
        'offers',
        'offers-onepage',
        'categories-fail',
      ]
    : ['complete'];
  for (const scenario of scenarios) {
    const server = await serve(serverFile, scenario);
    try {
      await assertScenario(server.origin, scenario, indexing);
      await assertSitemap(server.origin, scenario, indexing);
      const browserChecked =
        !process.argv.includes('--http-only') &&
        ['complete', 'offers', 'offers-onepage', 'categories-fail', 'override'].includes(scenario);
      if (browserChecked && scenario === 'complete')
        await browserContract(server.origin, { root, template, indexing, apiOrigin: api.origin });
      else if (browserChecked) await edgeBrowserContract(server.origin, scenario, api);
      console.log(
        `PASS ${template} ${scenario} (${indexing ? 'indexing' : 'noindex'}) raw HTML/XML${browserChecked ? ' and browser contract' : ''}`,
      );
    } catch (error) {
      console.error(server.diagnostics());
      throw error;
    } finally {
      await server.close();
    }
  }
  assert.ok(
    api.calls.some((call) => call.path === '/api/Products' && call.query.includes('CategoryId=')),
    'Real category-filtered contract exercised',
  );
  assert.ok(
    api.calls.some((call) => call.path === '/api/Products' && call.query.includes('Page=2')),
    'Catalogue tail actually fetched',
  );
} finally {
  await api.close();
}
