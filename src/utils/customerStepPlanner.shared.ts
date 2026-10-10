import type { CustomerStepDescriptor, CustomerStepManifest } from '@/types/menu';
import { isBundleComponentStep, isProductCustomerStep } from '@/types/menu';
import type { CustomizationStep } from './customizationSteps';
import {
  customerStepRefKey,
  findCustomerStepCompletionTarget,
  groupCustomerStepScreens,
  makeCustomerStepManifest,
} from './customerStepManifest';

export const STEP_TITLES = {
  ProductVariation: 'select_variation',
  ProductIngredient: 'customize_ingredients',
  ProductCustomizationGroup: 'customize_ingredients',
  ProductSauce: 'sauces',
  ProductSuggestedSide: 'step_sides_accompaniments',
  BundleComponentVariation: 'select_variation',
  BundleComponentIngredient: 'customize_ingredients',
  BundleComponentCustomizationGroup: 'customize_ingredients',
  BundleComponentSauce: 'sauces',
  BundleComponentSide: 'step_sides_accompaniments',
} as const;

export interface PlanResult {
  steps: CustomizationStep[];
  valid: boolean;
  issues: string[];
}

export type CustomerScreen = ReturnType<typeof groupCustomerStepScreens>[number];
export type DynamicCustomerScreen = { screen: CustomerScreen; step: CustomizationStep };

export function completeManifest(
  manifest: CustomerStepManifest,
  defaults: readonly CustomerStepDescriptor[],
): { steps: CustomerStepDescriptor[]; issues: string[] } {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const step of manifest.steps) {
    if (hasMissingStableReference(step)) issues.push('missing-stable-target');
    const key = customerStepRefKey(step);
    if (seen.has(key)) issues.push('duplicate-target');
    seen.add(key);
    if (!Number.isInteger(step.presentationOrder) || step.presentationOrder < 0) issues.push('invalid-order');
  }
  const steps = manifest.steps.map((step) => ({ ...step }));
  const defaultScreens = groupCustomerStepScreens(makeCustomerStepManifest(manifest.revision, [...defaults]));
  let nextOrder = Math.max(-1, ...steps.map((step) => step.presentationOrder)) + 1;
  for (const screen of defaultScreens) {
    const missing = screen.refs.filter((step) => !seen.has(customerStepRefKey(step)));
    if (!missing.length) continue;
    missing.forEach((step) => seen.add(customerStepRefKey(step)));
    const existing = groupCustomerStepScreens(makeCustomerStepManifest(manifest.revision, steps));
    const target = findCustomerStepCompletionTarget(screen, existing);
    const order = target?.presentationOrder ?? nextOrder++;
    const role = target?.compositionRole;
    const label = target?.presentationLabel;
    steps.push(
      ...missing.map((step) => ({
        ...step,
        ...(role ? { compositionRole: role } : {}),
        ...(label ? { presentationLabel: label } : {}),
        presentationOrder: order,
      })),
    );
  }
  return { steps, issues };
}

function hasMissingStableReference(step: CustomerStepDescriptor): boolean {
  if (step.kind === 'BundleSection') return !step.targetId;
  if (isBundleComponentStep(step)) return !step.sectionId || !step.sectionItemId || !step.productId || !step.scopeId;
  return isProductCustomerStep(step) && !step.targetId;
}

export function addReview(steps: CustomizationStep[], owner: 'item' | 'menu'): CustomizationStep[] {
  if (steps.length <= 1) return steps;
  return [
    ...steps,
    {
      id: `${owner}-review`,
      kind: 'review',
      titleKey: owner === 'item' ? 'step_review_item' : 'step_review_menu',
      singleChoice: false,
      isRequired: false,
    },
  ];
}
