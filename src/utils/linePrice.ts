/**
 * Single source of truth for customer-facing line pricing — a faithful port of the backend
 * `BasketPricingService.CalculateIngredientCustomizationPrice` + the `BasketItemFactory` line/bundle
 * roll-up (menu-bundles redesign #175, slice 6). Replaces the three divergent FE price calculators
 * (`CustomizationModal.totalPrice`, `PriceCalculator`, `ProductCustomizationInBundle`), which drift
 * from the server's rules. Pure functions — no React, no I/O — so a unit test can pin them against
 * the backend semantics and the customization sheet (slice 6 PR2) can reuse them.
 *
 * The server is always authoritative on price (it recomputes on add-to-basket); this exists so the
 * live "Add • CHF X" the customer sees matches what the basket will charge.
 */

import { sauceWaiverAmount } from './sauceGroup';
import type { CustomizationGroupSelection, IngredientKind, ProductCustomizationGroup } from '@/types/menu';
import { selectionForGroup } from './explicitCustomization';

/** The minimal ingredient shape pricing needs — satisfied by both `ProductIngredient` (optional
 *  `isIncludedInBasePrice`/`maxQuantity`) and `DetailedIngredient` (required). */
export interface PriceableIngredient {
  id: string;
  price: number;
  isOptional: boolean;
  isActive: boolean;
  isIncludedInBasePrice?: boolean;
  maxQuantity?: number;
  /** Sauce rows are priced by the same per-row rule and THEN get the group allowance (S6). */
  kind?: IngredientKind;
  /** Only read to tie-break the free-sauce allowance deterministically (S6). */
  displayOrder?: number;
}

export interface PriceableVariation {
  id?: string;
  priceModifier: number;
}

export interface PriceableSide {
  id: string;
  suggestedSideItemId?: string;
  price: number;
  variations?: readonly PriceableVariation[];
}

export interface SelectedSide {
  id: string;
  suggestedSideItemId?: string;
  quantity: number;
  productVariationId?: string | null;
}

const toIdSet = (ids: Iterable<string>): Set<string> => (ids instanceof Set ? ids : new Set(ids));

/**
 * The customization delta for a set of optional ingredients — mirrors the backend
 * `BasketPricingService.CalculateIngredientCustomizationPrice` exactly:
 *  - only `isOptional && isActive` ingredients count;
 *  - included-in-base: deselected → −price; selected with qty>1 → +price·(qty−1); qty 1 → 0;
 *  - not-included: selected → +price·qty;
 *  - quantity is clamped to [0, maxQuantity] (a missing `maxQuantity` defaults to 1) — the lower
 *    bound guards against a tampered negative quantity reducing the price.
 *
 * Then, and only then, the product's free-sauce allowance is taken off (S6 / D10): the per-row rule
 * above runs UNCHANGED for sauce rows too, and `sauceWaiverAmount` removes the `sauceIncludedFree`
 * most expensive charges it produced. `sauceIncludedFree: 0` — every product until an admin sets
 * one — subtracts nothing, so this function's answer is byte-identical to what it was before S6.
 */
export function ingredientCustomizationPrice(
  ingredients: readonly PriceableIngredient[] | undefined,
  selectedIngredientIds: Iterable<string>,
  ingredientQuantities?: Record<string, number>,
  sauceIncludedFree = 0,
): number {
  if (!ingredients) return 0;

  const selected = toIdSet(selectedIngredientIds);
  let delta = 0;

  for (const ingredient of ingredients) {
    if (!ingredient.isOptional || !ingredient.isActive) continue;

    const isSelected = selected.has(ingredient.id);
    const maxQuantity = ingredient.maxQuantity ?? 1;
    const rawQuantity = ingredientQuantities?.[ingredient.id] ?? 1;
    const quantity = Math.max(0, Math.min(maxQuantity, rawQuantity));

    if (ingredient.isIncludedInBasePrice) {
      if (!isSelected) {
        delta -= ingredient.price; // deselected: refund the one included piece
      } else if (quantity > 1) {
        delta += ingredient.price * (quantity - 1); // extra pieces beyond the free one
      }
    } else if (isSelected) {
      delta += ingredient.price * quantity;
    }
  }

  return delta - sauceWaiverAmount(ingredients, selected, ingredientQuantities, sauceIncludedFree);
}

/** Unit price (before the line quantity multiplier) of a single product: base + additive variation
 *  modifier + ingredient customization delta + selected top-level side items. */
export function productLineUnitPrice(params: {
  basePrice: number;
  variations?: readonly PriceableVariation[];
  selectedVariationId?: string | null;
  ingredients?: readonly PriceableIngredient[];
  selectedIngredientIds: Iterable<string>;
  ingredientQuantities?: Record<string, number>;
  /** The product's free-sauce allowance (`ProductDto.sauceIncludedFree`); 0 = today's pricing. */
  sauceIncludedFree?: number;
  sides?: readonly PriceableSide[];
  selectedSides?: readonly SelectedSide[];
  customizationGroups?: readonly ProductCustomizationGroup[];
  customizationSelections?: readonly CustomizationGroupSelection[];
}): number {
  const variation =
    params.selectedVariationId && params.variations
      ? params.variations.find((v) => v.id === params.selectedVariationId)
      : undefined;
  const base = params.basePrice + (variation?.priceModifier ?? 0);

  let ingredientDelta = ingredientCustomizationPrice(
    params.ingredients,
    params.selectedIngredientIds,
    params.ingredientQuantities,
    params.customizationGroups?.some((group) => group.isActive) ? 0 : (params.sauceIncludedFree ?? 0),
  );

  const explicitDelta = explicitCustomizationPrice(
    params.customizationGroups,
    params.customizationSelections,
    params.ingredients,
    params.ingredientQuantities,
  );
  ingredientDelta -= explicitDelta.ingredientAllowance;

  const sidesCost = (params.selectedSides ?? []).reduce((sum, selected) => {
    const matches = (params.sides ?? []).filter((side) =>
      selected.suggestedSideItemId
        ? side.suggestedSideItemId === selected.suggestedSideItemId && side.id === selected.id
        : side.id === selected.id,
    );
    const side = matches.length === 1 ? matches[0] : undefined;
    const variation = side?.variations?.find((row) => row.id === selected.productVariationId);
    return sum + ((side?.price ?? 0) + (variation?.priceModifier ?? 0)) * selected.quantity;
  }, 0);

  return base + ingredientDelta + explicitDelta.productOptionsCost + sidesCost;
}

function explicitCustomizationPrice(
  groups: readonly ProductCustomizationGroup[] | undefined,
  selections: readonly CustomizationGroupSelection[] | undefined,
  ingredients: readonly PriceableIngredient[] | undefined,
  quantities: Record<string, number> | undefined,
): { ingredientAllowance: number; productOptionsCost: number } {
  if (!groups?.length || !selections) return { ingredientAllowance: 0, productOptionsCost: 0 };
  const ingredientById = new Map((ingredients ?? []).map((ingredient) => [ingredient.id, ingredient]));
  let ingredientAllowance = 0;
  let productOptionsCost = 0;

  for (const group of groups.filter((candidate) => candidate.isActive)) {
    const groupPrice = explicitGroupPrice(group, selectionForGroup(selections, group.id), ingredientById, quantities);
    ingredientAllowance += groupPrice.ingredientAllowance;
    productOptionsCost += groupPrice.productOptionsCost;
  }

  return { ingredientAllowance, productOptionsCost };
}

function explicitGroupPrice(
  group: ProductCustomizationGroup,
  selected: readonly CustomizationGroupSelection['options'][number][],
  ingredientById: ReadonlyMap<string, PriceableIngredient>,
  quantities: Record<string, number> | undefined,
): { ingredientAllowance: number; productOptionsCost: number } {
  const ingredientMemberships = new Map(group.ingredientOptions.map((option) => [option.id, option]));
  const productMemberships = new Map(group.productOptions.map((option) => [option.id, option]));
  const chargeable: Array<{ price: number; order: number; id: string }> = [];
  let productOptionsCost = 0;

  for (const choice of selected) {
    if (choice.kind === 1) {
      productOptionsCost += (productMemberships.get(choice.optionId)?.additionalPrice ?? 0) * choice.quantity;
      continue;
    }
    const membership = ingredientMemberships.get(choice.optionId);
    const ingredient = membership ? ingredientById.get(membership.productIngredientId) : undefined;
    if (!membership || !ingredient || ingredient.price <= 0) continue;
    const quantity = quantities?.[ingredient.id] ?? choice.quantity;
    const units = ingredient.isIncludedInBasePrice ? Math.max(0, quantity - 1) : quantity;
    for (let unit = 0; unit < units; unit += 1) {
      chargeable.push({ price: ingredient.price, order: membership.displayOrder, id: ingredient.id });
    }
  }

  chargeable.sort(
    (left, right) => right.price - left.price || left.order - right.order || left.id.localeCompare(right.id),
  );
  const ingredientAllowance = chargeable.slice(0, group.includedFreeUnits).reduce((sum, unit) => sum + unit.price, 0);
  return { ingredientAllowance, productOptionsCost };
}

/** One chosen option inside a bundle section, with its per-option ingredient customization. */
export interface SelectedBundleOption {
  sectionId: string;
  itemId: string;
  menuSectionItemId?: string;
  productVariationId?: string | null;
  /** Copied from the read-side menu-section row for preview pricing; never sent to the server. */
  productVariationPriceModifier?: number | null;
  componentProductVariationId?: string | null;
  componentProductVariationPriceModifier?: number | null;
  quantity: number;
  selectedIngredients?: string[];
  ingredientQuantities?: Record<string, number>;
  customizationSelections?: CustomizationGroupSelection[];
  selectedSideItems?: readonly SelectedSide[];
}

export interface PriceableBundleSectionItem {
  id?: string;
  productId: string;
  productVariationId?: string | null;
  productVariationPriceModifier?: number | null;
  hideBaseProduct?: boolean;
  variations?: readonly PriceableVariation[];
  additionalPrice: number;
  detailedIngredients?: readonly PriceableIngredient[];
  /**
   * The OPTION PRODUCT's own free-sauce allowance (S6 decision, mirrored by the server, which
   * prices a bundle child with `childProduct.SauceIncludedFree`): the option IS that product, and
   * the parent bundle owns no sauce rows for an allowance of its own to apply to.
   */
  sauceIncludedFree?: number;
  customizationGroups?: readonly ProductCustomizationGroup[];
  suggestedSideItems?: readonly {
    id: string;
    sideItemProductId: string;
    sideItemBasePrice: number;
    variations?: readonly PriceableVariation[];
  }[];
}

export interface PriceableBundleSection {
  id: string;
  items: readonly PriceableBundleSectionItem[];
}

/** Unit price (before the line quantity multiplier) of a bundle: base + each chosen option's
 *  section additional price + that option's child ingredient customization, each scaled by the
 *  option quantity. Mirrors `BasketItemFactory.BuildMenuItemAsync`'s parent-unit-price roll-up. */
export function bundleLineUnitPrice(params: {
  basePrice: number;
  sections: readonly PriceableBundleSection[];
  selectedOptions: readonly SelectedBundleOption[];
}): number {
  return (
    params.basePrice +
    params.selectedOptions.reduce((sum, option) => sum + selectedBundleOptionPrice(option, params.sections), 0)
  );
}

function selectedBundleOptionPrice(option: SelectedBundleOption, sections: readonly PriceableBundleSection[]): number {
  const item = resolveSelectedBundleItem(option, sections);
  if (!item) return 0;
  const rowPrice = (item.additionalPrice + selectedVariationModifier(item, option)) * option.quantity;
  const ingredientDelta = ingredientCustomizationPrice(
    item.detailedIngredients,
    option.selectedIngredients ?? [],
    option.ingredientQuantities,
    item.customizationGroups?.some((group) => group.isActive) ? 0 : (item.sauceIncludedFree ?? 0),
  );
  const explicitDelta = explicitCustomizationPrice(
    item.customizationGroups,
    option.customizationSelections,
    item.detailedIngredients,
    option.ingredientQuantities,
  );
  const customizationPrice =
    (ingredientDelta - explicitDelta.ingredientAllowance + explicitDelta.productOptionsCost) * option.quantity;
  return rowPrice + customizationPrice + selectedBundleSidePrice(item, option);
}

function resolveSelectedBundleItem(
  option: SelectedBundleOption,
  sections: readonly PriceableBundleSection[],
): PriceableBundleSectionItem | undefined {
  const section = sections.find((candidate) => candidate.id === option.sectionId);
  const matches =
    section?.items.filter((candidate) =>
      option.menuSectionItemId
        ? candidate.id === option.menuSectionItemId && candidate.productId === option.itemId
        : candidate.productId === option.itemId &&
          (candidate.productVariationId ?? null) === (option.productVariationId ?? null),
    ) ?? [];
  // Without stable row identity, only a unique product/variation pair may be priced.
  return matches.length === 1 ? matches[0] : undefined;
}

function selectedVariationModifier(item: PriceableBundleSectionItem, option: SelectedBundleOption): number {
  const fixedModifier = option.productVariationPriceModifier ?? item.productVariationPriceModifier ?? 0;
  const componentVariation = item.variations?.find((variation) => variation.id === option.componentProductVariationId);
  const dynamicModifier = option.componentProductVariationPriceModifier ?? componentVariation?.priceModifier ?? 0;
  return fixedModifier + dynamicModifier;
}

function selectedBundleSidePrice(item: PriceableBundleSectionItem, option: SelectedBundleOption): number {
  return (option.selectedSideItems ?? []).reduce((sum, selectedSide) => {
    const side = resolveBundleSide(item, selectedSide);
    if (!side) return sum;
    const variation = side.variations?.find((row) => row.id === selectedSide.productVariationId);
    return sum + (side.sideItemBasePrice + (variation?.priceModifier ?? 0)) * selectedSide.quantity * option.quantity;
  }, 0);
}

function resolveBundleSide(
  item: PriceableBundleSectionItem,
  selected: SelectedSide,
): NonNullable<PriceableBundleSectionItem['suggestedSideItems']>[number] | undefined {
  const sides = item.suggestedSideItems ?? [];
  const matches = sides.filter((candidate) =>
    selected.suggestedSideItemId
      ? candidate.id === selected.suggestedSideItemId && candidate.sideItemProductId === selected.id
      : candidate.sideItemProductId === selected.id,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/** Final line total = unit price × line quantity. */
export function lineTotal(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}
