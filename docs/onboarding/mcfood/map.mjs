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

/** The whole union, as `src/types/menu/shared.ts` declares it. */
const PRODUCT_TYPES = ['mainItem', 'sideItem', 'beverage', 'dessert', 'sauce', 'addOn', 'menu'];

/**
 * A category's product type, from `decisions.json`. FAIL-CLOSED: an absent entry throws rather
 * than defaulting, because the default IS the defect. This file used to hard-code `mainItem` for
 * every catalogue product, which is legal, plausible and wrong: `useDrinkUpsell` asks for
 * `GET /api/Products?Type=Beverage`, so 13 drinks typed `mainItem` made that endpoint answer 0 and
 * no dish on the menu was ever offered a drink; and `groupSuggestedSideItems` partitions a dish's
 * sides by the SIDE's own type, so 3 desserts landed under "accompaniments". Measured live.
 */
const typeOf = (decisions, category) => {
  const decided = decisions.productTypes?.[String(category.sourceId)];
  if (!decided) {
    throw new Error(
      `category ${category.sourceId} "${category.name}" has no entry in decisions.productTypes — ` +
        `one of ${PRODUCT_TYPES.join(', ')}`,
    );
  }
  if (!PRODUCT_TYPES.includes(decided)) {
    throw new Error(`category ${category.sourceId} "${category.name}" asks for unknown product type "${decided}"`);
  }
  return decided;
};

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
    const dropped = loser.price > 0 ? `${loser.price} paid` : 'free';
    merges.push(`${productName}: "${row.name}" appeared twice — kept the included row, dropped the ${dropped} one`);
    byName.set(key, winner);
  }
  return [...byName.values()].map((row, index) => ({ ...row, displayOrder: index }));
};

/**
 * A group's row `kind`. A `sauceRule` group's rows ARE sauces — asserted rather than trusted,
 * because every sauce rule downstream is gated on the rows' `kind`, not on the group's target.
 */
const kindOf = (decision, id) => {
  const kind = decision.kind ?? (decision.target === 'sauceRule' ? 'sauce' : 'ingredient');
  if (decision.target === 'sauceRule' && kind !== 'sauce') {
    throw new Error(`modifier group ${id} targets "sauceRule" but declares kind "${kind}"`);
  }
  return kind;
};

/**
 * `isOptional` / `isIncludedInBasePrice` — THE PAIR THAT DECIDES WHAT THE APP PRESELECTS, and the
 * pair that put a 400 in front of every guest of the first tenant this script imported.
 *
 * `buildBaseIngredientSelection` (src/utils/ingredientSelection.ts) preselects a row when
 * `!isOptional || isIncludedInBasePrice === true`. The sauce group declared NEITHER flag,
 * `JSON.stringify` drops `undefined`, the server read both as false — so the app's own default
 * payload asked for all 11 sauce rows against a `sauceMax` of 2 and `POST /api/Basket/items`
 * answered **400 SauceMaximumExceeded** on every savoury dish, from the day the tenant opened.
 * 50 products. No offline check objected, because each field was individually plausible.
 *
 * So: a sauce is `isOptional: true, isIncludedInBasePrice: false`, always, whatever the source
 * group says. What makes a sauce REQUIRED is the group rule (`sauceMin`/`sauceMax`/
 * `sauceIncludedFree`), never the ingredient flag — and a non-optional sauce is not merely
 * preselected, it is also dropped from the free allowance, which `waivedSauceUnits` allocates
 * only over rows that are `isSauce && isOptional && isActive`.
 *
 * Every other group must declare both flags EXPLICITLY. An absent key reading as `false` is
 * exactly how this shipped, so a missing decision is an error, not a default.
 */
const rowFlags = (decision, kind, id) => {
  if (kind === 'sauce') return { isOptional: true, isIncludedInBasePrice: false };
  for (const field of ['isOptional', 'isIncludedInBasePrice']) {
    if (typeof decision[field] !== 'boolean') {
      throw new TypeError(
        `modifier group ${id} emits ingredient rows but its ${field} is ${decision[field]} — ` +
          'declare it explicitly in decisions.json; an absent flag reads as false and preselects the row',
      );
    }
  }
  return { isOptional: decision.isOptional, isIncludedInBasePrice: decision.isIncludedInBasePrice };
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
    const kind = kindOf(decision, id);
    const flags = rowFlags(decision, kind, id);
    for (const option of source.options) {
      if (isDropped(decisions, id, option.name)) continue;
      const name = ingredientName(decisions, option.name, decision.stripPrefix === true);
      out.push({
        name,
        isOptional: flags.isOptional,
        price: round2(option.price ?? 0),
        isIncludedInBasePrice: flags.isIncludedInBasePrice,
        isActive: true,
        displayOrder: displayOrder++,
        maxQuantity: 1,
        kind,
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
const FAMILY_OF = { 81: 'meat', 83: 'meat', 84: 'meat', 85: 'meat', 87: 'gift' };

/**
 * Group 79 `Boissons` is deliberately NOT here. Its options are drinks the restaurant already
 * sells, and a bundle's drink section must reference THOSE — see `drinkRefs`.
 */
const DRINK_GROUP = 79;

/**
 * How a section item and a menu's dish are named before the server has given anything an id.
 * ONE namespace for both kinds of referent, because a section may legitimately point at either a
 * hidden component or a real catalogue product, and `import.mjs` must be able to tell which
 * without guessing. Resolved there, in `resolveRef`.
 */
const componentRef = (family, name) => `component:${family}:${name.toLowerCase()}`;
const productRef = (sourceId) => `product:${sourceId}`;

/**
 * A component's own price, and it is INERT — the guest is never charged it.
 *
 * Measured in the backend rather than assumed: a bundle child's money comes from the SECTION
 * ITEM, not from the product. `BasketItemFactory` line 181
 * `price += sectionItem.AdditionalPrice * selection.Quantity`, and line 280
 * `UnitPrice = sectionItem.AdditionalPrice` with `ItemTotal = 0`. We set every
 * `additionalPrice` to 0, so choosing a drink inside a menu adds nothing — which is what the
 * platform's own reference tenant does too (`additionalPrice: 0.0` on every section item).
 *
 * It cannot be 0, though: `CreateProductCommandValidator` refuses "Base price must be greater
 * than 0", measured against the live tenant. So it is a nominal 0.01 — deliberately a value
 * nobody can mistake for a real price, on a row `isComponent: true` already keeps out of the
 * catalogue and off the menu.
 */
const COMPONENT_NOMINAL_PRICE = 0.01;

/** Their names differ in spacing and case between a size and the menu that wraps it. */
const normaliseName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The bundle groups in a list — the ones that become sections rather than rows. */
const bundleGroupsIn = (decisions, groupIds) => groupIds.filter((id) => groupOf(decisions, id).target === 'bundle');

/** Every item that survives `dropProducts`, with the category it came from. */
const eachItem = function* (dataset, decisions) {
  for (const category of dataset.menu) {
    for (const item of category.items) {
      if (Object.hasOwn(decisions.dropProducts, String(item.sourceId))) continue;
      yield { category, item };
    }
  }
};

/**
 * The portion a `Menu …` size actually wraps, when it is not the product's default one.
 *
 * `Menu 12 X Nuggets` (15,00 €) wraps `12X Nuggets` (12,00 €), not the base `6 X Nuggets`
 * (7,00 €) — and pointing it at the base is what shipped: a MenuSectionItem carries a
 * `productId` and no variation, so the large portion was unreachable and the guest paid
 * 15,00 € for six. Matched on the name with the `Menu ` prefix stripped and everything but
 * letters and digits removed, because their spacing is inconsistent (`12X` vs `12 X`), and
 * REFUSED when the match is not unique. `verifyMenuUplift` then re-derives the answer from the
 * prices, which is the independent signal: a menu pointed at the wrong portion has a different
 * uplift from its siblings on the same product.
 *
 * `null` means the default size, i.e. the parent product itself.
 */
const wrappedPortion = (decisions, item, menuSize) => {
  const wanted = normaliseName(menuSize.name).replace(/^menu/, '');
  const matches = (item.sizes ?? []).filter(
    (size) => !size.isDefault && !isMenuSize(decisions, size) && normaliseName(size.name) === wanted,
  );
  if (matches.length > 1) {
    throw new Error(`"${menuSize.name}" on ${item.name} matches ${matches.length} portions — ambiguous`);
  }
  return matches[0] ?? null;
};

/**
 * The dishes whose recipe has to move to a carrier: every product that carries a bundle group,
 * and is therefore `type: menu`, and therefore stores no composition of its own.
 */
const recipeCarriers = (dataset, decisions, merges = []) => {
  const out = [];
  for (const { category, item } of eachItem(dataset, decisions)) {
    const groupIds = governingGroupIds(item);
    if (!bundleGroupsIn(decisions, groupIds).length) continue;
    out.push({
      productId: item.sourceId,
      name: item.name,
      categoryId: category.sourceId,
      detailedIngredients: ingredientsFor(decisions, groupIds, dataset.modifierGroups, merges, item.name),
      ...sauceRuleFor(decisions, groupIds),
    });
  }
  return out;
};

/** The non-default portions a menu size wraps — one component each. */
const largePortions = (dataset, decisions) => {
  const out = [];
  for (const { category, item } of eachItem(dataset, decisions)) {
    for (const size of item.sizes ?? []) {
      if (!isMenuSize(decisions, size)) continue;
      const portion = wrappedPortion(decisions, item, size);
      if (portion) out.push({ name: portion.name, categoryId: category.sourceId, price: portion.price });
    }
  }
  return out;
};

/**
 * The drink section's items: the REAL beverages, by an explicit map in `decisions.json`.
 *
 * Not matched by name, because their names do not match — the option `Coca Cola` is the product
 * `Coca Cola 33cl`, `Fanta` is `Fanta Orange`, `Eau` is `Eau 50cl`, and `Coca Cola Cherry` is
 * `Coca Coca Cherry 33cl`, typo and all. A fuzzy match over four of eleven is exactly the guess
 * this pack refuses to make, so an unmapped option is an error.
 */
const drinkRefs = (dataset, decisions) => {
  const map = decisions.bundles.drinkProducts ?? {};
  const known = new Map();
  for (const { item } of eachItem(dataset, decisions)) known.set(item.sourceId, item.name);
  const group = dataset.modifierGroups.find((g) => g.id === DRINK_GROUP);
  return group.options
    .filter((option) => !isDropped(decisions, DRINK_GROUP, option.name))
    .map((option) => {
      const id = map[option.name];
      if (id === undefined) {
        throw new Error(`drink option "${option.name}" has no entry in decisions.bundles.drinkProducts`);
      }
      if (!known.has(id)) {
        throw new Error(`drink option "${option.name}" names product ${id}, which is not being created`);
      }
      return productRef(id);
    });
};

const componentBody = (name, extra = {}) => ({
  name,
  description: null,
  basePrice: COMPONENT_NOMINAL_PRICE,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  preparationTimeMinutes: 0,
  type: PRODUCT_TYPE.main,
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
  ...extra,
});

/**
 * The hidden option products the bundle sections point at. Three families, and each one exists
 * because a REAL product cannot do the job:
 *
 *   meat / gift  — group 81's meat option "Kebab" name-matches the SANDWICHES product "Kebab"
 *                  (8,00 €), and pointing a Tacos' meat section at that would put a whole priced
 *                  sandwich inside the tacos.
 *   dish         — a `type: menu` product's OWN `detailedIngredients` and sauce rule are DEAD:
 *                  `buildBundleSteps` maps sections only and `BasketItemFactory.BuildMenuItemAsync`
 *                  never reads the parent's `SelectedIngredients`, so the parent row stores no
 *                  composition at all. 11 dishes shipped carrying a recipe no guest could see or
 *                  change. The recipe moves to a carrier behind a one-item `Plat` section — the
 *                  shape that already makes `Menu Kebab` work.
 *   portion      — a portion sold as a SIZE is unreachable from a bundle, because a
 *                  `MenuSectionItem` carries a `productId` and nothing else. `Menu 12 X Nuggets`
 *                  charged 15,00 € and delivered `6 X Nuggets`. Each such portion gets its own
 *                  component. 5 of them, all TEXMEX.
 *
 * Drinks are NOT a family. They were, and that built a parallel catalogue: 11 phantom 0,01 €
 * copies, so an admin's price edit reached no menu and a sold-out drink stayed orderable inside
 * every bundle. A drink section references the real `beverage` products — `decisions.bundles.drinkProducts`.
 */
const buildComponents = (dataset, decisions, carriers, portions) => {
  const groups = new Map(dataset.modifierGroups.map((g) => [g.id, g]));
  const byKey = new Map();
  const add = (family, name, categoryId, extra) => {
    const key = `${family}:${name.toLowerCase()}`;
    if (byKey.has(key)) return;
    byKey.set(key, { source: { family, name, categoryId }, body: componentBody(name, extra) });
  };

  for (const [id, decision] of Object.entries(decisions.modifierGroups)) {
    if (id === '_' || decision.target !== 'bundle' || Number(id) === DRINK_GROUP) continue;
    const family = FAMILY_OF[Number(id)];
    if (!family) throw new Error(`bundle group ${id} has no component family`);
    for (const option of groups.get(Number(id)).options) {
      if (isDropped(decisions, Number(id), option.name)) continue;
      add(family, ingredientName(decisions, option.name, false), decisions.bundles.componentCategories[family]);
    }
  }

  // A carrier's category is the DISH's own, not a fixed bucket: it is hidden either way, and a
  // wrong category on a hidden row is one more thing to explain to whoever reads the admin.
  for (const carrier of carriers) {
    add('dish', carrier.name, carrier.categoryId, {
      detailedIngredients: carrier.detailedIngredients,
      sauceMin: carrier.sauceMin,
      sauceMax: carrier.sauceMax,
      sauceIncludedFree: carrier.sauceIncludedFree,
    });
  }
  for (const portion of portions) {
    add('portion', portion.name, portion.categoryId);
  }
  return [...byKey.values()];
};

/** A section, from the group it came from. `itemRefs` are resolved by import.mjs. */
const sectionFor = (decisions, groupId, drinks) => {
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
    // The drink section points at the REAL beverages; every other section at hidden components.
    itemRefs: Number(groupId) === DRINK_GROUP ? drinks : options.map((name) => componentRef(family, name)),
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

const buildProducts = (dataset, decisions, { drinks, carriers }) => {
  const out = [];
  const carrierOf = new Map(carriers.map((carrier) => [carrier.productId, carrier]));
  for (const { category, item } of eachItem(dataset, decisions)) {
    const groupIds = governingGroupIds(item);
    const bundleGroups = bundleGroupsIn(decisions, groupIds);
    const sections = bundleGroups.map((id) => sectionFor(decisions, id, drinks));
    const carrier = carrierOf.get(item.sourceId) ?? null;
    const variations = variationsFor(decisions, item);
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
        type: sections.length ? PRODUCT_TYPE.menu : typeOf(decisions, category),
        kitchenType: 'None',
        ingredients: null,
        allergens: null,
        displayOrder: item.sortOrder ?? 0,
        categoryIds: [],
        primaryCategoryId: null,
        // Their model is N sizes with exactly one default, so the unsized "base" row is
        // not a thing a guest may order. Left false, the 29 sized products each show a
        // third option priced identically to their default size.
        //
        // Derived from the EMITTED variations, never from the source size count. Those were the
        // same number until the `Menu …` sizes became bundles and left the variation list —
        // after which 24 products carried the flag with nothing left to sell instead.
        // `isBaseRowHidden` degrades that back to false on client and server, so nothing was
        // unorderable; it is a lie stored in the catalogue and shown ticked in the admin.
        hideBaseProduct: variations.length > 0,
        variations,
        suggestedSideItemIds: [],
        // A dish carrying sections is `type: menu`, and a menu's own ingredients and sauce rule
        // are DEAD DATA — see `buildComponents`. Its recipe lives on the carrier instead.
        detailedIngredients: carrier ? [] : ingredientsFor(decisions, groupIds, dataset.modifierGroups),
        content: content(item.name, item.description),
        ...(carrier ? { sauceMin: 0, sauceMax: null, sauceIncludedFree: 0 } : sauceRuleFor(decisions, groupIds)),
      },
      // The one-item `Plat` section import.mjs prepends. A sectioned dish points at its recipe
      // carrier; an ordinary product has no Plat of its own.
      platRef: carrier ? componentRef('dish', carrier.name) : undefined,
      sections,
    });
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
/** One line per unbuilt group, naming a few of the products that would lose the step. */
const describeUnbuilt = (id, items, decisions) => {
  const { sourceName } = decisions.modifierGroups[id];
  const shown = items.slice(0, 3).join(', ');
  const more = items.length > 3 ? ' …' : '';
  return `group ${id} (${sourceName}) on ${items.length}: ${shown}${more}`;
};

/**
 * Every bundle group a surviving product references, product-level and size-level alike.
 *
 * EVERY reference, not just the governing list: a menu-only step like group 79 (`Boissons`)
 * hangs off the PRODUCT and off the "Menu X" size, never off the default one — so a
 * governing-list-only sweep reports it as absent and would certify a catalogue whose entire
 * drink step is missing.
 */
const bundleGroupsReferencedBy = (item, decisions) => {
  const referenced = new Set([
    ...(item.modifierGroupIds ?? []),
    ...(item.sizes ?? []).flatMap((size) => size.modifierGroupIds ?? []),
  ]);
  return [...referenced].filter((id) => groupOf(decisions, id).target === 'bundle');
};

export const unbuiltBundlesInUse = (dataset, decisions, built = null) => {
  const used = new Map();
  for (const category of dataset.menu) {
    for (const item of category.items) {
      if (Object.hasOwn(decisions.dropProducts, String(item.sourceId))) continue;
      for (const id of bundleGroupsReferencedBy(item, decisions)) {
        if (built?.has(String(id))) continue;
        used.set(String(id), [...(used.get(String(id)) ?? []), item.name]);
      }
    }
  }
  return (
    [...used.entries()]
      .map(([id, items]) => describeUnbuilt(id, items, decisions))
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
const buildMenuBundles = (dataset, decisions, { drinks, carriers, portions }) => {
  const out = [];
  const carrierOf = new Map(carriers.map((carrier) => [carrier.productId, carrier]));
  for (const { category, item } of eachItem(dataset, decisions)) {
    for (const size of item.sizes ?? []) {
      if (!isMenuSize(decisions, size)) continue;
      const referenced = new Set([...(item.modifierGroupIds ?? []), ...(size.modifierGroupIds ?? [])]);
      const bundleGroups = bundleGroupsIn(decisions, [...referenced]);
      const portion = wrappedPortion(decisions, item, size);
      const carrier = carrierOf.get(item.sourceId) ?? null;
      // The menu's dish, in order of specificity:
      //
      //   a PORTION component — the menu wraps a SIZE, not the product ("Menu 12 X Nuggets");
      //   the dish's RECIPE CARRIER — the dish is itself sectioned, so pointing at the dish
      //     would nest a second meat choice inside the menu's own;
      //   the parent PRODUCT — the ordinary case, and kebabdilhan's shape.
      let platRef = productRef(item.sourceId);
      if (portion) platRef = componentRef('portion', portion.name);
      else if (carrier) platRef = componentRef('dish', carrier.name);
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
        // What the menu's one-item `Plat` section points at, resolved to a real id by import.mjs.
        platRef,
        // Kept for `--verify`: which product this menu came off, whatever its Plat resolves to.
        parentId: item.sourceId,
        sections: bundleGroups.map((id) => sectionFor(decisions, id, drinks)),
      });
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
  // Computed ONCE and threaded, because three builders need the same answer and a second
  // derivation is how two of them come to disagree about which dish carries which recipe.
  // `merges` is collected here, so a duplicate ingredient is still reported under its DISH's
  // name even though the rows now live on that dish's carrier.
  const carriers = recipeCarriers(dataset, decisions, merges);
  const portions = largePortions(dataset, decisions);
  const drinks = drinkRefs(dataset, decisions);
  const parts = { drinks, carriers, portions };
  return {
    dataset,
    decisions,
    categories: buildCategories(dataset),
    components: buildComponents(dataset, decisions, carriers, portions),
    products: buildProducts(dataset, decisions, parts),
    menus: buildMenuBundles(dataset, decisions, parts),
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
const sectionFailures = (ownerName, section, resolves) => {
  const where = `${ownerName}/${section.name}`;
  const out = [];
  if (!section.name) out.push(`${ownerName}: a section has no name`);
  if (!section.itemRefs.length) out.push(`${where}: no options`);
  if (section.minSelection > section.maxSelection) {
    out.push(`${where}: min ${section.minSelection} > max ${section.maxSelection}`);
  }
  for (const ref of section.itemRefs) {
    if (!resolves(ref)) out.push(`${where}: "${ref}" resolves to nothing`);
  }
  return out;
};

/**
 * Every section item and every `Plat` must name something this run actually creates — a hidden
 * component or a real catalogue product. `import.mjs` throws on an unresolvable ref mid-import,
 * after earlier records already exist, so it is worth knowing offline.
 */
const verifySections = (products, menus, components) => {
  const componentKeys = new Set(components.map((c) => `component:${c.source.family}:${c.source.name.toLowerCase()}`));
  const productKeys = new Set(products.map((p) => `product:${p.source.id}`));
  const resolves = (ref) => componentKeys.has(ref) || productKeys.has(ref);
  const failures = [];
  for (const owner of [...products, ...menus]) {
    for (const section of owner.sections ?? []) {
      failures.push(...sectionFailures(owner.body.name, section, resolves));
    }
    if (owner.platRef !== undefined && !resolves(owner.platRef)) {
      failures.push(`${owner.body.name}: its Plat "${owner.platRef}" resolves to nothing`);
    }
  }
  return failures;
};

/**
 * A `type: menu` product may not carry its OWN recipe or sauce rule.
 *
 * `buildBundleSteps` maps sections and nothing else, and `BasketItemFactory.BuildMenuItemAsync`
 * never reads the parent's `SelectedIngredients` — the parent row stores no composition at all.
 * So rows on a menu are not merely redundant, they are invisible: the guest cannot see them, the
 * kitchen ticket does not carry them, and the admin who edits them changes nothing. 11 dishes
 * shipped that way. The referent is the platform's step builder, not this file's intent.
 */
const verifyMenusCarryNoRecipe = (products, menus) => {
  const failures = [];
  for (const owner of [...products, ...menus]) {
    if (owner.body.type !== PRODUCT_TYPE.menu) continue;
    const rows = owner.body.detailedIngredients.length;
    if (rows) {
      failures.push(
        `${owner.body.name}: a type=menu product carries ${rows} of its own ingredients — dead data. ` +
          'Put the recipe on a hidden component behind its one-item Plat section',
      );
    }
    if (owner.body.sauceMin || owner.body.sauceMax !== null || owner.body.sauceIncludedFree) {
      failures.push(`${owner.body.name}: a type=menu product carries its own sauce rule — dead data, same reason`);
    }
    if (owner.platRef === undefined) {
      failures.push(`${owner.body.name}: a type=menu product with no Plat — nothing names the dish it sells`);
    }
  }
  return failures;
};

/**
 * THE CHECK THAT CATCHES A MENU POINTED AT THE WRONG DISH, and it is an oracle rather than a
 * mirror: every menu on this carte is its dish plus a fixed uplift (3,00 € throughout), so the
 * menus of ONE product must all show the SAME uplift over whatever their Plat advertises.
 *
 * `Menu 12 X Nuggets` (15,00 €) pointed at the base `6 X Nuggets` (7,00 €) gives an uplift of
 * 8,00 € beside its sibling's 3,00 € — which is how a guest came to pay 15,00 € for six nuggets.
 * Nothing structural could see it: the reference was to a real, existing product.
 */
const verifyMenuUplift = (menus, products, components, dataset) => {
  const priceOfRef = new Map();
  for (const product of products) priceOfRef.set(`product:${product.source.id}`, product.body.basePrice);
  for (const component of components) {
    // A component's own basePrice is the nominal 0,01 — what the guest is being sold is the
    // SOURCE price of the portion or dish it stands for, which is what the uplift is against.
    priceOfRef.set(`component:${component.source.family}:${component.source.name.toLowerCase()}`, null);
  }
  const sourcePrices = new Map();
  for (const category of dataset.menu) {
    for (const item of category.items) {
      sourcePrices.set(normaliseName(item.name), item.price);
      for (const size of item.sizes ?? []) sourcePrices.set(normaliseName(size.name), size.price);
    }
  }

  const upliftsByParent = new Map();
  const failures = [];
  for (const menu of menus) {
    const direct = priceOfRef.get(menu.platRef);
    const platPrice = direct ?? sourcePrices.get(normaliseName(menu.platRef.split(':').at(-1)));
    if (platPrice === undefined) {
      failures.push(`${menu.body.name}: cannot price its Plat "${menu.platRef}"`);
      continue;
    }
    const uplift = round2(menu.body.basePrice - platPrice);
    upliftsByParent.set(menu.parentId, [...(upliftsByParent.get(menu.parentId) ?? []), { menu, uplift }]);
  }
  for (const [, entries] of upliftsByParent) {
    const distinct = [...new Set(entries.map((entry) => entry.uplift))];
    if (distinct.length > 1) {
      const shown = entries.map((entry) => `${entry.menu.body.name} +${entry.uplift}`).join(', ');
      failures.push(`menus of one product disagree on their uplift — ${shown}`);
    }
  }
  return failures;
};

/**
 * THE CHECK THAT WOULD HAVE CAUGHT THE 400. It builds the payload the app itself builds for a
 * freshly-opened sheet — `buildBaseIngredientSelection`'s rule, mirrored — and asks whether the
 * server would accept it. Both ends are external to this file: the rule is the util's, the
 * ceiling is the server's `SauceMaximumExceeded`. Every other ingredient check here asks whether
 * the payload is the shape the mapper meant to emit; this one asks whether it can be ORDERED.
 *
 * Keep it MIRRORING the util rather than restating the fix — a check written as
 * "assert isOptional === true" would not move when the preselect rule does.
 */
const verifyDefaultSelection = (owners) => {
  const failures = [];
  for (const owner of owners) {
    const preselected = owner.body.detailedIngredients.filter(
      (i) => i.isActive && (!i.isOptional || i.isIncludedInBasePrice === true),
    );
    const sauces = preselected.filter((i) => i.kind === 'sauce').length;
    const { sauceMax, name } = owner.body;
    if (sauceMax !== null && sauceMax !== undefined && sauces > sauceMax) {
      failures.push(
        `${name}: the app's own default selection carries ${sauces} sauces against sauceMax ` +
          `${sauceMax} — POST /api/Basket/items answers 400 SauceMaximumExceeded`,
      );
    }
  }
  return failures;
};

/**
 * `hideBaseProduct` against the platform's own rule, not against the mapper's. `isBaseRowHidden`
 * (src/utils/baseProductVisibility.ts, mirrored by the backend guard) honours the flag only when
 * an ACTIVE variation is left to sell instead — so the flag on a product with none is a statement
 * the platform refuses to act on. 24 products shipped with it, because it was derived from the
 * SOURCE size count after the `Menu …` sizes had left the variation list.
 */
const verifyBaseRow = (products) => {
  const failures = [];
  for (const product of products) {
    const active = product.body.variations.filter((variation) => variation.isActive !== false);
    if (product.body.hideBaseProduct && active.length === 0) {
      failures.push(
        `${product.body.name}: hideBaseProduct with no active variation — isBaseRowHidden degrades ` +
          'it to false, so the flag is stored, shown in the admin, and acted on by nothing',
      );
    }
  }
  return failures;
};

/**
 * The product type each category was given, against the category's OWN NAME — an external
 * referent, and the only one available offline: the restaurant called the category BOISSONS, so
 * a product in it is not a main dish. Without this, `decisions.productTypes` is self-certifying.
 */
const CATEGORY_NAME_TYPES = [
  [/boisson|drink|beverage/i, 'beverage'],
  [/dessert/i, 'dessert'],
];

const verifyProductTypes = (dataset, decisions) => {
  const failures = [];
  for (const category of dataset.menu) {
    const decided = decisions.productTypes?.[String(category.sourceId)];
    for (const [pattern, expected] of CATEGORY_NAME_TYPES) {
      if (pattern.test(category.name) && decided !== expected) {
        failures.push(`category "${category.name}" is typed "${decided}" — its own name says "${expected}"`);
      }
    }
  }
  return failures;
};

/**
 * A DRINK section names the real beverages, never a hidden copy of one.
 *
 * The first import pointed all 34 menus' drink sections at 11 phantom 0,01 € `isComponent` copies.
 * Everything about that reads fine — the menus work, the guest sees eleven drinks — and it is a
 * parallel catalogue: the admin's price edit reaches no menu, and a drink marked sold out stays
 * orderable inside every bundle. The referent is what the platform's own reference tenant does.
 */
/** What is wrong with one drink item, or `null`. Split out to keep the sweep below flat. */
const drinkRefFailure = (where, ref, componentByRef, productByRef) => {
  if (componentByRef.has(ref)) {
    return (
      `${where}: "${ref}" is a hidden component copy of a drink — a price edit on the real ` +
      'product would reach no menu, and a sold-out drink would stay orderable'
    );
  }
  const product = productByRef.get(ref);
  if (product && product.body.type !== PRODUCT_TYPE.beverage) {
    return `${where}: "${product.body.name}" is not type beverage`;
  }
  return null;
};

const verifyDrinkSections = (products, menus, components) => {
  const componentByRef = new Map(
    components.map((c) => [`component:${c.source.family}:${c.source.name.toLowerCase()}`, c]),
  );
  const productByRef = new Map(products.map((p) => [`product:${p.source.id}`, p]));
  const failures = [];
  for (const owner of [...products, ...menus]) {
    const drinkSections = (owner.sections ?? []).filter((s) => String(s.__groupId) === String(DRINK_GROUP));
    for (const section of drinkSections) {
      const where = `${owner.body.name}/${section.name}`;
      const found = section.itemRefs.map((ref) => drinkRefFailure(where, ref, componentByRef, productByRef));
      failures.push(...found.filter(Boolean));
    }
  }
  return failures;
};

/**
 * A bundle section whose NAME sells a number must REQUIRE that number.
 *
 * Their groups say `minSelect: 1, maxSelect: N` on a group they themselves called "3 Viandes",
 * sold on "Tacos 3 Viande" at the three-meat price. Carried across literally that is 9 sections on
 * which a guest pays 13,00 € for three meats and may leave with one — legal server-side, invisible
 * to every structural check, and a refund conversation. The referent is their own group name.
 */
const verifySectionCounts = (decisions) => {
  const failures = [];
  for (const [id, group] of Object.entries(decisions.modifierGroups)) {
    if (id === '_' || group.target !== 'bundle') continue;
    const sold = Number(/^(\d+)\b/.exec(group.sourceName ?? '')?.[1]);
    if (Number.isInteger(sold) && sold === group.maxSelection && group.minSelection !== sold) {
      failures.push(
        `group ${id} (${group.sourceName}): its name sells ${sold} and maxSelection is ${sold}, but ` +
          `minSelection is ${group.minSelection} — a guest pays for ${sold} and may pick ${group.minSelection}`,
      );
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

/**
 * No product may be priced at or below zero — the server refuses it, and the refusal arrives
 * mid-import after earlier records are already created.
 */
const verifyPositivePrices = (products, menus, components) => {
  const failures = [];
  for (const item of [...products, ...menus, ...components]) {
    // `<= 0` rather than `!(> 0)`: the same set, said once. NaN cannot reach here — every
    // basePrice is produced by round2() over a number from their API.
    if (item.body.basePrice <= 0) {
      failures.push(`${item.body.name}: basePrice ${item.body.basePrice} — the server requires > 0`);
    }
  }
  return failures;
};

/**
 * The self-check, whole. Split out of `main` so the entry point is argument handling and
 * nothing else — and because this is the part a reader comes here to read.
 */
const runVerify = ({ dataset, decisions, categories, components, products, menus, merges, pending, unbuilt }) => {
  // EVERY row that carries a recipe, products and components alike. NOT `products`: the 11 dishes
  // that became `type: menu` had their ingredients and sauce rule moved onto hidden carriers, and
  // a gate scoped to `products` would simply have stopped seeing them — six checks going quietly
  // vacuous over the exact rows the move was supposed to preserve.
  const recipeOwners = [...products, ...components];
  const variations = products.reduce((n, p) => n + p.body.variations.length, 0);
  const ingredients = recipeOwners.reduce((n, p) => n + p.body.detailedIngredients.length, 0);
  const sauced = recipeOwners.filter((p) => p.body.sauceMin > 0).length;
  const sauceRows = recipeOwners.reduce(
    (n, p) => n + p.body.detailedIngredients.filter((i) => i.kind === 'sauce').length,
    0,
  );
  const sectioned = [...products, ...menus].filter((p) => (p.sections ?? []).length);
  const byType = products.reduce((counts, p) => counts.set(p.body.type, (counts.get(p.body.type) ?? 0) + 1), new Map());
  const byFamily = components.reduce(
    (counts, c) => counts.set(c.source.family, (counts.get(c.source.family) ?? 0) + 1),
    new Map(),
  );

  console.log(`categories                 ${categories.length}`);
  console.log(`products                   ${products.length}`);
  // Per TYPE, not as a total. `Type=Beverage` answering 0 is the whole of the drinks-upsell
  // defect, and it is a number a reader can see is wrong at a glance.
  // A compare function on the KEY, not a bare .sort(): the default stringifies each
  // `[name, count]` pair and sorts the concatenation, so the order would silently depend on the
  // counts. Same trap the group-id lists below already carry a comment about.
  const byName = (a, b) => a[0].localeCompare(b[0], 'en');
  for (const [type, count] of [...byType].sort(byName)) console.log(`  …typed ${type.padEnd(19)}${count}`);
  console.log(`menu bundles (type=menu)   ${menus.length}`);
  console.log(`hidden components          ${components.length}`);
  for (const [family, count] of [...byFamily].sort(byName)) console.log(`  …family ${family.padEnd(18)}${count}`);
  console.log(`products carrying sections ${sectioned.length}`);
  console.log(`variations                 ${variations}`);
  console.log(`recipe rows (+ carriers)   ${ingredients}`);
  console.log(`rows with a sauce rule     ${sauced}`);
  console.log(`  …of which sauce rows      ${sauceRows}`);
  if (merges.length) {
    console.log(`\nmerged duplicate ingredients (${merges.length}) — the included row won:`);
    for (const line of merges) console.log(`  ${line}`);
  }
  console.log('');

  const checks = [
    ['every variation re-derives to THEIR absolute price', verifyPrices(products)],
    ['no admin shorthand or dotless ı reaches a guest string', verifyStrings(recipeOwners)],
    [`every guest string carries all ${LANGS.length} languages, description included`, verifyContent(recipeOwners)],
    ['every product with a sauce RULE carries the sauce ROWS to satisfy it', verifySauces(recipeOwners)],
    ['no ingredient is marked mutually exclusive', verifyExclusionGroups(recipeOwners)],
    ['no product names the same ingredient twice', verifyNoDuplicateIngredients(recipeOwners)],
    ['no guest-facing ingredient is still phrased as a removal', verifyNoNegatedNames(recipeOwners)],
    ["the app's own default selection is ORDERABLE (sauces within sauceMax)", verifyDefaultSelection(recipeOwners)],
    ['hideBaseProduct only where there is an active variation to sell instead', verifyBaseRow(products)],
    ["every category's product type agrees with the category's own name", verifyProductTypes(dataset, decisions)],
    ['no type=menu product carries its own (dead) recipe or sauce rule', verifyMenusCarryNoRecipe(products, menus)],
    [
      'every drink section names the REAL beverages, not hidden copies',
      verifyDrinkSections(products, menus, components),
    ],
    ['every bundle section REQUIRES the count its name sells', verifySectionCounts(decisions)],
    [
      'every bundle section and Plat resolves to something this run creates',
      verifySections(products, menus, components),
    ],
    ["every menu's price is THEIR absolute price", verifyMenuPrices(menus)],
    [
      'every menu of one product shows the SAME uplift over its Plat',
      verifyMenuUplift(menus, products, components, dataset),
    ],
    ['every product has a basePrice > 0 (the server refuses 0)', verifyPositivePrices(products, menus, components)],
    ['every modifier group in use has a CONFIRMED meaning', pending.map((x) => `${x} is unconfirmed — decisions.json`)],
    [
      'every modifier group in use is BUILT by this file',
      unbuilt.map((x) => `${x} — target "bundle", not implemented yet`),
    ],
  ];
  let failed = 0;
  for (const [label, failures] of checks) {
    failed += failures.length;
    console.log(failures.length ? `FAIL ${label}\n  ${failures.join('\n  ')}` : `ok   ${label}`);
  }
  if (failed) return false;
  console.log('\nmap: all checks passed');
  return true;
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
    const ok = runVerify({ dataset, decisions, categories, components, products, menus, merges, pending, unbuilt });
    if (!ok) process.exit(1);
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
