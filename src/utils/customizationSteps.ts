import { groupSuggestedSideItems } from './suggestedSideItems';
import { isSauce, toSauceGroupRule } from './sauceGroup';
import { findBundleSelectionErrors } from './bundleSelection';
import { isBaseRowHidden } from './baseProductVisibility';
import type { DetailedProduct, MenuSection, SelectedMenuOption } from '@/types/menu';

/**
 * The step model behind the guided customization flow (MENU-CUSTOMIZATION-FLOW-PLAN §3.1).
 *
 * Pure and React-free so the ordering, the "is this item even worth a wizard" rule and the gates
 * are unit-testable without rendering a sheet.
 *
 * **Steps are DERIVED, never authored.** The one decision that makes this redesign help rather than
 * tax every order is that an item with a single decision gets no stepper at all — see
 * `buildProductSteps`.
 */

export type StepKind = 'variations' | 'ingredients' | 'sauces' | 'sides' | 'drinks' | 'section' | 'review';

export interface CustomizationStep {
  /** Stable within one sheet — used as the animation key and the progress-segment key. */
  id: string;
  kind: StepKind;
  /** i18n key for the step's title. Absent when the title is tenant-authored (`title`). */
  titleKey?: string;
  /** Already-localized tenant text (a bundle section's name), preferred over `titleKey`. */
  title?: string;
  /** Picking an option answers the whole step, so the flow may advance on its own. */
  singleChoice: boolean;
  /** The guest cannot leave the step until it is satisfied (`stepBlocker` says whether it is). */
  isRequired: boolean;
  /** The bundle section this step renders. `section` steps only. */
  section?: MenuSection;
}

/** Everything the gates read. Supplied by whichever sheet controller owns the state. */
export interface StepGateState {
  selectedVariationId: string | null;
  selectedIngredients: readonly string[];
  selectedOptions?: readonly SelectedMenuOption[];
}

const REVIEW_STEP: CustomizationStep = {
  id: 'review',
  kind: 'review',
  titleKey: 'step_review',
  singleChoice: false,
  isRequired: false,
};

const DRINKS_STEP: CustomizationStep = {
  id: 'drinks',
  kind: 'drinks',
  titleKey: 'step_drinks',
  singleChoice: false,
  isRequired: false,
};

/**
 * Whether the product should be offered the always-available drinks step (plan §3.4).
 *
 * Two refusals, both deliberate: a drink does not upsell itself, and a product whose admin already
 * curated a beverages side group has said what it wants offered — that curation wins.
 */
export function offersGenericDrinks(product: Pick<DetailedProduct, 'type' | 'suggestedSideItems'>): boolean {
  if (product.type === 'beverage') return false;
  return !groupSuggestedSideItems(product.suggestedSideItems ?? []).some((group) => group.id === 'beverages');
}

/**
 * The product body's steps, in flow order.
 *
 * `withDrinks` is the CALLER's answer, not this function's: whether any drink is actually on offer
 * depends on a fetch, and a step that renders an empty list is worse than no step. Even then it is
 * only ADDED to a flow that is already guided — see the guard below.
 */
export function buildProductSteps(product: DetailedProduct, withDrinks = false): CustomizationStep[] {
  const steps: CustomizationStep[] = [];
  const ingredients = product.detailedIngredients ?? [];

  if ((product.variations ?? []).some((variation) => variation.isActive)) {
    steps.push({
      id: 'variations',
      kind: 'variations',
      titleKey: 'select_variation',
      singleChoice: true,
      isRequired: isBaseRowHidden(product.hideBaseProduct, product.variations),
    });
  }

  if (ingredients.some((ingredient) => ingredient.isActive && !isSauce(ingredient))) {
    steps.push({
      id: 'ingredients',
      kind: 'ingredients',
      titleKey: 'customize_ingredients',
      singleChoice: false,
      isRequired: false,
    });
  }

  if (ingredients.some((ingredient) => ingredient.isActive && isSauce(ingredient))) {
    const rule = toSauceGroupRule(product);
    steps.push({
      id: 'sauces',
      kind: 'sauces',
      titleKey: 'sauces',
      singleChoice: rule.max === 1,
      isRequired: rule.min > 0,
    });
  }

  // ONE step over every partition, not one per partition. A dish with drinks, desserts and
  // accompaniments would otherwise reach seven steps on its own — and "too complicated" is the
  // complaint this redesign answers, so a flow that is merely differently long fixes nothing. The
  // three are the same KIND of decision; they stay separately headed inside the step.
  if (groupSuggestedSideItems(product.suggestedSideItems ?? []).length > 0) {
    steps.push({
      id: 'sides',
      kind: 'sides',
      titleKey: 'step_sides',
      singleChoice: false,
      isRequired: false,
    });
  }

  // The upsell may EXTEND a guided flow; it may never create one. Otherwise every one-decision dish
  // in the catalogue — which is most of them — grows a progress bar, a Continue and a review for a
  // question the guest did not come to answer, and §2's whole "a simple item stays simple" rule
  // holds for nothing but beverages.
  if (withDrinks && steps.length >= 2) steps.push(DRINKS_STEP);

  return withReview(steps);
}

/**
 * The bundle body's steps — one per menu section.
 *
 * **No drinks step, deliberately.** A combo's composition is the tenant's own design and usually
 * already includes a drink; a second "add a drink" on top of "And a drink" is the annoying kind of
 * upsell. There is also no way to detect it — `MenuSectionItem` carries no `ProductType` — so
 * offering one would be a guess, and the wrong guess is the common case.
 */
export function buildBundleSteps(sections: readonly MenuSection[]): CustomizationStep[] {
  const steps: CustomizationStep[] = sections.map((section) => ({
    id: `section:${section.id}`,
    kind: 'section' as const,
    title: section.name,
    singleChoice: section.maxSelection === 1,
    // Exactly what `findBundleSelectionErrors` gates on, and deliberately not the wider
    // "required OR has a minimum": a step marked required that the gate never blocks would show a
    // `*` the Continue button does not enforce, which is a promise the UI cannot keep.
    isRequired: section.isRequired,
    section,
  }));

  return withReview(steps);
}

/**
 * A review step earns its place only once there is something to have missed. One content step
 * cannot be skipped by accident, so appending a summary of it would be pure ceremony — and it is
 * what keeps a two-tap item a two-tap item.
 */
function withReview(contentSteps: CustomizationStep[]): CustomizationStep[] {
  return contentSteps.length > 1 ? [...contentSteps, REVIEW_STEP] : contentSteps;
}

/** Why a required step is not yet satisfied, or `null` when the guest may move on. */
export type StepBlocker = 'variation' | 'sauces' | 'section';

/**
 * The gate. Reads the same rules the ADD button already enforces — `isBaseRowHidden` for the base
 * row, the sauce group's own minimum, `findBundleSelectionErrors` for a section — so a step can
 * never let through a selection the footer would then refuse.
 */
export function stepBlocker(
  step: CustomizationStep,
  state: StepGateState,
  sauceMin = 0,
  sauceIds: readonly string[] = [],
): StepBlocker | null {
  if (!step.isRequired) return null;

  if (step.kind === 'variations') {
    // A BACKSTOP, not a gate the guest can reach today: `buildInitialSheetState` seeds the first
    // active variation, and `isBaseRowHidden` degrades to false when there is none — so a required
    // variations step opens already answered. Kept because the two rules that make that true live
    // in other files and either could change; stated here so nobody hunts for the UI that fires it.
    return state.selectedVariationId === null ? 'variation' : null;
  }

  if (step.kind === 'sauces') {
    const chosen = sauceIds.filter((id) => state.selectedIngredients.includes(id)).length;
    return chosen < sauceMin ? 'sauces' : null;
  }

  if (step.kind === 'section' && step.section) {
    const errors = findBundleSelectionErrors([step.section], state.selectedOptions ?? []);
    return errors.length > 0 ? 'section' : null;
  }

  return null;
}
