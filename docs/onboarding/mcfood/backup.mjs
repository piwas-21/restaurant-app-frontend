#!/usr/bin/env node
/**
 * Capture a rollback-safe MC FOOD catalogue from public GETs.
 *
 * This writes raw responses only to the operator-provided (or .local) directory. The committed
 * rollback-manifest.json is metadata/checksum evidence; raw payloads and tokens never belong in
 * git. It deliberately asks for components and BOISSONS separately because the public catalogue
 * list excludes both by default. The two category drinks Ayran and Red Bull are therefore checked
 * explicitly rather than disappearing behind the menu-section references.
 *
 *   node backup.mjs --base-url <https-origin> --out /path/to/private/mcfood-rollback-YYYYMMDDTHHMMSSZ
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXPECTED_UNION = 126;
export const USAGE = `Usage: node backup.mjs --base-url <https-origin> [--out <private-directory>]

The base URL must be an https origin without credentials, a path, query, or hash.
Alternatively set MCFOOD_BASE_URL.`;

const optionValue = (argv, index, name) => {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
};

/** Validate an API origin before any output directory is created or network call is made. */
export const validateBaseUrl = (candidate, source = 'base URL') => {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.trim() !== candidate) {
    throw new Error(`${source} must be an https origin without credentials, path, query, or hash`);
  }
  // Check the raw spelling too: URL normalises dot-segments such as `/../` to `/`, but those
  // are still paths and must not turn into an accepted origin.
  if (!/^https:\/\/[^/?#\\]+\/?$/i.test(candidate)) {
    throw new Error(`${source} must be an https origin without credentials, path, query, or hash`);
  }
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`${source} must be an https origin without credentials, path, query, or hash`);
  }
  // URL normalises a bare trailing slash to pathname "/", which is the only path an origin may have.
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    candidate.includes('?') ||
    candidate.includes('#')
  ) {
    throw new Error(`${source} must be an https origin without credentials, path, query, or hash`);
  }
  return url.origin.replace(/\/$/, '');
};

/** Parse only the options this capture accepts; unknown or repeated options fail closed. */
export const parseArguments = (argv, env = process.env) => {
  let baseCandidate;
  let baseSource;
  let out;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--base-url') {
      if (baseSource) throw new Error('--base-url may be supplied only once');
      baseCandidate = optionValue(argv, index, '--base-url');
      baseSource = 'the --base-url value';
      index += 1;
    } else if (argument.startsWith('--base-url=')) {
      if (baseSource) throw new Error('--base-url may be supplied only once');
      baseCandidate = argument.slice('--base-url='.length);
      if (!baseCandidate) throw new Error('--base-url requires a value');
      baseSource = 'the --base-url value';
    } else if (argument === '--out') {
      if (out !== undefined) throw new Error('--out may be supplied only once');
      out = optionValue(argv, index, '--out');
      index += 1;
    } else if (argument.startsWith('--out=')) {
      if (out !== undefined) throw new Error('--out may be supplied only once');
      out = argument.slice('--out='.length);
      if (!out) throw new Error('--out requires a value');
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  const source = baseSource ?? 'MCFOOD_BASE_URL';
  const candidate = baseCandidate ?? env?.MCFOOD_BASE_URL;
  if (candidate === undefined || candidate === '') {
    throw new Error('provide --base-url or set MCFOOD_BASE_URL');
  }
  return { baseUrl: validateBaseUrl(candidate, source), out };
};

const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, 'Z');

const getJson = async (baseUrl, endpoint) => {
  const response = await fetch(`${baseUrl}${endpoint}`);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${endpoint}: HTTP ${response.status}, non-JSON body`);
  }
  if (!response.ok || body.success === false) {
    throw new Error(`${endpoint}: HTTP ${response.status} — ${body.errors?.[0] ?? body.message ?? 'request failed'}`);
  }
  return body;
};

const itemsOf = (body, endpoint) => {
  const items = body?.data?.items;
  if (!Array.isArray(items)) throw new Error(`${endpoint}: response has no data.items array`);
  return items;
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const writeJson = async (root, file, value) => {
  const bytes = jsonBytes(value);
  await writeFile(file, bytes);
  return { path: path.relative(root, file), bytes: bytes.length, sha256: sha256(bytes) };
};

export const main = async ({ argv = process.argv.slice(2), env = process.env } = {}) => {
  let options;
  try {
    options = parseArguments(argv, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`backup: ${message}\n\n${USAGE}`);
    return false;
  }
  const { baseUrl } = options;
  const outDir = path.resolve(options.out ?? path.join(process.cwd(), '.local', `mcfood-rollback-${stamp}`));
  await mkdir(path.join(outDir, 'raw'), { recursive: true });
  await mkdir(path.join(outDir, 'details'), { recursive: true });

  const [productsResponse, menusResponse, categoriesResponse] = await Promise.all([
    getJson(baseUrl, '/api/Products?PageSize=500&IncludeComponents=true'),
    getJson(baseUrl, '/api/Menus?PageSize=500'),
    getJson(baseUrl, '/api/Categories?PageSize=500'),
  ]);
  const products = itemsOf(productsResponse, '/api/Products');
  const menus = itemsOf(menusResponse, '/api/Menus');
  const categories = itemsOf(categoriesResponse, '/api/Categories');
  const drinkCategories = categories.filter((category) => /boisson/i.test(category.name ?? ''));
  if (drinkCategories.length !== 1) {
    throw new Error(`expected exactly one BOISSONS category, found ${drinkCategories.length}`);
  }
  const drinksEndpoint = `/api/Products?PageSize=500&CategoryId=${drinkCategories[0].id}`;
  const beveragesResponse = await getJson(baseUrl, drinksEndpoint);
  const beverages = itemsOf(beveragesResponse, drinksEndpoint);

  const records = [
    ...products.map((record) => ({ kind: record.isComponent ? 'component' : 'product', record })),
    ...menus.map((record) => ({ kind: 'menu', record })),
    ...beverages.map((record) => ({ kind: 'beverage', record })),
  ];
  const ids = new Map();
  for (const { kind, record } of records) {
    const previous = ids.get(record.id);
    if (previous) throw new Error(`record ${record.id} appears as both ${previous} and ${kind}`);
    ids.set(record.id, kind);
  }
  const expectedNames = ['Ayran', 'Red Bull'];
  for (const name of expectedNames) {
    if (!beverages.some((record) => record.name === name && record.type === 'beverage')) {
      throw new Error(`BOISSONS endpoint is missing expected beverage ${name}`);
    }
  }
  if (records.length !== EXPECTED_UNION) {
    throw new Error(
      `expected ${EXPECTED_UNION} unique records, found ${records.length} ` +
        `(products ${products.length}, components ${products.filter((p) => p.isComponent).length}, ` +
        `beverages ${beverages.length}, menus ${menus.length})`,
    );
  }

  const rawFiles = [];
  for (const [name, body] of [
    ['products.json', productsResponse],
    ['menus.json', menusResponse],
    ['categories.json', categoriesResponse],
    ['beverages.json', beveragesResponse],
  ]) {
    rawFiles.push(await writeJson(outDir, path.join(outDir, 'raw', name), body));
  }

  const detailRecords = [...products, ...beverages];
  const detailFiles = [];
  for (const record of detailRecords) {
    const endpoint = `/api/Products/${record.id}`;
    const body = await getJson(baseUrl, endpoint);
    detailFiles.push(await writeJson(outDir, path.join(outDir, 'details', `${record.id}.json`), body));
  }

  const manifestBody = {
    schema: 1,
    capturedAtUtc: new Date().toISOString(),
    source: baseUrl,
    restoreLocation: outDir,
    originalScopedPreChangeBackup: path.resolve(
      HERE,
      '../../../../docs/tenants/mcfood/backup-20260913T211924Z-pre-feedback',
    ),
    expectedUnion: EXPECTED_UNION,
    counts: {
      products: products.filter((record) => !record.isComponent).length,
      components: products.filter((record) => record.isComponent).length,
      beverages: beverages.length,
      menus: menus.length,
      union: records.length,
    },
    endpoints: {
      products: '/api/Products?PageSize=500&IncludeComponents=true',
      menus: '/api/Menus?PageSize=500',
      beverages: drinksEndpoint,
      categories: '/api/Categories?PageSize=500',
    },
    records: records.map(({ kind, record }) => ({
      kind,
      id: record.id,
      name: record.name,
      type: record.type,
      isComponent: record.isComponent === true,
    })),
    rawFiles,
    detailFiles,
  };
  const manifestBytes = jsonBytes(manifestBody);
  const manifest = { ...manifestBody, manifestSha256: sha256(manifestBytes) };
  const manifestFile = await writeJson(outDir, path.join(outDir, 'manifest.json'), manifest);
  const checksums =
    [...rawFiles, ...detailFiles, manifestFile].map((file) => `${file.sha256}  ${file.path}`).join('\n') + '\n';
  await writeFile(path.join(outDir, 'SHA256SUMS'), checksums);

  console.log(`captured ${records.length} unique records into ${outDir}`);
  console.log(
    `products=${manifest.counts.products} components=${manifest.counts.components} ` +
      `beverages=${manifest.counts.beverages} menus=${manifest.counts.menus} union=${manifest.counts.union}`,
  );
  console.log(`Ayran and Red Bull: present; restore location: ${outDir}`);
  return true;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ok = await main();
  if (ok === false) process.exitCode = 1;
}
