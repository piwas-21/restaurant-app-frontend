#!/usr/bin/env node
/**
 * MC FOOD — turn the captured dataset into the payloads our API accepts.
 *
 * PURE. It reads `dataset.json` + `decisions.json` and returns/prints request bodies;
 * it opens no socket and writes nothing outside `--out`. `import.mjs` is the half that
 * talks to a tenant. Splitting them is the point: the mapping is the part that can be
 * checked exhaustively TODAY, months before a tenant exists to receive it.
 *
 *   node map.mjs --verify              # self-check, prints a report, exits non-zero on a problem
 *   node map.mjs --out payloads.json   # write the payloads
 *
 * ── The two traps this file exists to not fall into ──────────────────────────────
 *
 * 1. THEIR SIZE PRICES ARE ABSOLUTE; OUR `variations[].priceModifier` IS A DELTA.
 *    `priceModifier = size.price - basePrice`. Backwards, it misprices 29 products and
 *    every one of them still looks like a plausible price. `--verify` re-derives the
 *    ABSOLUTE price back out of every emitted payload and compares it to their number,
 *    which is the only check that can tell the two directions apart.
 *
 * 2. THEIR ONE MODIFIER-GROUP PRIMITIVE IS THREE OF OURS. `src/types/menu/sauce.ts`
 *    says our sauce rule is "deliberately NOT a general min/max-select engine", so a
 *    group becomes a sauce rule, a set of ProductIngredients, or a bundle section —
 *    never a generic group. `decisions.json` carries which, per group, and this file
 *    refuses to guess.
 *
 * ── The size/product asymmetry, which is easy to miss ────────────────────────────
 *
 * Their groups hang off BOTH the product and the individual size. Product 395 "Kebab"
 * lists groups [76,77,78,79] at product level, while its "Kebab Seul" size lists only
 * [76,77,78] — group 79 is `Boissons`, the drink, and it belongs to the "Menu Kebab"
 * size alone. Read at product level, a guest ordering the plain sandwich is asked to
 * choose a drink they are not getting. So the DEFAULT size's group list is what governs
 * a plain product, and the menu sizes are what become bundles.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);

/** The tenant's languages (registry `languages: [fr, en]`). Source content is French. */
const LANGS = ['fr', 'en'];
const SOURCE_LANG = 'fr';

/** `ProductType` / `KitchenType` cross the wire as their EnumMember NAMES, not ints. */
const PRODUCT_TYPE = { main: 'mainItem', beverage: 'beverage', sauce: 'sauce', menu: 'menu' };

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Their option name -> the INGREDIENT it is about.
 *
 * OWNER RULING: there are no "Sans X" records. A removal is not something to add; it is the
 * ingredient, marked optional and included in the base price, which the guest unticks. So
 * `Sans Salade` is the ingredient `Salade`, and `- Sans Emmentale` and `+ Salade` are too.
 * Emitting a row literally named "Sans Salade" would show a checkbox the guest ticks in order
 * NOT to have something — a double negative on every product on the carte.
 *
 * Prefixes are stripped only for groups flagged `stripPrefix` (never for sauces, whose names
 * are already the thing). Renames apply AFTER, so `decisions.renameOptions` is keyed on the
 * ingredient rather than on their punctuation.
 */
const PREFIXES = [/^-\s+/, /^Sans\s+/i, /^\+\s+/];

const ingredientName = (decisions, raw, strip) => {
  let name = raw.trim();
  if (strip) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const prefix of PREFIXES) {
        if (prefix.test(name)) {
          name = name.replace(prefix, '').trim();
          changed = true;
        }
      }
    }
  }
  return decisions.renameOptions[name] ?? name;
};

const isDropped = (decisions, groupId, optionName) => Object.hasOwn(decisions.dropOptions, `${groupId}:${optionName}`);

/**
 * Per-language content. Both languages get the SAME French string today, deliberately:
 * we are not inventing an English menu for a French kebab shop, and a missing `en` row
 * would let the `en` locale fall through to a key rather than to the dish's real name.
 * When Mustafa supplies English names this is the one function that changes.
 */
const content = (name, description = '') =>
  // `''`, never `null`. ProductContentRule refuses a null Description as hard as a null
  // Name ("A translation's description is required") and ProductDescription.Description is
  // `required` against a non-nullable column, while empty string is explicitly allowed. 61
  // of their 69 products carry no description, so `null` here 400s almost the whole import.
  // The nested maps are NOT symmetric — NestedContentRule permits a null description — but
  // there is no reason to send two shapes.
  Object.fromEntries(LANGS.map((lang) => [lang, { name, description: description ?? '' }]));

/** A group is only usable once someone has confirmed what it MEANS. */
const groupOf = (decisions, id) => {
  const group = decisions.modifierGroups[String(id)];
  if (!group) throw new Error(`modifier group ${id} has no entry in decisions.json`);
  return group;
};

/**
 * The sauce rule, from whichever of a product's groups is targeted at `sauceRule`.
 * Two such groups on one product would be a rule we cannot express — our product carries
 * exactly one — so that is an error rather than a silent first-wins.
 */
const sauceRuleFor = (decisions, groupIds) => {
  const rules = groupIds.map((id) => groupOf(decisions, id)).filter((g) => g.target === 'sauceRule');
  if (rules.length > 1) throw new Error(`two sauceRule groups on one product: ${groupIds}`);
  if (rules.length === 0) return { sauceMin: 0, sauceMax: null, sauceIncludedFree: 0 };
  const [rule] = rules;
  return { sauceMin: rule.min, sauceMax: rule.max, sauceIncludedFree: rule.includedFree };
};

/**
 * `ProductIngredient[]` from every group targeted at `ingredients`.
 *
 * `exclusionGroup` is `null` on every row, and that is the correction of a real error.
 * It is not a display grouping — src/utils/exclusionGroup.ts: "Rows of one product sharing
 * a non-empty key are MUTUALLY EXCLUSIVE: choosing one deselects the others, so at most one
 * is ever on a line." Keying it by the group's display name did three wrong things at once:
 *
 *   - it made the paid add-ons exclusive, so ticking `+ Viande` silently unticked
 *     `+ Cheddar` — legal server-side, so it would have shipped and surfaced as a complaint;
 *   - it 400s the removal groups outright, since every "Sans X" row is
 *     `isIncludedInBasePrice: true` and IngredientExclusionGroupRule allows at most one
 *     included member per group;
 *   - it did not even achieve what it was written for. The four "Sans quoi ?" groups share
 *     one display name, so on the 8 products referencing TWO removal groups they collapsed
 *     into one group anyway.
 *
 * Nothing in this catalogue is a pick-exactly-one ingredient set. If one ever appears, the
 * key must be the source GROUP ID, never a display name.
 */
/**
 * Collapse rows that name the same ingredient, and say which won.
 *
 * Stripping the prefixes makes `Sans Salade` (group 80, in the recipe) and `+ Salade`
 * (group 82, a free addition) the SAME ingredient — measured: 5 ingredients across 6
 * products. They cannot both stand: two `Salade` rows on one product is a menu bug, and
 * offering to add something the dish already contains is the contradiction, not the removal.
 *
 * **The included row wins.** Appearing in a removal list is evidence the ingredient is in the
 * dish, and one optional-and-included row already gives the guest both directions — leave it
 * on to have it, untick to remove. The merge is REPORTED by `--verify`, never silent.
 */
const dedupeIngredients = (rows, merges, productName) => {
  const byName = new Map();
  for (const row of rows) {
    const key = row.name.toLowerCase();
    const seen = byName.get(key);
    if (!seen) {
      byName.set(key, row);
      continue;
    }
    const winner = seen.isIncludedInBasePrice ? seen : row;
    const loser = seen.isIncludedInBasePrice ? row : seen;
    merges.push(
      `${productName}: "${row.name}" appeared twice — kept the included row, dropped the ${loser.price > 0 ? `${loser.price} paid` : 'free'} one`,
    );
    byName.set(key, winner);
  }
  return [...byName.values()].map((row, index) => ({ ...row, displayOrder: index }));
};

const ingredientsFor = (decisions, groupIds, groups, merges = [], productName = '') => {
  const out = [];
  let displayOrder = 0;
  for (const id of groupIds) {
    const decision = groupOf(decisions, id);
    // `sauceRule` groups emit rows HERE TOO, as `kind: 'sauce'`. A sauce is a typed
    // ingredient, not a second entity (IngredientKind's own docblock), and the guest's
    // sauce step is gated on the rows existing — customizationSteps.ts only pushes it
    // `if (ingredients.some(i => i.isActive && isSauce(i)))`. Emitting the min/max/free
    // numbers without the rows leaves 50 products carrying an INERT rule and offering the
    // guest no sauce at all: complete-looking, and missing the central modifier of a kebab
    // shop. Same failure shape the unbuilt bundles are refused for.
    if (decision.target !== 'ingredients' && decision.target !== 'sauceRule') continue;
    const source = groups.find((g) => g.id === id);
    if (!source) throw new Error(`modifier group ${id} is referenced but absent from the dataset`);
    for (const option of source.options) {
      if (isDropped(decisions, id, option.name)) continue;
      const name = ingredientName(decisions, option.name, decision.stripPrefix === true);
      out.push({
        name,
        isOptional: decision.isOptional,
        price: round2(option.price ?? 0),
        isIncludedInBasePrice: decision.isIncludedInBasePrice,
        isActive: true,
        displayOrder: displayOrder++,
        maxQuantity: 1,
        kind: decision.kind ?? 'ingredient',
        exclusionGroup: null,
        content: content(name),
      });
    }
  }
  return dedupeIngredients(out, merges, productName);
};

/**
 * Is this non-default size a MENU rather than a portion?
 *
 * Measured on their data: 34 of the 39 non-default sizes are named `Menu …`, and the other
 * 5 are genuine portions (`6 X Mozza Stick` -> `12 X Mozza Stick`). The 34 become bundles;
 * the 5 stay variations. Split by the name because that is what their data actually encodes
 * — there is no other field distinguishing the two, and the 5 exceptions are listed in the
 * README so a future reader can check the rule still holds.
 */
const isMenuSize = (decisions, size) =>
  !size.isDefault && new RegExp(decisions.bundles.menuSizePattern, 'i').test(size.name);

/**
 * Their sizes -> our variations. THE DELTA CONVERSION.
 *
 * The default size is the product's own price, so its modifier is 0 — that is checked
 * rather than assumed, because a default size priced differently from `basePrice` would
 * mean their model is not what we think it is, and every delta after it would be wrong.
 */
const variationsFor = (decisions, item) => {
  const all = item.sizes ?? [];
  // A menu size leaves the variation list entirely — it becomes its own type=menu product.
  const sizes = all.filter((size) => !isMenuSize(decisions, size));
  if (sizes.length < 2) return [];
  const defaults = sizes.filter((s) => s.isDefault);
  if (defaults.length !== 1) {
    throw new Error(`product ${item.sourceId} "${item.name}" has ${defaults.length} default sizes`);
  }
  if (round2(defaults[0].price) !== round2(item.price)) {
    throw new Error(
      `product ${item.sourceId} "${item.name}": default size ${defaults[0].price} != basePrice ${item.price}`,
    );
  }
  return sizes.map((size, index) => ({
    name: size.name,
    description: null,
    priceModifier: round2(size.price - item.price),
    isActive: true,
    displayOrder: index,
    content: content(size.name),
  }));
};

/**
 * A product's governing group list: the DEFAULT size's when it has one, else the
 * product's own. See the header — the product-level list on a sized item includes the
 * menu-only steps, so using it would ask a plain sandwich for a drink choice.
 */
const governingGroupIds = (item) => {
  const defaultSize = (item.sizes ?? []).find((s) => s.isDefault);
  return defaultSize?.modifierGroupIds ?? item.modifierGroupIds ?? [];
};

/**
 * The hidden option products a bundle section points at.
 *
 * ALWAYS new products, never an existing one matched by name — group 81's meat option
 * "Kebab" name-matches the SANDWICHES product "Kebab" (8.00 EUR), and pointing a Tacos'
 * meat section at that would put a whole priced sandwich inside the tacos. A duplicated
 * hidden drink row costs nothing; that mis-reference is a real defect.
 *
 * Deduplicated by FAMILY, not by group: groups 81/83/84/85 are the same nine meats asked
 * for one, two or three at a time, so they share one set of component products.
 */
const FAMILY_OF = { 79: 'drink', 81: 'meat', 83: 'meat', 84: 'meat', 85: 'meat', 87: 'gift' };

const componentType = (family) => (family === 'drink' ? PRODUCT_TYPE.beverage : PRODUCT_TYPE.main);

const buildComponents = (dataset, decisions) => {
  const groups = new Map(dataset.modifierGroups.map((g) => [g.id, g]));
  const byKey = new Map();
  for (const [id, decision] of Object.entries(decisions.modifierGroups)) {
    if (id === '_' || decision.target !== 'bundle') continue;
    const family = FAMILY_OF[Number(id)];
    if (!family) throw new Error(`bundle group ${id} has no component family`);
    for (const option of groups.get(Number(id)).options) {
      if (isDropped(decisions, Number(id), option.name)) continue;
      const name = ingredientName(decisions, option.name, false);
      const key = `${family}:${name.toLowerCase()}`;
      if (byKey.has(key)) continue;
      byKey.set(key, {
        source: { family, name, categoryId: decisions.bundles.componentCategories[family] },
        body: {
          name,
          description: null,
          basePrice: 0,
          isActive: true,
          isAvailable: true,
          isSpecial: false,
          preparationTimeMinutes: 0,
          type: componentType(family),
          kitchenType: 'None',
          ingredients: null,
          allergens: null,
          displayOrder: 0,
          categoryIds: [],
          primaryCategoryId: null,
          variations: [],
          suggestedSideItemIds: [],
          detailedIngredients: [],
          content: content(name),
          sauceMin: 0,
          sauceMax: null,
          sauceIncludedFree: 0,
          // Hidden from the catalogue and not orderable alone — the whole point of a component.
          isComponent: true,
        },
      });
    }
  }
  return [...byKey.values()];
};

/** A section, from the group it came from. `componentRefs` are resolved by import.mjs. */
const sectionFor = (decisions, groupId) => {
  const decision = groupOf(decisions, groupId);
  const family = FAMILY_OF[Number(groupId)];
  const groups = decisions.__groups;
  const options = groups
    .get(Number(groupId))
    .options.filter((o) => !isDropped(decisions, Number(groupId), o.name))
    .map((o) => ingredientName(decisions, o.name, false));
  return {
    // Which source group this section came from. Read back by --verify to derive what is
    // actually BUILT from the output rather than assuming the mapping ran — an empty
    // derivation would otherwise read as "every group is built".
    __groupId: String(groupId),
    name: decision.displayName,
    description: null,
    isRequired: decision.isRequired !== false,
    minSelection: decision.minSelection ?? (decision.isRequired === false ? 0 : 1),
    maxSelection: decision.maxSelection ?? 1,
    componentRefs: options.map((name) => `${family}:${name.toLowerCase()}`),
  };
};

const buildCategories = (dataset) =>
  dataset.menu.map((category, index) => ({
    source: { id: category.sourceId, image: category.image },
    body: {
      name: category.name,
      description: null,
      isActive: category.isActive,
      displayOrder: category.sortOrder ?? index,
    },
  }));

const buildProducts = (dataset, decisions, merges = []) => {
  const out = [];
  for (const category of dataset.menu) {
    for (const item of category.items) {
      if (Object.hasOwn(decisions.dropProducts, String(item.sourceId))) continue;
      const groupIds = governingGroupIds(item);
      const bundleGroups = groupIds.filter((id) => groupOf(decisions, id).target === 'bundle');
      const sections = bundleGroups.map((id) => sectionFor(decisions, id));
      out.push({
        source: {
          id: item.sourceId,
          categoryId: category.sourceId,
          image: item.image,
          absolutePrices: (item.sizes ?? []).map((s) => ({ name: s.name, price: s.price })),
        },
        body: {
          name: item.name,
          description: item.description,
          basePrice: round2(item.price),
          isActive: item.isActive,
          isAvailable: !item.isSoldOut,
          isSpecial: false,
          preparationTimeMinutes: 0,
          // A choice step only exists on a MenuDefinition, and UpdateProductCommand only
          // honours one when Type is `menu`. So a dish that asks "which meat?" IS a menu in
          // our model, even though their data calls it an ordinary product.
          type: sections.length ? PRODUCT_TYPE.menu : PRODUCT_TYPE.main,
          kitchenType: 'None',
          ingredients: null,
          allergens: null,
          displayOrder: item.sortOrder ?? 0,
          categoryIds: [],
          primaryCategoryId: null,
          // Their model is N sizes with exactly one default, so the unsized "base" row is
          // not a thing a guest may order. Left false, the 29 sized products each show a
          // third option priced identically to their default size.
          hideBaseProduct: (item.sizes ?? []).length > 1,
          variations: variationsFor(decisions, item),
          suggestedSideItemIds: [],
          detailedIngredients: ingredientsFor(decisions, groupIds, dataset.modifierGroups, merges, item.name),
          content: content(item.name, item.description),
          ...sauceRuleFor(decisions, groupIds),
        },
        sections,
      });
    }
  }
  return out;
};

/**
 * Bundle groups that a surviving product actually references — and which this file does
 * NOT yet build.
 *
 * `ingredientsFor` skips a non-`ingredients` group by design, and `sauceRuleFor` ignores
 * one too, so a `bundle` group currently vanishes without a word. That is the
 * silent-permissive shape: the import would succeed, the menu would look complete, and
 * the "choose your drink" and "choose your meat" steps would simply not exist —
 * discovered by a guest, not by this script. So it is reported LOUDLY and blocks
 * emission, exactly like an unconfirmed decision.
 *
 * Building them means `MenuDefinition` + `MenuSection` + component products
 * (`isComponent: true`, `ProductType.menu`), which is a second slice of work.
 */
/**
 * Bundle groups that are referenced but reach no section. Now that sections exist this can
 * legitimately be empty — but it stays, because it is the check that would catch a group
 * quietly dropping out of the mapping again, which is how the drink step went missing on
 * all 29 "Menu X" the first time.
 */
export const unbuiltBundlesInUse = (dataset, decisions, built = null) => {
  const used = new Map();
  for (const category of dataset.menu) {
    for (const item of category.items) {
      if (Object.hasOwn(decisions.dropProducts, String(item.sourceId))) continue;
      // EVERY reference, not just the governing list. A menu-only step like group 79
      // (`Boissons`) hangs off the PRODUCT and off the "Menu X" size, never off the
      // default one — so a governing-list-only sweep reports it as absent and would
      // certify a catalogue whose entire drink step is missing.
      const referenced = [
        ...(item.modifierGroupIds ?? []),
        ...(item.sizes ?? []).flatMap((size) => size.modifierGroupIds ?? []),
      ];
      for (const id of new Set(referenced)) {
        if (groupOf(decisions, id).target !== 'bundle') continue;
        if (built?.has(String(id))) continue;
        used.set(String(id), [...(used.get(String(id)) ?? []), item.name]);
      }
    }
  }
  return (
    [...used.entries()]
      .map(([id, items]) => {
        const { sourceName } = decisions.modifierGroups[id];
        const shown = items.slice(0, 3).join(', ');
        return `group ${id} (${sourceName}) on ${items.length}: ${shown}${items.length > 3 ? ' …' : ''}`;
      })
      // A compare function, not a bare .sort(): the default coerces to string and sorts by
      // UTF-16 code unit, so "group 10" would come before "group 9" in a list a human reads
      // to decide what is still unconfirmed. localeCompare with numeric ordering keeps the
      // group ids in the order they are spoken about.
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  );
};

/**
 * A `Menu …` size -> its own type=menu product, per the platform's own precedent (see
 * decisions.bundles). Its price is their ABSOLUTE size price, not a delta: this is a
 * product in its own right, so there is no basePrice to be relative to.
 *
 * Sections: `Plat` naming the dish it wraps (one item, required) and whatever bundle groups
 * the PARENT product referenced — for a "Menu Kebab" that is group 79, the drink. Those
 * groups hang off the parent product and off the menu size, never off the default size,
 * which is exactly why reading only the default size lost them.
 */
const buildMenuBundles = (dataset, decisions) => {
  const out = [];
  for (const category of dataset.menu) {
    for (const item of category.items) {
      if (Object.hasOwn(decisions.dropProducts, String(item.sourceId))) continue;
      for (const size of item.sizes ?? []) {
        if (!isMenuSize(decisions, size)) continue;
        const referenced = new Set([...(item.modifierGroupIds ?? []), ...(size.modifierGroupIds ?? [])]);
        const bundleGroups = [...referenced].filter((id) => groupOf(decisions, id).target === 'bundle');
        out.push({
          source: {
            id: `${item.sourceId}:${size.name}`,
            parentId: item.sourceId,
            categoryId: category.sourceId,
            image: item.image,
            absolutePrice: size.price,
          },
          body: {
            name: size.name,
            description: null,
            basePrice: round2(size.price),
            isActive: item.isActive,
            isAvailable: !item.isSoldOut,
            isSpecial: false,
            preparationTimeMinutes: 0,
            type: PRODUCT_TYPE.menu,
            kitchenType: 'None',
            ingredients: null,
            allergens: null,
            displayOrder: (item.sortOrder ?? 0) + 100,
            categoryIds: [],
            primaryCategoryId: null,
            variations: [],
            suggestedSideItemIds: [],
            detailedIngredients: [],
            content: content(size.name),
            sauceMin: 0,
            sauceMax: null,
            sauceIncludedFree: 0,
          },
          // `platOf` is resolved to the parent product's id by import.mjs, which is the only
          // place that knows it — the dish must exist before the menu that wraps it.
          platOf: item.sourceId,
          sections: bundleGroups.map((id) => sectionFor(decisions, id)),
        });
      }
    }
  }
  return out;
};

/**
 * Every decision a payload actually DEPENDS on. Not every decision in the file — an
 * unconfirmed entry for a group no surviving product references cannot corrupt anything,
 * and blocking on it would train the reader to pass --allow-unconfirmed by reflex.
 */
const unconfirmedInUse = (dataset, decisions) => {
  const used = new Set();
  for (const category of dataset.menu) {
    for (const item of category.items) {
      if (Object.hasOwn(decisions.dropProducts, String(item.sourceId))) continue;
      for (const id of governingGroupIds(item)) used.add(String(id));
    }
  }
  return (
    [...used]
      .filter((id) => decisions.modifierGroups[id]?.confirmed !== true)
      .map((id) => `group ${id} (${decisions.modifierGroups[id]?.sourceName ?? '?'})`)
      // A compare function, not a bare .sort(): the default coerces to string and sorts by
      // UTF-16 code unit, so "group 10" would come before "group 9" in a list a human reads
      // to decide what is still unconfirmed. localeCompare with numeric ordering keeps the
      // group ids in the order they are spoken about.
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  );
};

export const build = async ({ datasetPath, decisionsPath }) => {
  const dataset = JSON.parse(await readFile(datasetPath ?? path.join(HERE, 'dataset.json'), 'utf8'));
  const decisions = JSON.parse(await readFile(decisionsPath ?? path.join(HERE, 'decisions.json'), 'utf8'));
  const merges = [];
  // sectionFor needs the raw groups; stashed rather than threaded through six signatures.
  decisions.__groups = new Map(dataset.modifierGroups.map((g) => [g.id, g]));
  return {
    dataset,
    decisions,
    categories: buildCategories(dataset),
    components: buildComponents(dataset, decisions),
    products: buildProducts(dataset, decisions, merges),
    menus: buildMenuBundles(dataset, decisions),
    merges,
  };
};

/**
 * THE CHECK THAT MATTERS. Re-derives each variation's ABSOLUTE price from the payload
 * (`basePrice + priceModifier`) and compares it with the number their site charges.
 * A delta conversion applied backwards passes every other check in this file.
 */
const verifyPrices = (products) => {
  const failures = [];
  for (const product of products) {
    const byName = new Map(product.source.absolutePrices.map((s) => [s.name, s.price]));
    for (const variation of product.body.variations) {
      const theirs = byName.get(variation.name);
      const ours = round2(product.body.basePrice + variation.priceModifier);
      if (theirs === undefined) failures.push(`${product.body.name}/${variation.name}: no source price`);
      else if (round2(theirs) !== ours) {
        failures.push(`${product.body.name}/${variation.name}: theirs ${theirs}, ours ${ours}`);
      }
    }
  }
  return failures;
};

/** Nothing guest-facing may still carry their admin shorthand or a dotless Turkish ı. */
const verifyStrings = (products) => {
  const bad = /^[-+\s]*$|ı|^-\s|^\+\s\+/;
  const failures = [];
  for (const product of products) {
    for (const ingredient of product.body.detailedIngredients) {
      if (bad.test(ingredient.name)) failures.push(`ingredient name "${ingredient.name}"`);
      if (bad.test(ingredient.exclusionGroup)) {
        failures.push(`exclusion group "${ingredient.exclusionGroup}"`);
      }
    }
  }
  return failures;
};

/**
 * Every language the tenant serves must be present on every guest-facing string — and the
 * DESCRIPTION must be a string, not null. That second half is not pedantry: ProductContentRule
 * refuses a null Description as hard as a null Name, and 61 of their 69 products have no
 * description, so a null default 400s almost the whole import on the first request.
 */
const verifyContent = (products) => {
  const failures = [];
  const check = (label, block) => {
    for (const lang of LANGS) {
      if (!block?.[lang]?.name) failures.push(`${label}: missing ${lang}`);
      if (typeof block?.[lang]?.description !== 'string') {
        failures.push(`${label}: ${lang} description is ${block?.[lang]?.description} — must be a string`);
      }
    }
  };
  for (const product of products) {
    check(`product "${product.body.name}"`, product.body.content);
    for (const v of product.body.variations) check(`variation "${v.name}"`, v.content);
    for (const i of product.body.detailedIngredients) check(`ingredient "${i.name}"`, i.content);
  }
  return failures;
};

/**
 * A sauce RULE without sauce ROWS is inert, and worse than inert: `customizationSteps.ts`
 * only offers the sauce step `if (ingredients.some(i => i.isActive && isSauce(i)))`, so a
 * product with `sauceMin: 1` and no sauces asks the guest for nothing and looks finished.
 * This is the check that has an external referent — the step's own precondition — rather
 * than agreeing with whatever the mapper happened to emit.
 */
const verifySauces = (products) => {
  const failures = [];
  for (const product of products) {
    const sauces = product.body.detailedIngredients.filter((i) => i.kind === 'sauce' && i.isActive);
    if (product.body.sauceMin > 0 && sauces.length < product.body.sauceMin) {
      failures.push(`${product.body.name}: sauceMin ${product.body.sauceMin} but only ${sauces.length} sauce rows`);
    }
    if (sauces.length && product.body.sauceMax !== null && sauces.length < product.body.sauceMax) {
      failures.push(`${product.body.name}: sauceMax ${product.body.sauceMax} exceeds its ${sauces.length} sauce rows`);
    }
  }
  return failures;
};

/**
 * `exclusionGroup` makes rows MUTUALLY EXCLUSIVE and the server refuses a group with more
 * than one `isIncludedInBasePrice` member. Nothing in this catalogue is a pick-exactly-one
 * set, so the only correct value is null — asserted rather than trusted, because the wrong
 * value here ships silently on the add-ons and 400s on the removals.
 */
const verifyExclusionGroups = (products) => {
  const failures = [];
  for (const product of products) {
    for (const ingredient of product.body.detailedIngredients) {
      if (ingredient.exclusionGroup !== null) {
        failures.push(`${product.body.name}/${ingredient.name}: exclusionGroup is not null`);
      }
    }
  }
  return failures;
};

/**
 * No product may name the same ingredient twice. This is the assertion behind the prefix
 * strip: `Sans Salade` and `+ Salade` collapse to one `Salade`, and if the collapse ever
 * stops working the duplicate is a visible menu bug rather than a silent one.
 */
const verifyNoDuplicateIngredients = (products) => {
  const failures = [];
  for (const product of products) {
    const seen = new Map();
    for (const ingredient of product.body.detailedIngredients) {
      const key = ingredient.name.toLowerCase();
      if (seen.has(key)) failures.push(`${product.body.name}: "${ingredient.name}" appears twice`);
      seen.set(key, true);
    }
  }
  return failures;
};

/** Nothing a guest reads may still be phrased as a removal — the ruling this mapping rests on. */
const verifyNoNegatedNames = (products) => {
  const negated = /^(sans|no)\s/i;
  const failures = [];
  for (const product of products) {
    for (const ingredient of product.body.detailedIngredients) {
      if (negated.test(ingredient.name)) {
        failures.push(`${product.body.name}: "${ingredient.name}" is still phrased as a removal`);
      }
    }
  }
  return failures;
};

/**
 * Every section must resolve to real components, and a menu must name a real dish.
 *
 * A `componentRef` that matches nothing would produce a section the guest sees as empty —
 * "choose your drink" with no drinks. That is the same failure the unbuilt-bundle refusal
 * exists for, one layer down, so it gets the same treatment: an assertion, not a hope.
 */
const verifySections = (products, menus, components) => {
  const have = new Set(components.map((c) => `${c.source.family}:${c.source.name.toLowerCase()}`));
  const productIds = new Set(products.map((p) => p.source.id));
  const failures = [];
  for (const owner of [...products, ...menus]) {
    for (const section of owner.sections ?? []) {
      if (!section.name) failures.push(`${owner.body.name}: a section has no name`);
      if (!section.componentRefs.length) {
        failures.push(`${owner.body.name}/${section.name}: no options`);
      }
      for (const ref of section.componentRefs) {
        if (!have.has(ref)) failures.push(`${owner.body.name}/${section.name}: no component "${ref}"`);
      }
      if (section.minSelection > section.maxSelection) {
        failures.push(`${owner.body.name}/${section.name}: min ${section.minSelection} > max ${section.maxSelection}`);
      }
    }
  }
  for (const menu of menus) {
    if (!productIds.has(menu.platOf)) {
      failures.push(`${menu.body.name}: wraps product ${menu.platOf}, which is not being created`);
    }
  }
  return failures;
};

/** A menu's price is THEIR absolute size price — never a delta, since it has no parent. */
const verifyMenuPrices = (menus) => {
  const failures = [];
  for (const menu of menus) {
    if (round2(menu.body.basePrice) !== round2(menu.source.absolutePrice)) {
      failures.push(`${menu.body.name}: ${menu.body.basePrice} vs their ${menu.source.absolutePrice}`);
    }
  }
  return failures;
};

const main = async () => {
  const argv = process.argv.slice(2);
  const flag = (name) => argv.includes(name);
  const value = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? undefined : argv[i + 1];
  };

  const { dataset, decisions, categories, components, products, menus, merges } = await build({});
  const pending = unconfirmedInUse(dataset, decisions);
  // Which groups actually reached a section — derived from the OUTPUT, so a group that
  // silently stopped being mapped shows up here rather than being assumed built.
  const built = new Set([...products, ...menus].flatMap((p) => (p.sections ?? []).map((sec) => sec.__groupId)));
  const unbuilt = unbuiltBundlesInUse(dataset, decisions, built);

  if (flag('--verify')) {
    const priceFailures = verifyPrices(products);
    const stringFailures = verifyStrings(products);
    const contentFailures = verifyContent(products);
    const sauceFailures = verifySauces(products);
    const exclusionFailures = verifyExclusionGroups(products);
    const duplicateFailures = verifyNoDuplicateIngredients(products);
    const negatedFailures = verifyNoNegatedNames(products);
    const sectionFailures = verifySections(products, menus, components);
    const menuPriceFailures = verifyMenuPrices(menus);
    const variations = products.reduce((n, p) => n + p.body.variations.length, 0);
    const ingredients = products.reduce((n, p) => n + p.body.detailedIngredients.length, 0);
    const sauced = products.filter((p) => p.body.sauceMin > 0).length;
    const sauceRows = products.reduce(
      (n, p) => n + p.body.detailedIngredients.filter((i) => i.kind === 'sauce').length,
      0,
    );

    const sectioned = [...products, ...menus].filter((p) => (p.sections ?? []).length);
    console.log(`categories                 ${categories.length}`);
    console.log(`products                   ${products.length}`);
    console.log(`menu bundles (type=menu)   ${menus.length}`);
    console.log(`hidden components          ${components.length}`);
    console.log(`products carrying sections ${sectioned.length}`);
    console.log(`variations                 ${variations}`);
    console.log(`product ingredients        ${ingredients}`);
    console.log(`products with a sauce rule ${sauced}`);
    console.log(`  …of which sauce rows      ${sauceRows}`);
    if (merges.length) {
      console.log(`\nmerged duplicate ingredients (${merges.length}) — the included row won:`);
      for (const line of merges) console.log(`  ${line}`);
    }
    console.log('');
    const report = (label, failures) =>
      console.log(failures.length ? `FAIL ${label}\n  ${failures.join('\n  ')}` : `ok   ${label}`);
    report('every variation re-derives to THEIR absolute price', priceFailures);
    report('no admin shorthand or dotless ı reaches a guest string', stringFailures);
    report(`every guest string carries all ${LANGS.length} languages, description included`, contentFailures);
    report('every product with a sauce RULE carries the sauce ROWS to satisfy it', sauceFailures);
    report('no ingredient is marked mutually exclusive', exclusionFailures);
    report('no product names the same ingredient twice', duplicateFailures);
    report('no guest-facing ingredient is still phrased as a removal', negatedFailures);
    report('every bundle section resolves to real components and a real dish', sectionFailures);
    report("every menu's price is THEIR absolute price", menuPriceFailures);
    report(
      'every modifier group in use has a CONFIRMED meaning',
      pending.map((p) => `${p} is unconfirmed — decisions.json`),
    );
    report(
      'every modifier group in use is BUILT by this file',
      unbuilt.map((p) => `${p} — target "bundle", not implemented yet`),
    );

    const failed =
      priceFailures.length +
      stringFailures.length +
      contentFailures.length +
      sauceFailures.length +
      exclusionFailures.length +
      duplicateFailures.length +
      negatedFailures.length +
      sectionFailures.length +
      menuPriceFailures.length;
    if (failed || pending.length || unbuilt.length) process.exit(1);
    console.log('\nmap: all checks passed');
    return;
  }

  if (unbuilt.length) {
    console.error('REFUSING to emit payloads — these groups are referenced but NOT BUILT:');
    for (const p of unbuilt) console.error(`  ${p}`);
    console.error('\nThey are the "choose a drink" / "choose a meat" steps. Emitting without');
    console.error('them would produce a menu that looks complete and silently drops a step.');
    process.exit(1);
  }

  if (pending.length && !flag('--allow-unconfirmed')) {
    console.error('REFUSING to emit payloads — these decisions are still guesses:');
    for (const p of pending) console.error(`  ${p}`);
    console.error('\nConfirm them in decisions.json, or pass --allow-unconfirmed for a dry look.');
    process.exit(1);
  }

  const out = value('--out');
  const payload = JSON.stringify({ categories, products }, null, 2);
  if (out) {
    const dest = path.resolve(process.cwd(), out);
    await writeFile(dest, payload);
    console.log(`wrote ${categories.length} categories and ${products.length} products`);
  } else {
    console.log(payload);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) await main();
