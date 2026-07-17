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

/** `{ en: { name, description } }` → the flat rows `useFieldArray` renders. */
export function flattenContent(content: ProductDetails['content']): ContentEntry[] {
  if (!content) return [];
  return Object.entries(content as Record<string, { name?: string; description?: string }>).map(([language, data]) => ({
    language,
    name: data?.name ?? '',
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
    content: flattenContent(product.content),
    preparationTimeMinutes: product.preparationTimeMinutes || 0,
    displayOrder: product.displayOrder || 0,
    // Required by editMenuBundleSchema, so it has to be a form VALUE or validation fails and
    // handleSubmit never fires. The schedule/sections UI drives its own state (it is not a
    // registered field), which the hook mirrors back in with setValue — same arrangement the
    // modal used. The submitted definition is read from that state, not from here.
    menuDefinition: toMenuDefinitionState(product),
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
    type: product.type || 'mainItem',
    kitchenType: product.kitchenType || 'None',
    allergens: Array.isArray(product.allergens) ? product.allergens : [],
    categoryIds,
    primaryCategoryId: resolvePrimaryCategoryId(product, categoryIds),
    variations: product.variations || [],
    content: flattenContent(product.content),
    preparationTimeMinutes: product.preparationTimeMinutes || 0,
    displayOrder: product.displayOrder || 0,
    suggestedSideItemIds: resolveSideItemIds(product),
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
