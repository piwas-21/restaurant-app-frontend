#!/usr/bin/env node
/**
 * MC FOOD — push the mapped catalogue into a provisioned tenant.
 *
 * The transport half. `map.mjs` decides WHAT to send and can be checked offline; this
 * decides where it goes and in what order, and cannot be fully checked until a tenant
 * exists. Keeping them apart is why the risky arithmetic is already proven.
 *
 *   node import.mjs --base https://mcdoner.sofrapiwas.com --token "$TOKEN" --dry-run
 *   node import.mjs --base https://mcdoner.sofrapiwas.com --token "$TOKEN" --assets ./out/assets
 *
 * ── Auth ─────────────────────────────────────────────────────────────────────────
 *
 * An API token with the `menu:write` scope, minted in the tenant's own admin
 * (`/api/ApiTokens`). One scope covers everything here: `ApiTokenAuthenticationHandler`
 * gives a token the Admin role claim precisely so it satisfies the `[RequireAdmin]` on
 * the image endpoints, and `ApiTokenScopeFilter` still denies it every endpoint not
 * annotated with a scope it holds. So this needs no password and can reach nothing but
 * the menu. Pass it via `--token "$TOKEN"`, never as a literal.
 *
 * ── Re-running ───────────────────────────────────────────────────────────────────
 *
 * A half-finished import is the expected case: 68 products and 94 uploads over a network.
 * So every created id is appended to a state file (`--state`, default
 * `import-state.json`) IMMEDIATELY AFTER the server confirms it, never before and never
 * in a batch at the end. A crashed run therefore reads as "these N are done", and the
 * ones whose confirmation never arrived are simply retried. The opposite — writing the
 * marker first, or flushing at exit — makes a dead run look finished, which is the one
 * outcome nobody notices.
 *
 * A re-run creates nothing that is already in the state file. It does NOT diff against
 * the server: the state file is this script's own record, and reconciling a tenant an
 * operator has since hand-edited is a different job than importing into an empty one.
 */
import { readFile, writeFile, rename, access } from 'node:fs/promises';
import path from 'node:path';
import { build, unbuiltBundlesInUse } from './map.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};

/**
 * The token comes from the ENVIRONMENT by default. `--token "$TOKEN"` expands before exec,
 * so the bearer token is visible in `ps` to every other user on the box and is written to
 * the shell's history file. `--token` is kept only as an escape hatch.
 */
const readToken = () => process.env.MCFOOD_TOKEN || arg('--token');
const flag = (name) => process.argv.includes(name);

/** Their API answers `ApiResponse<T>`: `success` plus `data`, and a FAILURE can be 200. */
const unwrap = async (response, what) => {
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${what}: HTTP ${response.status}, non-JSON body: ${text.slice(0, 200)}`);
  }
  // `ApiResponse.Failure` is served with HTTP 200 and puts the reason in `errors[0]`, so
  // the status code alone cannot decide this. Check the envelope, then the status.
  if (body?.success === false) {
    throw new Error(`${what}: ${body.errors?.[0] ?? body.message ?? 'failed with no reason given'}`);
  }
  if (!response.ok) throw new Error(`${what}: HTTP ${response.status} — ${text.slice(0, 200)}`);
  return body?.data ?? body;
};

const makeClient = ({ base, token, dryRun }) => {
  let dryIds = 0;
  const call = async (method, endpoint, { json, form } = {}, what = `${method} ${endpoint}`) => {
    if (dryRun) {
      const size = form ? '[multipart]' : JSON.stringify(json ?? {}).length + ' bytes';
      console.log(`  DRY  ${method} ${endpoint}  ${size}`);
      // A counter, not Math.random(): nothing here needs randomness, and a deterministic
      // placeholder makes two dry runs diff cleanly against each other.
      dryIds += 1;
      return { id: `dry-${String(dryIds).padStart(4, '0')}` };
    }
    const response = await fetch(`${base}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(json ? { 'Content-Type': 'application/json' } : {}),
      },
      body: form ?? (json ? JSON.stringify(json) : undefined),
    });
    return unwrap(response, what);
  };
  return call;
};

const EMPTY_STATE = { categories: {}, components: {}, products: {}, menus: {}, sections: {}, images: {} };

/**
 * A MISSING state file is a fresh start. A CORRUPT one is an error — the two were the same
 * branch, so a file truncated by a crash mid-write read as "nothing done" and the next run
 * would have re-created all 84 records on top of the ones already there.
 */
const loadState = async (file) => {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return structuredClone(EMPTY_STATE);
    throw error;
  }
  try {
    return { ...structuredClone(EMPTY_STATE), ...JSON.parse(raw) };
  } catch (error) {
    throw new Error(
      `${file} exists but is not valid JSON (${error.message}). It is this run's only record of ` +
        'what was already created — move it aside deliberately rather than letting a re-run ' +
        'duplicate every product.',
    );
  }
};

/**
 * Persist after EVERY confirmation. Slower than one write at the end, and that is the
 * trade being bought: the state file's job is to be correct when the process dies.
 */
const remember = async (file, state, bucket, key, value) => {
  state[bucket][key] = value;
  if (file === null) return; // dry run — see makeClient
  // Write-then-rename. A plain writeFile can be interrupted half-way and leave JSON that
  // parses as nothing; the state file's whole job is to be correct when the process dies.
  await writeFile(`${file}.tmp`, JSON.stringify(state, null, 2));
  await rename(`${file}.tmp`, file);
};

/**
 * A dry run must NOT read the bytes — it is a pre-flight, and one that dies on a missing
 * asset cannot tell you whether the OTHER 93 are present. So it checks existence, counts
 * what is missing, and lets the run finish with a verdict. A real run still fails hard on
 * a missing file: importing a product without its photo is not a warning.
 */
const uploadImage = async (call, method, endpoint, filePath, field, extra = {}, missing = null) => {
  if (missing) {
    try {
      await access(filePath);
    } catch {
      missing.push(path.relative(process.cwd(), filePath));
    }
    return call(method, endpoint, { form: true }, `upload ${path.basename(filePath)}`);
  }
  const bytes = await readFile(filePath);
  const form = new FormData();
  form.set(field, new Blob([bytes]), path.basename(filePath));
  for (const [k, v] of Object.entries(extra)) form.set(k, String(v));
  return call(method, endpoint, { form }, `upload ${path.basename(filePath)}`);
};

/**
 * The refusals, in one place. Both are fail-closed and both have an escape hatch, because a
 * gate with no way past it gets routed around rather than satisfied — but each hatch turns
 * off exactly one check, never both.
 */
const refuseIfNotReady = (dataset, decisions, products, menus) => {
  // The same derivation map.mjs uses: which groups actually reached a section, read back
  // out of the OUTPUT. Deriving it from the payloads rather than from the decisions is the
  // point — a group that silently stopped being mapped shows up as unbuilt.
  const built = new Set([...products, ...menus].flatMap((p) => (p.sections ?? []).map((section) => section.__groupId)));
  const unbuilt = unbuiltBundlesInUse(dataset, decisions, built);
  if (unbuilt.length && !flag('--allow-unbuilt')) {
    console.error('REFUSING: these groups are referenced but NOT BUILT by map.mjs:');
    for (const item of unbuilt) console.error(`  ${item}`);
    console.error('\nThey are the "choose a drink" / "choose a meat" steps. Importing without');
    console.error('them produces a menu that looks complete and silently drops a step.');
    return false;
  }
  const unconfirmed = Object.entries(decisions.modifierGroups).filter(
    // `_` is the block's own prose and carries no `confirmed`. Counting it made this gate
    // impossible to satisfy — and a fail-closed gate that can NEVER go green trains the
    // reader to reach for --allow-unconfirmed by reflex, which disables it when it is real.
    ([key, group]) => key !== '_' && group.confirmed !== true,
  );
  if (unconfirmed.length && !flag('--allow-unconfirmed')) {
    console.error(`REFUSING: ${unconfirmed.length} modifier-group decisions are unconfirmed.`);
    console.error('Run `node map.mjs --verify` for the list. Confirm them in decisions.json.');
    return false;
  }
  return true;
};

/** The path an asset lands at, from the dataset's repo-relative reference. */
const assetPath = (assets, reference) => path.join(assets, path.relative('assets', reference));

/**
 * Categories first — a product cannot be created without its category id. The record and its
 * IMAGE resume independently: keyed together, a crash during an upload left that category
 * permanently image-less, because the next run saw the id in state and skipped the whole block.
 */
const importCategories = async ({ call, categories, state, stateFile, assets, missingAssets }) => {
  const ids = {};
  for (const category of categories) {
    const key = String(category.source.id);
    if (state.categories[key]) {
      ids[key] = state.categories[key];
    } else {
      const created = await call('POST', '/api/Categories', { json: category.body });
      ids[key] = created.id;
      await remember(stateFile, state, 'categories', key, created.id);
      console.log(`  category ${category.body.name} -> ${created.id}`);
    }

    if (category.source.image && !state.images[`category:${key}`]) {
      // PUT, not POST: CategoriesController.UpdateCategoryImage is [HttpPut("{id}/image")].
      // POST answers 405 with a non-JSON body, which aborts the run after the category has
      // already been created and remembered.
      await uploadImage(
        call,
        'PUT',
        `/api/Categories/${ids[key]}/image`,
        assetPath(assets, category.source.image),
        'Image',
        {},
        missingAssets,
      );
      await remember(stateFile, state, 'images', `category:${key}`, true);
    }
  }
  return ids;
};

/**
 * Hidden option products, first — a section cannot point at a product that does not exist.
 * They carry no image: nothing renders them in the catalogue.
 */
const importComponents = async ({ call, components, categoryIds, state, stateFile }) => {
  const ids = {};
  for (const component of components) {
    const key = `${component.source.family}:${component.source.name.toLowerCase()}`;
    if (state.components[key]) {
      ids[key] = state.components[key];
      continue;
    }
    const categoryId = categoryIds[String(component.source.categoryId)];
    if (!categoryId)
      throw new Error(`component ${key} names category ${component.source.categoryId}, which was not created`);
    const created = await call('POST', '/api/Products', {
      json: { ...component.body, categoryIds: [categoryId], primaryCategoryId: categoryId },
    });
    ids[key] = created.id;
    await remember(stateFile, state, 'components', key, created.id);
  }
  console.log(`  ${components.length} hidden components`);
  return ids;
};

/**
 * A MenuDefinition is a SECOND call, and that is the API's shape rather than a choice:
 * `MenuDefinition` exists on UpdateProductCommand and NOT on CreateProductCommand, and it is
 * only honoured when Type is `menu`. So every product carrying sections is create-then-update.
 */
const attachSections = async ({ call, owner, productId, componentIds, productIds, state, stateFile, key }) => {
  const sections = owner.sections ?? [];
  const plat = owner.platOf === undefined ? null : productIds[String(owner.platOf)];
  if (!sections.length && !plat) return;
  if (state.sections[key]) return;

  const built = [];
  if (plat) {
    // The dish the menu wraps, as a one-item required section — the shape the platform's own
    // reference tenant uses ("Plat" -> the sandwich, then the drink section beside it).
    built.push({
      name: 'Plat',
      description: null,
      displayOrder: 0,
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      items: [{ productId: plat, additionalPrice: 0, displayOrder: 0, isDefault: true }],
    });
  }
  for (const [index, section] of sections.entries()) {
    const items = section.componentRefs.map((ref, i) => {
      const id = componentIds[ref];
      if (!id) throw new Error(`section "${section.name}" refers to component ${ref}, which was not created`);
      // additionalPrice 0: the menu's own price already includes the choice.
      return { productId: id, additionalPrice: 0, displayOrder: i, isDefault: false };
    });
    built.push({
      name: section.name,
      description: null,
      displayOrder: built.length + index,
      isRequired: section.isRequired,
      minSelection: section.minSelection,
      maxSelection: section.maxSelection,
      items,
    });
  }

  await call('PUT', `/api/Products/${productId}`, {
    json: {
      ...owner.body,
      id: productId,
      categoryIds: owner.__categoryIds,
      primaryCategoryId: owner.__categoryIds[0],
      menuDefinition: { isAlwaysAvailable: true, sections: built },
    },
  });
  await remember(stateFile, state, 'sections', key, built.length);
};

/**
 * The menus, last. Each is an ordinary product create (type=menu) followed by the
 * MenuDefinition update, and its `Plat` section wraps a dish `importProducts` has already
 * created — which is why this cannot run earlier.
 */
const importMenus = async ({
  call,
  menus,
  categoryIds,
  componentIds,
  productIds,
  state,
  stateFile,
  assets,
  missingAssets,
}) => {
  for (const menu of menus) {
    const key = String(menu.source.id);
    const categoryId = categoryIds[String(menu.source.categoryId)];
    if (!categoryId) throw new Error(`menu ${key} names category ${menu.source.categoryId}, which was not created`);

    let menuId = state.menus[key];
    if (!menuId) {
      const created = await call('POST', '/api/Products', {
        json: { ...menu.body, categoryIds: [categoryId], primaryCategoryId: categoryId },
      });
      menuId = created.id;
      await remember(stateFile, state, 'menus', key, menuId);
      console.log(`  menu ${menu.body.name} -> ${menuId}`);
    }

    if (menu.source.image && !state.images[`menu:${key}`]) {
      await uploadImage(
        call,
        'POST',
        `/api/Products/${menuId}/images`,
        assetPath(assets, menu.source.image),
        'Image',
        { IsPrimary: true, SortOrder: 0 },
        missingAssets,
      );
      await remember(stateFile, state, 'images', `menu:${key}`, true);
    }

    await attachSections({
      call,
      owner: { ...menu, __categoryIds: [categoryId] },
      productId: menuId,
      componentIds,
      productIds,
      state,
      stateFile,
      key: `menu:${key}`,
    });
  }
};

const importProducts = async ({
  call,
  products,
  categoryIds,
  componentIds,
  state,
  stateFile,
  assets,
  missingAssets,
}) => {
  const productIds = {};
  for (const product of products) {
    const key = String(product.source.id);
    const categoryId = categoryIds[String(product.source.categoryId)];
    if (!categoryId) {
      throw new Error(`product ${key} names category ${product.source.categoryId}, which was not created`);
    }

    let productId = state.products[key];
    if (!productId) {
      const created = await call('POST', '/api/Products', {
        json: { ...product.body, categoryIds: [categoryId], primaryCategoryId: categoryId },
      });
      productId = created.id;
      await remember(stateFile, state, 'products', key, productId);
      console.log(`  product ${product.body.name} -> ${productId}`);
    }

    if (product.source.image && !state.images[`product:${key}`]) {
      await uploadImage(
        call,
        'POST',
        `/api/Products/${productId}/images`,
        assetPath(assets, product.source.image),
        'Image',
        { IsPrimary: true, SortOrder: 0 },
        missingAssets,
      );
      await remember(stateFile, state, 'images', `product:${key}`, true);
    }

    productIds[key] = productId;
    await attachSections({
      call,
      owner: { ...product, __categoryIds: [categoryId] },
      productId,
      componentIds,
      productIds,
      state,
      stateFile,
      key: `product:${key}`,
    });
  }
  return productIds;
};

/** What this script does NOT do, said every time rather than left to the README. */
const reportRemainder = (dataset, state, missingAssets, dryRun) => {
  if (missingAssets?.length) {
    console.log(`\n${missingAssets.length} asset(s) NOT on disk — run \`node fetch.mjs out\` first:`);
    for (const file of missingAssets.slice(0, 5)) console.log(`  ${file}`);
    if (missingAssets.length > 5) console.log(`  … and ${missingAssets.length - 5} more`);
  } else if (dryRun) {
    console.log('\nevery referenced asset is present on disk');
  }

  const total = (o) => Object.keys(o).length;
  console.log(
    `\ndone: ${total(state.categories)} categories, ${total(state.components)} components, ` +
      `${total(state.products)} products, ${total(state.menus)} menus, ` +
      `${total(state.sections)} with sections, ${total(state.images)} images`,
  );
  console.log(
    '\nNOT imported by this script: the working hours, the table and the restaurant profile ' +
      '(name, address, phone, coordinates). Those are RestaurantInfo + WorkingHours, not the menu.',
  );
  if (dataset.tables?.length) {
    console.log(`Their table is labelled "${dataset.tables[0].label}" — rename per decisions.json.`);
  }
};

const main = async () => {
  const base = arg('--base');
  const token = readToken();
  const assets = arg('--assets', path.join(HERE, 'out', 'assets'));
  const dryRun = flag('--dry-run');
  // `null` in a dry run, and `remember` treats that as "record nothing". Writing state from
  // a dry run made the README's own recipe — dry-run, then the real run, both on the default
  // state file — turn the real run into a silent no-op: it would skip every request and report
  // `done: 16 categories, 68 products` against a completely empty tenant. It also made the
  // "complete state re-runs to zero writes" check hollow, since it could not tell a genuinely
  // finished import from a dry run's leftovers.
  const stateFile = dryRun ? null : path.resolve(process.cwd(), arg('--state', 'import-state.json'));

  if (!base) throw new Error('--base is required, e.g. --base https://mcdoner.sofrapiwas.com');
  if (!token && !dryRun) {
    throw new Error('set MCFOOD_TOKEN to a menu:write API token (or pass --token, which `ps` can see)');
  }

  const { dataset, decisions, categories, components, products, menus } = await build({});
  if (!refuseIfNotReady(dataset, decisions, products, menus)) process.exit(1);

  const call = makeClient({ base, token, dryRun });
  const state = stateFile ? await loadState(stateFile) : structuredClone(EMPTY_STATE);
  // Dry run only: assets that are not on disk. `fetch.mjs out` materialises them.
  const missingAssets = dryRun ? [] : null;
  console.log(`${dryRun ? 'DRY RUN — ' : ''}importing into ${base}`);
  console.log(dryRun ? 'state: none written (dry run)' : `state: ${stateFile}`);

  // ORDER IS THE CONTRACT, and each step needs the one before it:
  //   categories -> a product cannot be created without a category id
  //   components -> a section cannot point at a product that does not exist
  //   products   -> a menu's `Plat` section wraps a dish that must already exist
  //   menus      -> last
  const categoryIds = await importCategories({
    call,
    categories,
    state,
    stateFile,
    assets,
    missingAssets,
  });
  const componentIds = await importComponents({ call, components, categoryIds, state, stateFile });
  const productIds = await importProducts({
    call,
    products,
    categoryIds,
    componentIds,
    state,
    stateFile,
    assets,
    missingAssets,
  });
  await importMenus({
    call,
    menus,
    categoryIds,
    componentIds,
    productIds,
    state,
    stateFile,
    assets,
    missingAssets,
  });
  reportRemainder(dataset, state, missingAssets, dryRun);
};

await main();
