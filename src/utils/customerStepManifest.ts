import type {
  CustomerBundleStepKind,
  CustomerCompositionRole,
  CustomerStepDescriptor,
  CustomerStepKind,
  CustomerStepManifest,
  BundleComponentCustomerStep,
  ProductCustomerStep,
  MenuSection,
  MenuSectionItem,
  ProductCustomizationGroup,
  ProductIngredient,
  SuggestedSideItem,
} from '@/types/menu';
import { isBundleComponentStep } from '@/types/menu';
import { groupSuggestedSideItems } from './suggestedSideItems';
import { isSauce } from './sauceGroup';

export interface CustomerStepScreen {
  id: string;
  kind: CustomerStepKind;
  presentationOrder: number;
  compositionRole: CustomerCompositionRole;
  presentationLabel?: string | null;
  refs: CustomerStepDescriptor[];
  sectionId?: string;
  sectionItemId?: string;
  productId?: string;
}

export function customerStepRefKey(step: CustomerStepDescriptor): string {
  if (step.kind === 'BundleSection') return `${step.kind}:${step.targetId}`;
  if (isBundleComponentStep(step)) {
    return `${step.kind}:${step.sectionItemId}:${step.scopeId}`;
  }
  return `${step.kind}:${(step as ProductCustomerStep).targetId}`;
}

export function customerStepScopeKey(step: CustomerStepDescriptor): string {
  if (step.kind === 'BundleSection') return `bundle-section:${step.targetId}`;
  if (isBundleComponentStep(step)) return `${step.sectionItemId}:${step.productId}`;
  return 'product';
}

export function customerStepScreenIdentity(screen: CustomerStepScreen): string {
  return `${screen.kind}:${customerStepScopeKey(screen.refs[0])}:${screen.compositionRole}`;
}

export function findCustomerStepCompletionTarget(
  screen: CustomerStepScreen,
  existingScreens: readonly CustomerStepScreen[],
): { presentationOrder: number; compositionRole?: CustomerCompositionRole; presentationLabel?: string | null } | null {
  const singlePicker = isSinglePickerKind(screen.kind);
  const sameOwner = singlePicker
    ? existingScreens.filter(
        (candidate) =>
          candidate.kind === screen.kind &&
          customerStepScopeKey(candidate.refs[0]) === customerStepScopeKey(screen.refs[0]),
      )
    : [];
  if (sameOwner.length) {
    const target = sameOwner[0];
    return {
      presentationOrder: target.presentationOrder,
      compositionRole: target.compositionRole,
      ...(target.compositionRole === 'Dish' && target.presentationLabel
        ? { presentationLabel: target.presentationLabel }
        : {}),
    };
  }

  const compatible = existingScreens.filter(
    (candidate) => customerStepScreenIdentity(candidate) === customerStepScreenIdentity(screen),
  );
  if (compatible.length !== 1) return null;
  const target = compatible[0];
  return {
    presentationOrder: target.presentationOrder,
    ...(target.compositionRole === 'Dish' && target.presentationLabel
      ? { presentationLabel: target.presentationLabel }
      : {}),
  };
}

export function isSinglePickerKind(kind: CustomerStepScreen['kind']): boolean {
  return (
    kind === 'ProductVariation' ||
    kind === 'BundleComponentVariation' ||
    kind === 'ProductSauce' ||
    kind === 'BundleComponentSauce'
  );
}

/** Group stable row references into the screens the backend manifest describes. */
export function groupCustomerStepScreens(manifest: CustomerStepManifest): CustomerStepScreen[] {
  const groups = new Map<string, CustomerStepDescriptor[]>();
  for (const step of manifest.steps) {
    const key = `${step.kind}:${customerStepScopeKey(step)}:${step.compositionRole}:${step.presentationOrder}`;
    const group = groups.get(key) ?? [];
    group.push(step);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([_key, refs]) => {
      const first = refs[0];
      const ownerScope = customerStepScopeKey(first);
      return {
        id: `customer:${first.kind}:${ownerScope}:${first.compositionRole}:${first.presentationOrder}`,
        kind: first.kind,
        presentationOrder: first.presentationOrder,
        compositionRole: first.compositionRole,
        presentationLabel: first.presentationLabel,
        refs,
        ...(first.kind.startsWith('BundleComponent') && first.kind !== 'BundleSection'
          ? {
              sectionId: (first as BundleComponentCustomerStep).sectionId,
              sectionItemId: (first as BundleComponentCustomerStep).sectionItemId,
              productId: (first as BundleComponentCustomerStep).productId,
            }
          : {}),
      } satisfies CustomerStepScreen;
    })
    .sort((left, right) => left.presentationOrder - right.presentationOrder || left.id.localeCompare(right.id));
}

export function makeCustomerStepManifest(
  revision: number,
  steps: readonly CustomerStepDescriptor[],
): CustomerStepManifest {
  return {
    schemaVersion: 1,
    revision,
    steps: steps.map((step) => ({ ...step })),
  };
}

export function defaultProductStepManifestParts(input: {
  variations?: readonly { id: string; isActive: boolean }[];
  hideBaseProduct?: boolean;
  ingredients?: readonly ProductIngredient[];
  groups?: readonly ProductCustomizationGroup[];
  sides?: readonly SuggestedSideItem[];
}): CustomerStepDescriptor[] {
  const steps: CustomerStepDescriptor[] = [];
  let order = appendProductVariationSteps(input, steps, 0);
  order = appendProductGroupOrIngredientSteps(input, steps, order);
  appendProductSideSteps(input.sides ?? [], steps, order);
  return steps;
}

function appendProductVariationSteps(
  input: { variations?: readonly { id: string; isActive: boolean }[]; hideBaseProduct?: boolean },
  steps: CustomerStepDescriptor[],
  order: number,
): number {
  const active = (input.variations ?? []).filter((variation) => variation.isActive);
  for (const variation of active) {
    steps.push({
      kind: 'ProductVariation',
      targetId: variation.id,
      compositionRole: input.hideBaseProduct ? 'RequiredChoice' : 'Dish',
      presentationOrder: order,
    });
  }
  return order + Number(active.length > 0);
}

function appendProductGroupOrIngredientSteps(
  input: { groups?: readonly ProductCustomizationGroup[]; ingredients?: readonly ProductIngredient[] },
  steps: CustomerStepDescriptor[],
  firstOrder: number,
): number {
  const groups = (input.groups ?? []).filter((group) => group.isActive);
  if (groups.length) return appendProductGroupSteps(groups, steps, firstOrder);
  const ingredients = (input.ingredients ?? []).filter((row) => row.isActive && !isSauce(row));
  const sauces = (input.ingredients ?? []).filter((row) => row.isActive && isSauce(row));
  appendProductIngredients(ingredients, steps, firstOrder);
  appendProductSauces(sauces, steps, firstOrder + Number(ingredients.length > 0));
  return firstOrder + Number(ingredients.length > 0) + Number(sauces.length > 0);
}

function appendProductGroupSteps(
  groups: readonly ProductCustomizationGroup[],
  steps: CustomerStepDescriptor[],
  order: number,
): number {
  for (const group of [...groups.filter(isRequiredGroup), ...groups.filter((group) => !isRequiredGroup(group))]) {
    steps.push({
      kind: 'ProductCustomizationGroup',
      targetId: group.id,
      compositionRole: group.isRequired || group.minSelection > 0 ? 'RequiredChoice' : 'Extra',
      presentationOrder: order++,
    });
  }
  return order;
}

function appendProductIngredients(
  rows: readonly ProductIngredient[],
  steps: CustomerStepDescriptor[],
  order: number,
): void {
  for (const row of rows)
    steps.push({
      kind: 'ProductIngredient',
      targetId: row.id,
      compositionRole: 'Ingredient',
      presentationOrder: order,
    });
}

function appendProductSauces(rows: readonly ProductIngredient[], steps: CustomerStepDescriptor[], order: number): void {
  for (const row of rows)
    steps.push({ kind: 'ProductSauce', targetId: row.id, compositionRole: 'Sauce', presentationOrder: order });
}

function appendProductSideSteps(
  sides: readonly SuggestedSideItem[],
  steps: CustomerStepDescriptor[],
  firstOrder: number,
): void {
  let order = firstOrder;
  for (const group of groupSuggestedSideItems(sides)) {
    for (const side of group.items) {
      if (!side.suggestedSideItemId) continue;
      steps.push({
        kind: 'ProductSuggestedSide',
        targetId: side.suggestedSideItemId,
        compositionRole: side.type === 'beverage' ? 'Drink' : 'Side',
        presentationOrder: order,
      });
    }
    order++;
  }
}

export function defaultProductCustomerStepManifest(
  product: {
    variations?: readonly { id: string; isActive: boolean }[];
    hideBaseProduct?: boolean;
    detailedIngredients?: readonly ProductIngredient[];
    customizationGroups?: readonly ProductCustomizationGroup[];
    suggestedSideItems?: readonly SuggestedSideItem[];
  },
  revision = 0,
): CustomerStepManifest {
  return makeCustomerStepManifest(
    revision,
    defaultProductStepManifestParts({
      variations: product.variations,
      hideBaseProduct: product.hideBaseProduct,
      ingredients: product.detailedIngredients,
      groups: product.customizationGroups,
      sides: product.suggestedSideItems,
    }),
  );
}

export function defaultBundleStepManifestParts(sections: readonly MenuSection[]): CustomerStepDescriptor[] {
  const steps: CustomerStepDescriptor[] = [];
  let order = 0;
  for (const section of [...sections].sort((left, right) => left.displayOrder - right.displayOrder)) {
    steps.push({
      kind: 'BundleSection',
      targetId: section.id,
      compositionRole: section.isRequired || section.minSelection > 0 ? 'RequiredChoice' : 'Extra',
      presentationOrder: order++,
    });
  }

  for (const section of [...sections].sort((left, right) => left.displayOrder - right.displayOrder)) {
    for (const item of [...section.items].sort((left, right) => left.displayOrder - right.displayOrder)) {
      order = appendComponentSteps(steps, section.id, item, order);
    }
  }
  return steps;
}

export function defaultBundleCustomerStepManifest(
  sections: readonly MenuSection[],
  revision = 0,
): CustomerStepManifest {
  return makeCustomerStepManifest(revision, defaultBundleStepManifestParts(sections));
}

function appendComponentSteps(
  steps: CustomerStepDescriptor[],
  sectionId: string,
  item: MenuSectionItem,
  firstOrder: number,
): number {
  let order = appendBundleVariations(steps, sectionId, item, firstOrder);
  order = appendBundleGroupsOrIngredients(steps, sectionId, item, order);
  return appendBundleSides(steps, sectionId, item, order);
}

function appendBundleStep(
  steps: CustomerStepDescriptor[],
  sectionId: string,
  item: MenuSectionItem,
  kind: Exclude<CustomerBundleStepKind, 'BundleSection'>,
  scopeId: string,
  role: CustomerCompositionRole,
  order: number,
): void {
  steps.push({
    kind,
    sectionId,
    sectionItemId: item.id,
    productId: item.productId,
    scopeId,
    compositionRole: role,
    presentationOrder: order,
  } as CustomerStepDescriptor);
}

function appendBundleVariations(
  steps: CustomerStepDescriptor[],
  sectionId: string,
  item: MenuSectionItem,
  order: number,
): number {
  const rows = item.productVariationId ? [] : (item.variations ?? []).filter((variation) => variation.isActive);
  for (const row of rows)
    appendBundleStep(
      steps,
      sectionId,
      item,
      'BundleComponentVariation',
      row.id,
      item.hideBaseProduct ? 'RequiredChoice' : 'Dish',
      order,
    );
  return order + Number(rows.length > 0);
}

function appendBundleGroupsOrIngredients(
  steps: CustomerStepDescriptor[],
  sectionId: string,
  item: MenuSectionItem,
  firstOrder: number,
): number {
  const groups = (item.customizationGroups ?? []).filter((group) => group.isActive);
  if (groups.length) {
    for (const group of [...groups.filter(isRequiredGroup), ...groups.filter((group) => !isRequiredGroup(group))]) {
      appendBundleStep(
        steps,
        sectionId,
        item,
        'BundleComponentCustomizationGroup',
        group.id,
        group.isRequired || group.minSelection > 0 ? 'RequiredChoice' : 'Extra',
        firstOrder++,
      );
    }
    return firstOrder;
  }
  const ingredients = (item.detailedIngredients ?? []).filter((row) => row.isActive && !isSauce(row));
  const sauces = (item.detailedIngredients ?? []).filter((row) => row.isActive && isSauce(row));
  for (const row of ingredients)
    appendBundleStep(steps, sectionId, item, 'BundleComponentIngredient', row.id, 'Ingredient', firstOrder);
  firstOrder += Number(ingredients.length > 0);
  for (const row of sauces)
    appendBundleStep(steps, sectionId, item, 'BundleComponentSauce', row.id, 'Sauce', firstOrder);
  return firstOrder + Number(sauces.length > 0);
}

function isRequiredGroup(group: ProductCustomizationGroup): boolean {
  return group.isRequired || group.minSelection > 0;
}

function appendBundleSides(
  steps: CustomerStepDescriptor[],
  sectionId: string,
  item: MenuSectionItem,
  order: number,
): number {
  const sides = item.suggestedSideItems ?? [];
  for (const side of sides)
    appendBundleStep(
      steps,
      sectionId,
      item,
      'BundleComponentSide',
      side.id,
      side.sideItemProductType === 'beverage' ? 'Drink' : 'Side',
      order++,
    );
  return order;
}
