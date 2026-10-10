import type { CustomerStepManifest, MenuSection, MenuSectionItem, SelectedMenuOption } from '@/types/menu';
import { buildBaseIngredientSelection } from './ingredientSelection';
import { isFixedPlatSection } from './fixedPlatSection';
import {
  activeCustomizationGroups,
  defaultCustomizationSelections,
  ingredientIdsForSelections,
} from './explicitCustomization';
import { resolveBundleRowSelection } from './bundleOptionResolution';

/**
 * Pure section-selection rules for the bundle body of the customization sheet (menu-bundles
 * redesign #175, slice 6). Extracted from `MenuCustomizationModal`'s inline state handling so the
 * radio/checkbox semantics, the `maxSelection` cap and the required-group gating are unit-testable
 * and shared. No React, no i18n — callers format the errors.
 */

/** Identifies one option inside the bundle — the drill-in disclosure key. */
export const bundleOptionKey = (
  sectionId: string,
  itemId: string,
  productVariationId?: string | null,
  menuSectionItemId?: string,
) => {
  const itemKey = menuSectionItemId ? `row:${menuSectionItemId}` : itemId;
  return `${sectionId}::${itemKey}::${productVariationId ?? 'base'}`;
};

/** Variation identity is part of an option identity; an omitted id means the product's base row. */
function matchesVariation(actual: string | null | undefined, expected: string | null | undefined): boolean {
  return (actual ?? null) === (expected ?? null);
}

/**
 * One chosen option, seeded with the base-recipe ingredient selection so the line starts at the
 * advertised price (the single default rule — see `buildBaseIngredientSelection`).
 *
 * The selection is only attached when the payload actually carries the child's ingredients, and the
 * reason is the *kitchen ticket*, not the price: `LineCustomizationBuilder.BuildIngredientQuantitiesJson`
 * only backfills quantities when `selectedIngredients != null`, so an explicit `[]` would zero every
 * optional and print "NO <everything>", while omitting the field writes no ingredient lines at all.
 *
 * Price safety here rests on `MenuBundleMapper` always projecting the child's active
 * `DetailedIngredients` into both the list and detail payloads: an empty projection therefore means
 * the child has no active ingredients, so the server's delta is 0 and matches ours. Note the server
 * treats a missing selection *identically* to an empty one for pricing
 * (`BasketPricingService.CalculateIngredientCustomizationPrice` builds an empty `HashSet` from
 * null) — this guard buys no price protection, and none is needed.
 */
export function buildBundleOption(sectionId: string, item: MenuSectionItem): SelectedMenuOption {
  const initialComponentVariation =
    !item.productVariationId && item.hideBaseProduct
      ? item.variations?.find((variation) => variation.isActive)
      : undefined;
  const option: SelectedMenuOption = {
    sectionId,
    itemId: item.productId,
    menuSectionItemId: item.id,
    quantity: 1,
    ...(item.productVariationId !== undefined ? { productVariationId: item.productVariationId } : {}),
    ...(item.productVariationPriceModifier !== undefined && item.productVariationPriceModifier !== null
      ? { productVariationPriceModifier: item.productVariationPriceModifier }
      : {}),
    ...(initialComponentVariation
      ? {
          componentProductVariationId: initialComponentVariation.id,
          componentProductVariationPriceModifier: initialComponentVariation.priceModifier,
        }
      : {}),
    ...(item.suggestedSideItems?.some((side) => side.isRequired)
      ? {
          selectedSideItems: item.suggestedSideItems
            .filter((side) => side.isRequired && side.availability?.canOrder !== false)
            .map((side) => ({
              id: side.sideItemProductId,
              suggestedSideItemId: side.id,
              quantity: 1,
            })),
        }
      : {}),
  };
  const groups = activeCustomizationGroups(item);
  if (groups.length > 0) {
    const customizationSelections = defaultCustomizationSelections(item);
    const selectedIngredients = ingredientIdsForSelections(groups, customizationSelections);
    return {
      ...option,
      customizationSelections,
      selectedIngredients,
      ingredientQuantities: Object.fromEntries(selectedIngredients.map((id) => [id, 1])),
    };
  }
  if (!item.detailedIngredients?.length) return option;

  const base = buildBaseIngredientSelection(item.detailedIngredients);
  return {
    ...option,
    selectedIngredients: base.selectedIngredients,
    ingredientQuantities: base.ingredientQuantities,
  };
}

/**
 * The sections' default items, capped at each section's `maxSelection`; the guest helper omits
 * server-blocked choices.
 *
 * A Kebab d'Ilhan fixed `Plat` is the one explicit exception: it has exactly one legal choice, so
 * the sheet selects that child even before the tenant-data write marks it default. The selected child
 * is still present in `selectedMenuOptions`; P3 removes only the redundant picker, never the payload.
 */
function buildDefaults(
  sections: readonly MenuSection[],
  omitUnavailable: boolean,
  manifest?: CustomerStepManifest | null,
): SelectedMenuOption[] {
  const selected: SelectedMenuOption[] = [];
  for (const section of sections) {
    const descriptor = manifest?.steps.find((step) => step.kind === 'BundleSection' && step.targetId === section.id);
    if (
      descriptor?.kind === 'BundleSection' &&
      descriptor.parentComponentId &&
      !selected.some((option) => option.menuSectionItemId === descriptor.parentComponentId)
    )
      continue;
    const items = isFixedPlatSection(section)
      ? section.items.slice(0, 1)
      : section.items.filter((item) => item.isDefault);
    selected.push(
      ...items
        .filter((item) => !omitUnavailable || item.availability?.canOrder !== false)
        .slice(0, section.maxSelection)
        .map((item) => buildBundleOption(section.id, item)),
    );
  }
  return selected;
}

/** Defaults for staff and previews, which retain their existing selection behavior. */
export function buildDefaultBundleSelection(sections: readonly MenuSection[]): SelectedMenuOption[] {
  return buildDefaults(sections, false);
}

/** Guest defaults omit server-blocked choices so required-section validation can block an invalid add. */
export function buildGuestDefaultBundleSelection(
  sections: readonly MenuSection[],
  manifest?: CustomerStepManifest | null,
): SelectedMenuOption[] {
  return buildDefaults(sections, true, manifest);
}

export function findBundleOption(
  selectedOptions: readonly SelectedMenuOption[],
  sectionId: string,
  itemId: string,
  productVariationId?: string | null,
  menuSectionItemId?: string,
): SelectedMenuOption | undefined {
  if (menuSectionItemId) {
    const exact = selectedOptions.find(
      (option) =>
        option.sectionId === sectionId && option.itemId === itemId && option.menuSectionItemId === menuSectionItemId,
    );
    if (exact) return exact;
    const legacyMatches = selectedOptions.filter(
      (option) =>
        option.sectionId === sectionId &&
        option.itemId === itemId &&
        !option.menuSectionItemId &&
        matchesVariation(option.productVariationId, productVariationId),
    );
    return legacyMatches.length === 1 ? legacyMatches[0] : undefined;
  }
  return selectedOptions.find(
    (option) =>
      option.sectionId === sectionId &&
      option.itemId === itemId &&
      (menuSectionItemId
        ? option.menuSectionItemId === menuSectionItemId
        : matchesVariation(option.productVariationId, productVariationId)),
  );
}

/** Count portions in repeatable sections, distinct choices elsewhere. */
export function countSectionSelections(
  selectedOptions: readonly SelectedMenuOption[],
  sectionId: string,
  allowRepeatedItems = false,
): number {
  const sectionOptions = selectedOptions.filter((option) => option.sectionId === sectionId);
  return allowRepeatedItems
    ? sectionOptions.reduce((total, option) => total + option.quantity, 0)
    : sectionOptions.length;
}

/**
 * Toggle an option within its section. `maxSelection === 1` is a radio group (the pick replaces the
 * section's selection); otherwise it is a checkbox group capped at `maxSelection` — a toggle past
 * the cap is ignored rather than silently evicting an earlier pick.
 *
 * Re-picking an already-selected option is a no-op, so an option's drill-in customization survives
 * a stray click (the modal this replaces rebuilt the option, discarding it).
 */
export function toggleBundleOption(
  section: MenuSection,
  selectedOptions: readonly SelectedMenuOption[],
  itemId: string,
  productVariationId?: string | null,
  menuSectionItemId?: string,
): SelectedMenuOption[] {
  const item = section.items.find((candidate) =>
    menuSectionItemId
      ? candidate.id === menuSectionItemId && candidate.productId === itemId
      : candidate.productId === itemId && matchesVariation(candidate.productVariationId, productVariationId),
  );
  if (!item) return [...selectedOptions];

  const rowSelection = resolveBundleRowSelection(section, selectedOptions, item);
  if (rowSelection.recoverableIndex !== undefined) {
    return selectedOptions.map((option, index) =>
      index === rowSelection.recoverableIndex ? { ...option, menuSectionItemId: item.id } : option,
    );
  }
  if (rowSelection.unresolvedCount > 0) return [...selectedOptions];

  const selectedOption =
    rowSelection.selectedIndex === undefined ? undefined : selectedOptions[rowSelection.selectedIndex];
  const isSelected = Boolean(selectedOption);

  if (section.maxSelection === 1) {
    if (isSelected) return [...selectedOptions];
    return [
      ...selectedOptions.filter((option) => option.sectionId !== section.id),
      buildBundleOption(section.id, item),
    ];
  }

  if (isSelected) {
    return selectedOptions.filter((option) => option !== selectedOption);
  }

  if (countSectionSelections(selectedOptions, section.id, section.allowRepeatedItems) >= section.maxSelection) {
    return [...selectedOptions];
  }

  return [...selectedOptions, buildBundleOption(section.id, item)];
}

/**
 * Merge a patch into one selected option. Quantities are per-ID deltas (zero means removed),
 * merged into the latest state so several changes in one event cannot undo earlier changes.
 */
export function updateBundleOption(
  selectedOptions: readonly SelectedMenuOption[],
  sectionId: string,
  itemId: string,
  patch: Partial<SelectedMenuOption>,
  productVariationId?: string | null,
  menuSectionItemId?: string,
): SelectedMenuOption[] {
  const legacyMatches = menuSectionItemId
    ? selectedOptions.filter(
        (option) =>
          option.sectionId === sectionId &&
          option.itemId === itemId &&
          !option.menuSectionItemId &&
          matchesVariation(option.productVariationId, productVariationId),
      )
    : [];
  const legacyTarget = legacyMatches.length === 1 ? legacyMatches[0] : undefined;
  return selectedOptions.map((option) => {
    const exactTarget = Boolean(
      menuSectionItemId &&
      option.sectionId === sectionId &&
      option.itemId === itemId &&
      option.menuSectionItemId === menuSectionItemId,
    );
    if (menuSectionItemId) {
      if (!exactTarget && option !== legacyTarget) return option;
    } else if (
      option.sectionId !== sectionId ||
      option.itemId !== itemId ||
      !matchesVariation(option.productVariationId, productVariationId)
    )
      return option;
    const updated = { ...option, ...patch };
    if (patch.ingredientQuantities) {
      updated.ingredientQuantities = { ...option.ingredientQuantities, ...patch.ingredientQuantities };
    }
    return updated;
  });
}

/** Remove child-section selections when the explicitly-owned parent component is deselected. */
export function removeDependentBundleSelections(
  selectedOptions: readonly SelectedMenuOption[],
  manifest: CustomerStepManifest | null | undefined,
  removedComponentIds: readonly string[],
): SelectedMenuOption[] {
  if (!manifest || removedComponentIds.length === 0) return [...selectedOptions];
  const removed = new Set(removedComponentIds);
  const removedSections = new Set<string>();
  const pending = [...removedComponentIds];
  while (pending.length)
    collectOwnedSectionSelections(pending.shift()!, manifest, selectedOptions, removed, removedSections, pending);
  return selectedOptions.filter((option) => !removedSections.has(option.sectionId));
}

/** Toggle a component and discard selections from child sections owned by any removed component. */
export function toggleBundleOptionWithDependencies(
  section: MenuSection,
  selectedOptions: readonly SelectedMenuOption[],
  itemId: string,
  productVariationId: string | null | undefined,
  menuSectionItemId: string | undefined,
  manifest: CustomerStepManifest | null | undefined,
): SelectedMenuOption[] {
  const next = toggleBundleOption(section, selectedOptions, itemId, productVariationId, menuSectionItemId);
  const retained = new Set(next.map((option) => option.menuSectionItemId).filter((id): id is string => Boolean(id)));
  const removed = selectedOptions.flatMap((option) =>
    option.menuSectionItemId && !retained.has(option.menuSectionItemId) ? [option.menuSectionItemId] : [],
  );
  return removeDependentBundleSelections(next, manifest, removed);
}

function collectOwnedSectionSelections(
  componentId: string,
  manifest: CustomerStepManifest,
  selectedOptions: readonly SelectedMenuOption[],
  removedComponents: Set<string>,
  removedSections: Set<string>,
  pending: string[],
): void {
  for (const step of manifest.steps) {
    if (!isOwnedSection(step, componentId)) continue;
    removedSections.add(step.targetId);
    for (const option of selectedOptions) enqueueRemovedComponent(option, step.targetId, removedComponents, pending);
  }
}

function isOwnedSection(
  step: CustomerStepManifest['steps'][number],
  componentId: string,
): step is Extract<CustomerStepManifest['steps'][number], { kind: 'BundleSection' }> {
  return step.kind === 'BundleSection' && step.parentComponentId === componentId;
}

function enqueueRemovedComponent(
  option: SelectedMenuOption,
  sectionId: string,
  removedComponents: Set<string>,
  pending: string[],
): void {
  const childId = option.menuSectionItemId;
  if (option.sectionId !== sectionId || !childId || removedComponents.has(childId)) return;
  removedComponents.add(childId);
  pending.push(childId);
}

/** A required section that has not met its `minSelection`. */
export interface BundleSelectionError {
  sectionId: string;
  minSelection: number;
}

/** Required-group gating: every `isRequired` section must reach its `minSelection`. */
export function findBundleSelectionErrors(
  sections: readonly MenuSection[],
  selectedOptions: readonly SelectedMenuOption[],
  manifest?: CustomerStepManifest | null,
): BundleSelectionError[] {
  const visibleSections = sections.filter((section) => {
    const descriptor = manifest?.steps.find((step) => step.kind === 'BundleSection' && step.targetId === section.id);
    return (
      descriptor?.kind !== 'BundleSection' ||
      !descriptor.parentComponentId ||
      selectedOptions.some((option) => option.menuSectionItemId === descriptor.parentComponentId)
    );
  });
  return visibleSections
    .filter(
      (section) =>
        section.isRequired &&
        countSectionSelections(selectedOptions, section.id, section.allowRepeatedItems) < section.minSelection,
    )
    .map((section) => ({ sectionId: section.id, minSelection: section.minSelection }));
}
