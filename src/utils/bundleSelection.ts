import type { MenuSection, MenuSectionItem, SelectedMenuOption } from '@/types/menu';
import { buildBaseIngredientSelection } from './ingredientSelection';

/**
 * Pure section-selection rules for the bundle body of the customization sheet (menu-bundles
 * redesign #175, slice 6). Extracted from `MenuCustomizationModal`'s inline state handling so the
 * radio/checkbox semantics, the `maxSelection` cap and the required-group gating are unit-testable
 * and shared. No React, no i18n — callers format the errors.
 */

/** Identifies one option inside the bundle — the drill-in disclosure key. */
export const bundleOptionKey = (sectionId: string, itemId: string) => `${sectionId}::${itemId}`;

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
  const option: SelectedMenuOption = { sectionId, itemId: item.productId, quantity: 1 };
  if (!item.detailedIngredients?.length) return option;

  const base = buildBaseIngredientSelection(item.detailedIngredients);
  return {
    ...option,
    selectedIngredients: base.selectedIngredients,
    ingredientQuantities: base.ingredientQuantities,
  };
}

/** The sections' `isDefault` items, capped at each section's `maxSelection`. */
export function buildDefaultBundleSelection(sections: readonly MenuSection[]): SelectedMenuOption[] {
  return sections.flatMap((section) =>
    section.items
      .filter((item) => item.isDefault)
      .slice(0, section.maxSelection)
      .map((item) => buildBundleOption(section.id, item)),
  );
}

export function findBundleOption(
  selectedOptions: readonly SelectedMenuOption[],
  sectionId: string,
  itemId: string,
): SelectedMenuOption | undefined {
  return selectedOptions.find((option) => option.sectionId === sectionId && option.itemId === itemId);
}

/**
 * How many options a section has picked. Counts *options*, not their quantities, to match the
 * server: `BasketItemFactory.BuildMenuItemAsync` gates `MinSelection`/`MaxSelection` on
 * `sectionSelections.Count`. (Every option is quantity 1 today — nothing in the sheet sets a
 * per-option quantity — so the two only diverge if that ever changes, and then the server's rule is
 * the one that decides whether the add is a 400.)
 */
export function countSectionSelections(selectedOptions: readonly SelectedMenuOption[], sectionId: string): number {
  return selectedOptions.filter((option) => option.sectionId === sectionId).length;
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
): SelectedMenuOption[] {
  const item = section.items.find((candidate) => candidate.productId === itemId);
  if (!item) return [...selectedOptions];

  const isSelected = Boolean(findBundleOption(selectedOptions, section.id, itemId));

  if (section.maxSelection === 1) {
    if (isSelected) return [...selectedOptions];
    return [
      ...selectedOptions.filter((option) => option.sectionId !== section.id),
      buildBundleOption(section.id, item),
    ];
  }

  if (isSelected) {
    return selectedOptions.filter((option) => !(option.sectionId === section.id && option.itemId === itemId));
  }

  if (countSectionSelections(selectedOptions, section.id) >= section.maxSelection) {
    return [...selectedOptions];
  }

  return [...selectedOptions, buildBundleOption(section.id, item)];
}

/** Merge a patch (drill-in ingredients / instructions) into one already-selected option. */
export function updateBundleOption(
  selectedOptions: readonly SelectedMenuOption[],
  sectionId: string,
  itemId: string,
  patch: Partial<SelectedMenuOption>,
): SelectedMenuOption[] {
  return selectedOptions.map((option) =>
    option.sectionId === sectionId && option.itemId === itemId ? { ...option, ...patch } : option,
  );
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
): BundleSelectionError[] {
  return sections
    .filter(
      (section) => section.isRequired && countSectionSelections(selectedOptions, section.id) < section.minSelection,
    )
    .map((section) => ({ sectionId: section.id, minSelection: section.minSelection }));
}
