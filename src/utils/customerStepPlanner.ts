import type { CustomerStepManifest, DetailedProduct, MenuSection, MenuSectionItem } from '@/types/menu';
import { customizationGroupSatisfied } from './explicitCustomization';
import { isSauce, toSauceGroupRule } from './sauceGroup';
import type { CustomizationStep, StepGateState } from './customizationSteps';
import { defaultBundleCustomerStepManifest, defaultProductCustomerStepManifest } from './customerStepManifest';
import { inspectProductManifest } from './customerStepPlanner.product';
import { inspectBundleManifest } from './customerStepPlanner.bundle';

export { buildCustomerProductSteps } from './customerStepPlanner.product';
export { buildMixedBundleSteps } from './customerStepPlanner.bundle';

export function inspectCustomerStepManifest(
  isBundle: boolean,
  product: DetailedProduct,
  sections: readonly MenuSection[],
  manifest: CustomerStepManifest | null | undefined,
): string[] {
  if (!manifest || manifest.steps.length === 0) return [];
  return isBundle ? inspectBundleManifest(sections, manifest) : inspectProductManifest(product, manifest);
}

export function effectiveCustomerStepManifest(
  isBundle: boolean,
  product: DetailedProduct,
  sections: readonly MenuSection[],
  manifest: CustomerStepManifest | null | undefined,
): CustomerStepManifest {
  if (manifest?.steps.length) return manifest;
  return isBundle
    ? defaultBundleCustomerStepManifest(sections, manifest?.revision ?? 0)
    : defaultProductCustomerStepManifest(product, manifest?.revision ?? 0);
}

export function stepBlockerForState(
  step: CustomizationStep,
  state: StepGateState,
  product?: DetailedProduct | MenuSectionItem | null,
): string | null {
  if (step.kind === 'group') {
    const groups = step.groups ?? (step.group ? [step.group] : []);
    return groups.every((group) => customizationGroupSatisfied(group, state.customizationSelections ?? []))
      ? null
      : 'group';
  }
  const carrier = step.component ?? product;
  if (step.kind === 'sauces' && carrier) {
    const rule = toSauceGroupRule(carrier);
    const ids =
      step.ingredientIds ??
      (carrier.detailedIngredients ?? [])
        .filter((ingredient) => ingredient.isActive && isSauce(ingredient))
        .map((row) => row.id);
    const selected = ids.filter((id) => state.selectedIngredients.includes(id)).length;
    return selected < rule.min ? 'sauces' : null;
  }
  return null;
}
