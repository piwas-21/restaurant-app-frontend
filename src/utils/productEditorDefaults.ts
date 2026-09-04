import type { MenuDefinition } from '@/types/menu';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

/**
 * Pure `fetched product → editor form state` mapping for the unified admin editor
 * (menu-bundles redesign #176, slice 7 PR2d). Lifted out of `EditProductModal` /
 * `EditMenuBundleModal` so the one mapping both kinds depend on can be tested without
 * rendering a form — it is the load-bearing part of the editor.
 */

/**
 * A blank product for the create route (`/new`). It is the same `ProductDetails` shape the
 * fetched-product mappers read, so create reuses `toItemDefaults` / `toBundleDefaults` with
 * empty values instead of a second set of create-defaults — a bundle's empty `menuDefinition`
 * falls through to `EMPTY_MENU_DEFINITION` in `toMenuDefinitionState`.
 */
export function emptyProductDetails(isBundle: boolean): ProductDetails {
  return {
    id: '',
    name: '',
    description: '',
    basePrice: 0,
    isActive: true,
    isAvailable: true,
    isSpecial: false,
    hideBaseProduct: false,
    isComponent: false,
    preparationTimeMinutes: 0,
    type: isBundle ? 'menu' : 'mainItem',
    ingredients: [],
    allergens: [],
    categories: [],
    variations: [],
    images: [],
    suggestedSideItems: [],
    content: {},
  };
}

/** A bundle with no saved definition still needs one to edit against. */
export const EMPTY_MENU_DEFINITION: MenuDefinition = {
  id: '',
  isAlwaysAvailable: true,
  availableMonday: true,
  availableTuesday: true,
  availableWednesday: true,
  availableThursday: true,
  availableFriday: true,
  availableSaturday: true,
  availableSunday: true,
  sections: [],
};

interface ContentEntry {
  language: string;
  name: string;
  description?: string;
}

/**
 * Absent, empty and whitespace-only are one state here. Restated rather than imported from
 * `translations/translationSlots.ts`, which exports the identical predicate: that module is a
 * component-folder module and this one is a `utils/` module every editor entry point already
 * depends on — importing upward would invert the direction of that dependency for four characters
 * of code.
 */
const isBlank = (value: string | null | undefined): boolean => (value ?? '').trim().length === 0;

/**
 * `{ en: { name, description } }` → the flat rows `useFieldArray` renders, WITH a blank stored name
 * repaired from the item's own name (#641).
 *
 * A stored translation row whose name is blank used to make the item unsavable, permanently:
 * `contentSchema.name` is `min(1)`, the rows are seeded verbatim, so the resolver refused
 * `content.N.name` and `handleSubmit` never ran — losing an unrelated edit on a field the admin
 * never touched and could not see. Refusing such a row at the door (frontend #450, backend #325)
 * stops NEW ones; it does nothing for a row an earlier client or an import already left behind, and
 * "the item can never be saved again" is not a state an editor may leave an admin in.
 *
 * THE REPAIR IS THE ITEM'S OWN NAME, and that choice is not arbitrary: every guest surface resolves
 * a display name as `content[lang]?.name || content.en?.name || item.name` (`localizedContent.ts`,
 * `mappers.ts`, `imageHelpers.ts`), so a blank row already renders as the item's own name TODAY.
 * Writing that value into the field changes nothing a guest sees; it only makes the row expressible
 * in a form whose schema requires a name.
 *
 * Not a deletion, deliberately — that was #641's option 2. Pruning the row would throw away its
 * DESCRIPTION, which is the one part of a half-row that carries information the admin cannot
 * reconstruct. The name is recoverable by definition (it is the item's); the description is not.
 *
 * `isBlank`, not `=== ''`: `min(1)` counts `"   "` as three valid characters, so whitespace-only is
 * the spelling that reached the database with a 200 (backend #325) and it is the one a `=== ''`
 * guard would miss.
 */
export function flattenContent(content: ProductDetails['content'], fallbackName = ''): ContentEntry[] {
  if (!content) return [];
  return Object.entries(content as Record<string, { name?: string; description?: string }>).map(([language, data]) => ({
    language,
    name: isBlank(data?.name) ? fallbackName : (data?.name as string),
    description: data?.description ?? '',
  }));
}

/**
 * The product's real primary category id.
 *
 * The modals read `product.primaryCategoryId`, which **no response DTO carries** — the API
 * returns `primaryCategory` as an object (projected from whichever `ProductCategory` has
 * `IsPrimary`), and each row carries its own `isPrimary`. That read was therefore always
 * `undefined` and always fell through to "the first category", so editing a product whose
 * primary was not first silently re-pointed it on save. Prefer the real signal, keeping the
 * first-category fallback only for a product that genuinely has no primary.
 */
export function resolvePrimaryCategoryId(product: ProductDetails, categoryIds: string[]): string {
  const fromPrimaryCategory = product.primaryCategory?.id;
  if (fromPrimaryCategory) return fromPrimaryCategory;

  const flagged = product.categories?.find((c) => c.isPrimary)?.categoryId;
  if (flagged) return flagged;

  return categoryIds[0] ?? '';
}

/** Every category id on the product, junk filtered out. */
export function resolveCategoryIds(product: ProductDetails): string[] {
  return (product.categories ?? []).map((c) => c.categoryId).filter(Boolean);
}

/** The ids behind `suggestedSideItems`, which the picker drives off. */
export function resolveSideItemIds(product: ProductDetails): string[] {
  if (!Array.isArray(product.suggestedSideItems)) return [];
  return product.suggestedSideItems.map((item) => item.id).filter(Boolean);
}

/**
 * Form defaults for a bundle. Deliberately carries no category / variation / ingredient
 * fields: `MenuBundleDto` returns none of them, so there is nothing to seed and
 * `editMenuBundleSchema` declares none. A bundle's categories are preserved server-side
 * (backend #192) precisely because the client never sends them.
 *
 * The two shapes are NOT interchangeable — an item is validated by `editProductSchema`
 * (which requires at least one category) and a bundle by `editMenuBundleSchema` (no category
 * field, requires a menuDefinition) — so the caller picks the one matching its resolver
 * rather than passing a selector flag through one function.
 */
export function toBundleDefaults(product: ProductDetails) {
  return {
    id: product.id,
    name: product.name || '',
    description: product.description || '',
    basePrice: product.basePrice || 0,
    isActive: product.isActive ?? true,
    isAvailable: product.isAvailable ?? true,
    isSpecial: product.isSpecial ?? false,
    type: 'menu' as const,
    content: flattenContent(product.content, product.name || ''),
    preparationTimeMinutes: product.preparationTimeMinutes || 0,
    displayOrder: product.displayOrder || 0,
    // Required by editMenuBundleSchema, so it has to be a form VALUE or validation fails and
    // handleSubmit never fires. The schedule/sections UI drives its own state (it is not a
    // registered field), which the hook mirrors back in with setValue — same arrangement the
    // modal used. The submitted definition is read from that state, not from here.
    menuDefinition: toMenuDefinitionState(product),
    // Seeded for the same reason as an item's (see `toItemDefaults`), and load-bearing beyond the
    // uncontrolled→controlled flip: the bundle PUT assigns this column unconditionally, so a default
    // that failed to echo the stored mask would clear the restriction on the next save.
    availableOrderTypes: product.availableOrderTypes ?? null,
    // Load-bearing for exactly the reason the mask above is: the bundle PUT will assign this
    // column unconditionally (backend #478), so a default that failed to echo the stored labels
    // would clear them on the next save of anything else. MC FOOD's 45 bundles are labelled;
    // an admin renaming one must not silently strip its allergens.
    allergens: product.allergens ?? [],
  };
}

/** Form defaults for a plain item. */
export function toItemDefaults(product: ProductDetails) {
  const categoryIds = resolveCategoryIds(product);

  return {
    name: product.name || '',
    description: product.description || '',
    basePrice: product.basePrice || 0,
    isActive: product.isActive ?? true,
    isAvailable: product.isAvailable ?? true,
    isSpecial: product.isSpecial ?? false,
    // Echoed for the same reason as the order-type mask below: the PUT assigns the column
    // unconditionally, so a default that dropped the stored flag would clear it on the next save.
    hideBaseProduct: product.hideBaseProduct ?? false,
    // Echoed for exactly the same reason as the flag above (frontend #631): the PUT assigns the
    // column unconditionally, so a default that dropped the stored flag would put an option-only
    // item back on the guest menu on the next unrelated save.
    isComponent: product.isComponent ?? false,
    type: product.type || 'mainItem',
    kitchenType: product.kitchenType || 'None',
    allergens: Array.isArray(product.allergens) ? product.allergens : [],
    categoryIds,
    primaryCategoryId: resolvePrimaryCategoryId(product, categoryIds),
    variations: product.variations || [],
    content: flattenContent(product.content, product.name || ''),
    preparationTimeMinutes: product.preparationTimeMinutes || 0,
    displayOrder: product.displayOrder || 0,
    suggestedSideItemIds: resolveSideItemIds(product),
    // `?? null` and not `|| null`: 0 is not a valid mask, but the distinction still matters —
    // `undefined` on a fetched product must seed the same "inherit" state as an explicit null,
    // and an uncontrolled→controlled flip in the editor would otherwise reset the radio.
    availableOrderTypes: product.availableOrderTypes ?? null,
    // Sauce group rules (plan D9). Echoed for the same reason as the mask above — the PUT assigns
    // all three columns unconditionally, so a default that dropped the stored rule would erase it
    // on the next unrelated save. `?? 0` and `?? null` because 0 is meaningful on all three:
    // "require none", "allow none", "none free".
    sauceMin: product.sauceMin ?? 0,
    sauceMax: product.sauceMax ?? null,
    sauceIncludedFree: product.sauceIncludedFree ?? 0,
  };
}

/** A bundle's schedule/sections state, which lives outside the form (it is not a field). */
export function toMenuDefinitionState(product: ProductDetails): MenuDefinition {
  const definition = product.menuDefinition;
  if (!definition) return EMPTY_MENU_DEFINITION;

  return {
    ...EMPTY_MENU_DEFINITION,
    ...definition,
    id: definition.id || '',
    sections: definition.sections || [],
  };
}
