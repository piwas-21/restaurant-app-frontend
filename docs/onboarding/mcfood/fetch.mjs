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
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const BASE = 'https://mcdoner-orchamps.fr';
const RESTAURANT_ID = 17;
const OUT = process.argv[2] ?? 'out';

const getJson = async (p) => {
  const res = await fetch(`${BASE}${p}`);
  if (!res.ok) throw new Error(`GET ${p} -> ${res.status}`);
  return res.json();
};

/** Their storage endpoint answers `image/jpeg` for every object regardless of the real
 *  format, so the extension must come from the bytes. PNG/WebP/AVIF all appear in this set. */
const sniff = (buf) => {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (buf.subarray(4, 8).toString() === 'ftyp') return buf.subarray(8, 24).includes('avif') ? 'avif' : 'heic';
  if (buf.subarray(0, 3).toString() === 'GIF') return 'gif';
  return 'bin';
};

const slug = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'x';

const main = async () => {
  await mkdir(path.join(OUT, 'raw'), { recursive: true });

  const restaurant = await getJson(`/api/restaurants/${RESTAURANT_ID}`);
  const categories = await getJson(`/api/restaurants/${RESTAURANT_ID}/categories`);
  const products = await getJson(`/api/restaurants/${RESTAURANT_ID}/products`);
  const tables = await getJson(`/api/restaurants/${RESTAURANT_ID}/tables`);
  const deliveryZones = await getJson(`/api/restaurants/${RESTAURANT_ID}/delivery-zones`);
  const garnish = await getJson('/api/public/site-garnish');

  const modifiers = {};
  for (const p of products) {
    modifiers[p.id] = await getJson(`/api/restaurants/${RESTAURANT_ID}/products/${p.id}/modifier-groups`);
    await new Promise((r) => setTimeout(r, 150)); // be a polite guest on a partner's box
  }

  const raw = { restaurant, categories, products, tables, deliveryZones, garnish, modifiers };
  for (const [name, value] of Object.entries(raw)) {
    await writeFile(path.join(OUT, 'raw', `${name}.json`), JSON.stringify(value, null, 2));
  }

  // ── images ────────────────────────────────────────────────────────────────
  const roles = new Map();
  const add = (url, role) => {
    if (typeof url === 'string' && url.startsWith('/api/storage')) {
      roles.set(url, [...(roles.get(url) ?? []), role]);
    }
  };
  add(restaurant.logoUrl, 'logo');
  const home = restaurant.siteSettings?.home ?? {};
  (home.heroImages ?? []).forEach((u) => add(u, 'hero-desktop'));
  (home.heroImagesMobile ?? []).forEach((u) => add(u, 'hero-mobile'));
  (home.gallery ?? []).forEach((u) => add(u, 'gallery'));
  add(home.aboutImage, 'about');
  (garnish.images ?? []).forEach((u) => add(u, 'site-garnish'));
  categories.forEach((c) => add(c.imageUrl, `category:${c.id}:${c.name}`));
  products.forEach((p) => add(p.imageUrl, `product:${p.id}:${p.name}`));

  const assets = [];
  for (const [url, rs] of roles) {
    const res = await fetch(`${BASE}${url}`);
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = sniff(buf);
    const id = url.split('/').pop();
    const [kind, refId, name] = rs[0].split(':');
    const file =
      kind === 'logo'
        ? `logo/logo.${ext}`
        : kind.startsWith('hero')
          ? `hero/${kind}-${id.slice(0, 8)}.${ext}`
          : kind === 'site-garnish'
            ? `site-garnish/${id.slice(0, 8)}.${ext}`
            : kind === 'category'
              ? `categories/${refId}-${slug(name)}.${ext}`
              : kind === 'product'
                ? `products/${refId}-${slug(name)}.${ext}`
                : `${id}.${ext}`;
    const dest = path.join(OUT, 'assets', file);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    assets.push({
      objectPath: url,
      file,
      format: ext,
      bytes: buf.length,
      sha256: createHash('sha256').update(buf).digest('hex'),
      roles: rs,
    });
  }
  assets.sort((a, b) => a.file.localeCompare(b.file));

  await writeFile(
    path.join(OUT, 'assets-manifest.json'),
    JSON.stringify(
      {
        source: BASE,
        fetchedAt: new Date().toISOString().slice(0, 10),
        count: assets.length,
        totalBytes: assets.reduce((n, a) => n + a.bytes, 0),
        distinctContent: new Set(assets.map((a) => a.sha256)).size,
        assets,
      },
      null,
      2,
    ),
  );

  console.log(`${products.length} products, ${categories.length} categories, ${assets.length} assets -> ${OUT}/`);

  // Compare against the committed manifest when it is beside this script.
  try {
    const ref = JSON.parse(await readFile(new URL('./assets-manifest.json', import.meta.url), 'utf8'));
    const refBy = new Map(ref.assets.map((a) => [a.objectPath, a.sha256]));
    const changed = assets.filter((a) => refBy.has(a.objectPath) && refBy.get(a.objectPath) !== a.sha256);
    const added = assets.filter((a) => !refBy.has(a.objectPath));
    const removed = ref.assets.filter((a) => !assets.some((x) => x.objectPath === a.objectPath));
    console.log(
      changed.length || added.length || removed.length
        ? `drift vs committed manifest: ${changed.length} changed, ${added.length} added, ${removed.length} removed`
        : 'matches the committed manifest exactly',
    );
  } catch {
    /* no reference manifest beside the script — nothing to compare */
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
