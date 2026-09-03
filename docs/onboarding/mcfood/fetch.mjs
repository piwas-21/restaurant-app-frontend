#!/usr/bin/env node
/**
 * Re-fetch the MC FOOD (mcdoner-orchamps.fr) tenant data + assets for onboarding.
 *
 * Only PUBLIC, unauthenticated endpoints are used — the same ones a guest browsing
 * their site hits. Nothing here logs in or touches their /api/admin or /api/superadmin
 * routes. Their temporary site is a Vite SPA over a REST API; `resolve` maps the domain
 * to restaurant id 17 / slug `mcfood`.
 *
 * Usage:  node fetch.mjs [outDir]     (default outDir: ./out)
 *
 * Writes:
 *   <outDir>/raw/*.json        verbatim API responses
 *   <outDir>/assets/**         images, named by role, extension from real magic bytes
 *   <outDir>/assets-manifest.json
 *
 * The images are NOT committed to this repo: 9 of the 94 exceed the 1 MB
 * `check-added-large-files` pre-commit limit and the set totals ~31 MB. Run this to
 * materialise them. Verify against the committed assets-manifest.json (sha256 per file).
 *
 * Every path this writes is confined to `outDir` and re-checked after joining, because two
 * of the components are untrusted: `outDir` is an argv string, and asset filenames are
 * built from category/product names THEIR API supplies.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const BASE = 'https://mcdoner-orchamps.fr';
const RESTAURANT_ID = 17;

const getJson = async (endpoint) => {
  const res = await fetch(`${BASE}${endpoint}`);
  if (!res.ok) throw new Error(`GET ${endpoint} -> ${res.status}`);
  return res.json();
};

const getBuffer = async (endpoint) => {
  const res = await fetch(`${BASE}${endpoint}`);
  if (!res.ok) throw new Error(`GET ${endpoint} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

/**
 * Resolve a path INSIDE `root`, refusing anything that escapes it. Applied to the argv
 * outDir and again to every asset filename, so neither an argument like `../../etc` nor a
 * hostile product name from their API can write outside the output tree.
 */
const confine = (root, ...segments) => {
  const resolved = path.resolve(root, ...segments);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('refusing to write outside the output directory');
  }
  return resolved;
};

/** Their storage endpoint answers `image/jpeg` for every object regardless of the real
 *  format, so the extension must come from the bytes. PNG/WebP/AVIF all appear in this set. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const sniff = (buf) => {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.subarray(0, 8).equals(PNG_MAGIC)) return 'png';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (buf.subarray(4, 8).toString() === 'ftyp') return buf.subarray(8, 24).includes('avif') ? 'avif' : 'heic';
  if (buf.subarray(0, 3).toString() === 'GIF') return 'gif';
  return 'bin';
};

const slug = (value) =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'x';

/** Where an object lands, by the role that referenced it. Named parts only — see `confine`. */
const assetFileName = (role, objectId, ext) => {
  const [kind, refId, name] = role.split(':');
  if (kind === 'logo') return `logo/logo.${ext}`;
  if (kind.startsWith('hero')) return `hero/${kind}-${objectId.slice(0, 8)}.${ext}`;
  if (kind === 'site-garnish') return `site-garnish/${objectId.slice(0, 8)}.${ext}`;
  if (kind === 'category') return `categories/${refId}-${slug(name)}.${ext}`;
  if (kind === 'product') return `products/${refId}-${slug(name)}.${ext}`;
  return `${objectId}.${ext}`;
};

/** Every storage object the site references, mapped to the roles that reference it. */
const collectImageRoles = ({ restaurant, categories, products, garnish }) => {
  const roles = new Map();
  const add = (url, role) => {
    if (typeof url === 'string' && url.startsWith('/api/storage')) {
      roles.set(url, [...(roles.get(url) ?? []), role]);
    }
  };
  const home = restaurant.siteSettings?.home ?? {};
  add(restaurant.logoUrl, 'logo');
  for (const url of home.heroImages ?? []) add(url, 'hero-desktop');
  for (const url of home.heroImagesMobile ?? []) add(url, 'hero-mobile');
  for (const url of home.gallery ?? []) add(url, 'gallery');
  add(home.aboutImage, 'about');
  for (const url of garnish.images ?? []) add(url, 'site-garnish');
  for (const category of categories) add(category.imageUrl, `category:${category.id}:${category.name}`);
  for (const product of products) add(product.imageUrl, `product:${product.id}:${product.name}`);
  return roles;
};

const fetchTenant = async () => {
  const [restaurant, categories, products, tables, deliveryZones, garnish] = await Promise.all([
    getJson(`/api/restaurants/${RESTAURANT_ID}`),
    getJson(`/api/restaurants/${RESTAURANT_ID}/categories`),
    getJson(`/api/restaurants/${RESTAURANT_ID}/products`),
    getJson(`/api/restaurants/${RESTAURANT_ID}/tables`),
    getJson(`/api/restaurants/${RESTAURANT_ID}/delivery-zones`),
    getJson('/api/public/site-garnish'),
  ]);

  const modifiers = {};
  for (const product of products) {
    modifiers[product.id] = await getJson(`/api/restaurants/${RESTAURANT_ID}/products/${product.id}/modifier-groups`);
    await new Promise((resolve) => setTimeout(resolve, 150)); // be a polite guest on a partner's box
  }

  return { restaurant, categories, products, tables, deliveryZones, garnish, modifiers };
};

const writeRaw = async (outDir, raw) => {
  const rawDir = confine(outDir, 'raw');
  await mkdir(rawDir, { recursive: true });
  for (const [name, value] of Object.entries(raw)) {
    await writeFile(confine(rawDir, `${name}.json`), JSON.stringify(value, null, 2));
  }
};

const downloadAssets = async (outDir, roles) => {
  const assetsDir = confine(outDir, 'assets');
  const assets = [];
  for (const [url, assetRoles] of roles) {
    const buf = await getBuffer(url);
    const objectId = url.split('/').pop();
    const file = assetFileName(assetRoles[0], objectId, sniff(buf));
    const dest = confine(assetsDir, file);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    assets.push({
      objectPath: url,
      file,
      format: sniff(buf),
      bytes: buf.length,
      sha256: createHash('sha256').update(buf).digest('hex'),
      roles: assetRoles,
    });
  }
  return assets.sort((a, b) => a.file.localeCompare(b.file));
};

/** Compare against the committed manifest beside this script, when there is one. */
const reportDrift = async (assets) => {
  let reference;
  try {
    reference = JSON.parse(await readFile(new URL('./assets-manifest.json', import.meta.url), 'utf8'));
  } catch (error) {
    console.log(`no reference manifest beside this script, so nothing to compare (${error.code ?? 'unreadable'})`);
    return;
  }
  const referenceBySha = new Map(reference.assets.map((asset) => [asset.objectPath, asset.sha256]));
  const changed = assets.filter(
    (a) => referenceBySha.has(a.objectPath) && referenceBySha.get(a.objectPath) !== a.sha256,
  );
  const added = assets.filter((a) => !referenceBySha.has(a.objectPath));
  const removed = reference.assets.filter((a) => !assets.some((current) => current.objectPath === a.objectPath));
  console.log(
    changed.length || added.length || removed.length
      ? `drift vs committed manifest: ${changed.length} changed, ${added.length} added, ${removed.length} removed`
      : 'matches the committed manifest exactly',
  );
};

const outDir = confine(process.cwd(), process.argv[2] ?? 'out');
const raw = await fetchTenant();
await writeRaw(outDir, raw);

const assets = await downloadAssets(outDir, collectImageRoles(raw));
await writeFile(
  confine(outDir, 'assets-manifest.json'),
  JSON.stringify(
    {
      source: BASE,
      fetchedAt: new Date().toISOString().slice(0, 10),
      count: assets.length,
      totalBytes: assets.reduce((total, asset) => total + asset.bytes, 0),
      distinctContent: new Set(assets.map((asset) => asset.sha256)).size,
      assets,
    },
    null,
    2,
  ),
);

/**
 * Counts reach the log as digits and nothing else. They are derived from THEIR API response, so
 * to a taint analyser they are user-controlled (S5145, log injection); coercing through
 * Number/trunc means a log line cannot carry anything a response body chose.
 */
const count = (value) => Math.max(0, Math.trunc(Number(value) || 0));

console.log(
  `${count(raw.products.length)} products, ${count(raw.categories.length)} categories, ${count(assets.length)} assets written`,
);
await reportDrift(assets);
