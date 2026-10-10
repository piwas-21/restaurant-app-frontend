import type { CustomerStepManifest, DetailedProduct } from '@/types/menu';
import { isProductCustomerStep } from '@/types/menu';
import { activeCustomizationGroups } from './explicitCustomization';
import { isSauce } from './sauceGroup';
import { buildProductSteps, offersGenericDrinks, type CustomizationStep } from './customizationSteps';
import {
  defaultProductCustomerStepManifest,
  groupCustomerStepScreens,
  makeCustomerStepManifest,
} from './customerStepManifest';
import { isCustomerScreenOrderValid } from './customerStepDependencies';
import { addReview, completeManifest, STEP_TITLES, type PlanResult } from './customerStepPlanner.shared';
import type { SuggestedSideGroup } from './suggestedSideItems';

type ProductStepRequiredField = 'id' | 'singleChoice' | 'isRequired';
type ProductStepOptionalField = 'manifestRefs' | 'compositionRole' | 'presentationOrder' | 'presentationLabel';
type ProductStepProjectionBase = Pick<CustomizationStep, ProductStepRequiredField> &
  Partial<Pick<CustomizationStep, ProductStepOptionalField>>;

export function buildCustomerProductSteps(
  product: DetailedProduct,
  withDrinks: boolean,
  manifest: CustomerStepManifest | null | undefined = product.customerStepManifest,
): CustomizationStep[] {
  const effective = manifest?.steps.length
    ? manifest
    : defaultProductCustomerStepManifest(product, manifest?.revision ?? 0);
  const result = planProductManifest(product, effective, withDrinks);
  return result.valid ? addReview(result.steps, 'item') : buildProductSteps(product, withDrinks);
}

export function inspectProductManifest(product: DetailedProduct, manifest: CustomerStepManifest): string[] {
  return planProductManifest(product, manifest, false).issues;
}

function planProductManifest(
  product: DetailedProduct,
  manifest: CustomerStepManifest,
  withDrinks: boolean,
): PlanResult {
  const defaults = defaultProductCustomerStepManifest(product, manifest.revision);
  const completed = completeManifest(manifest, defaults.steps);
  const issues = [...completed.issues];
  if (manifest.schemaVersion !== 1) issues.push('unsupported-schema');
  if (!Number.isInteger(manifest.revision) || manifest.revision < 0) issues.push('invalid-revision');

  const rows = productRows(product);
  for (const descriptor of completed.steps) {
    if (!isProductCustomerStep(descriptor)) issues.push('wrong-owner-kind');
    else if (!rows.get(descriptor.kind)?.has(descriptor.targetId)) issues.push('stale-target');
  }
  if (issues.length) return { steps: [], valid: false, issues: [...new Set(issues)] };

  const plan = groupCustomerStepScreens(makeCustomerStepManifest(manifest.revision, completed.steps));
  if (!isCustomerScreenOrderValid(plan, [])) issues.push('invalid-dependency-order');
  if (issues.length) return { steps: [], valid: false, issues: [...new Set(issues)] };
  const groups = activeCustomizationGroups(product);
  const steps = plan.flatMap((screen) => projectProductScreen(screen, product, groups));

  if (withDrinks && offersGenericDrinks(product) && new Set(steps.map((step) => step.kind)).size >= 2) {
    steps.push({ id: 'drinks', kind: 'drinks', titleKey: 'step_drinks', singleChoice: false, isRequired: false });
  }
  return { steps, valid: true, issues: [] };
}

function projectProductScreen(
  screen: ReturnType<typeof groupCustomerStepScreens>[number],
  product: DetailedProduct,
  groups: ReturnType<typeof activeCustomizationGroups>,
): CustomizationStep[] {
  const refs = screen.refs.filter(isProductCustomerStep);
  const ids = refs.map((ref) => ref.targetId);
  const base = {
    id: screen.id,
    singleChoice: false,
    isRequired: false,
    manifestRefs: refs,
    compositionRole: screen.compositionRole,
    presentationOrder: screen.presentationOrder,
    presentationLabel: screen.presentationLabel,
  };
  if (screen.kind === 'ProductVariation') return projectProductVariations(base, ids, product);
  if (screen.kind === 'ProductCustomizationGroup')
    return projectProductGroups(base, ids, groups, screen.presentationLabel);
  if (screen.kind === 'ProductIngredient' || screen.kind === 'ProductSauce') {
    return projectProductIngredients(base, screen.kind, ids, screen.presentationLabel, product);
  }
  if (screen.kind === 'ProductSuggestedSide') return projectProductSides(base, ids, screen, product);
  return [];
}

function projectProductVariations(
  base: ProductStepProjectionBase,
  ids: string[],
  product: DetailedProduct,
): CustomizationStep[] {
  return [
    {
      ...base,
      kind: 'variations',
      titleKey: STEP_TITLES.ProductVariation,
      singleChoice: true,
      isRequired: Boolean(product.hideBaseProduct),
      variationIds: ids,
    },
  ];
}

function projectProductGroups(
  base: ProductStepProjectionBase,
  ids: string[],
  groups: ReturnType<typeof activeCustomizationGroups>,
  label?: string | null,
): CustomizationStep[] {
  const selectedGroups = groups.filter((group) => ids.includes(group.id));
  if (!selectedGroups.length) return [];
  const group = selectedGroups[0];
  return [
    {
      ...base,
      kind: 'group',
      title: label ?? (selectedGroups.length === 1 ? group.name : undefined),
      titleKey: selectedGroups.length === 1 ? undefined : STEP_TITLES.ProductCustomizationGroup,
      group,
      groups: selectedGroups,
      singleChoice: selectedGroups.length === 1 && group.maxSelection === 1,
      isRequired: selectedGroups.some((entry) => entry.isRequired || entry.minSelection > 0),
    },
  ];
}

function projectProductIngredients(
  base: ProductStepProjectionBase,
  kind: 'ProductIngredient' | 'ProductSauce',
  ids: string[],
  label: string | null | undefined,
  product: DetailedProduct,
): CustomizationStep[] {
  const sauce = kind === 'ProductSauce';
  const ingredients = (product.detailedIngredients ?? []).filter(
    (ingredient) => ids.includes(ingredient.id) && ingredient.isActive && isSauce(ingredient) === sauce,
  );
  if (!ingredients.length) return [];
  const ingredientIds = ingredients.map((ingredient) => ingredient.id);
  return [
    {
      ...base,
      kind: sauce ? 'sauces' : 'ingredients',
      titleKey: STEP_TITLES[kind],
      title: label ?? undefined,
      ingredientIds,
      sauceIds: ingredientIds,
      sauceMin: product.sauceMin ?? 0,
      isRequired: sauce && (product.sauceMin ?? 0) > 0,
      singleChoice: sauce && product.sauceMax === 1,
    },
  ];
}

function projectProductSides(
  base: ProductStepProjectionBase,
  ids: string[],
  screen: ReturnType<typeof groupCustomerStepScreens>[number],
  product: DetailedProduct,
): CustomizationStep[] {
  const sides = (product.suggestedSideItems ?? []).filter(
    (side) => side.suggestedSideItemId && ids.includes(side.suggestedSideItemId),
  );
  if (!sides.length) return [];
  const first = sides[0];
  if (!first) return [];
  const sideGroup = getSideGroup(first.type);
  return [
    {
      ...base,
      kind: 'sides',
      titleKey: screen.compositionRole === 'Drink' ? 'step_drinks' : STEP_TITLES.ProductSuggestedSide,
      title: screen.presentationLabel ?? undefined,
      sideGroup: sides.every((side) => side.type === first.type) ? sideGroup : undefined,
      sideItemIds: sides.flatMap((side) => (side.suggestedSideItemId ? [side.suggestedSideItemId] : [])),
      requiredSideItemIds: sides
        .filter((side) => side.isRequired)
        .flatMap((side) => (side.suggestedSideItemId ? [side.suggestedSideItemId] : [])),
      isRequired: sides.some((side) => side.isRequired),
    },
  ];
}

function getSideGroup(type: string | undefined): SuggestedSideGroup {
  if (type === 'beverage') return 'beverages';
  if (type === 'dessert') return 'desserts';
  return 'accompaniments';
}

function productRows(product: DetailedProduct): Map<string, Set<string>> {
  return new Map([
    ['ProductVariation', new Set((product.variations ?? []).filter((row) => row.isActive).map((row) => row.id))],
    [
      'ProductIngredient',
      new Set((product.detailedIngredients ?? []).filter((row) => row.isActive && !isSauce(row)).map((row) => row.id)),
    ],
    [
      'ProductSauce',
      new Set((product.detailedIngredients ?? []).filter((row) => row.isActive && isSauce(row)).map((row) => row.id)),
    ],
    ['ProductCustomizationGroup', new Set(activeCustomizationGroups(product).map((row) => row.id))],
    [
      'ProductSuggestedSide',
      new Set(
        (product.suggestedSideItems ?? []).flatMap((row) => (row.suggestedSideItemId ? [row.suggestedSideItemId] : [])),
      ),
    ],
  ]);
}
