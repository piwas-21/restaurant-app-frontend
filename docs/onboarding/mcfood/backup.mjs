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
 *   node backup.mjs --out /path/to/private/mcfood-rollback-YYYYMMDDTHHMMSSZ
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const BASE = 'https://mcdoner.solutioneva.com';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const EXPECTED_UNION = 126;
const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};
const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, 'Z');
const outDir = path.resolve(arg('--out', path.join(process.cwd(), '.local', `mcfood-rollback-${stamp}`)));

const getJson = async (endpoint) => {
  const response = await fetch(`${BASE}${endpoint}`);
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
const writeJson = async (file, value) => {
  const bytes = jsonBytes(value);
  await writeFile(file, bytes);
  return { path: path.relative(outDir, file), bytes: bytes.length, sha256: sha256(bytes) };
};

const main = async () => {
  await mkdir(path.join(outDir, 'raw'), { recursive: true });
  await mkdir(path.join(outDir, 'details'), { recursive: true });

  const [productsResponse, menusResponse, categoriesResponse] = await Promise.all([
    getJson('/api/Products?PageSize=500&IncludeComponents=true'),
    getJson('/api/Menus?PageSize=500'),
    getJson('/api/Categories?PageSize=500'),
  ]);
  const products = itemsOf(productsResponse, '/api/Products');
  const menus = itemsOf(menusResponse, '/api/Menus');
  const categories = itemsOf(categoriesResponse, '/api/Categories');
  const drinkCategories = categories.filter((category) => /boisson/i.test(category.name ?? ''));
  if (drinkCategories.length !== 1) {
    throw new Error(`expected exactly one BOISSONS category, found ${drinkCategories.length}`);
  }
  const drinksEndpoint = `/api/Products?PageSize=500&CategoryId=${drinkCategories[0].id}`;
  const beveragesResponse = await getJson(drinksEndpoint);
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
    rawFiles.push(await writeJson(path.join(outDir, 'raw', name), body));
  }

  const detailRecords = [...products, ...beverages];
  const detailFiles = [];
  for (const record of detailRecords) {
    const endpoint = `/api/Products/${record.id}`;
    const body = await getJson(endpoint);
    detailFiles.push(await writeJson(path.join(outDir, 'details', `${record.id}.json`), body));
  }

  const manifestBody = {
    schema: 1,
    capturedAtUtc: new Date().toISOString(),
    source: BASE,
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
  const manifestFile = await writeJson(path.join(outDir, 'manifest.json'), manifest);
  const checksums =
    [...rawFiles, ...detailFiles, manifestFile].map((file) => `${file.sha256}  ${file.path}`).join('\n') + '\n';
  await writeFile(path.join(outDir, 'SHA256SUMS'), checksums);

  console.log(`captured ${records.length} unique records into ${outDir}`);
  console.log(
    `products=${manifest.counts.products} components=${manifest.counts.components} ` +
      `beverages=${manifest.counts.beverages} menus=${manifest.counts.menus} union=${manifest.counts.union}`,
  );
  console.log(`Ayran and Red Bull: present; restore location: ${outDir}`);
};

await main();
