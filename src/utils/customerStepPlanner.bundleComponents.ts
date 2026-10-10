import type { CustomerBundleStepKind, MenuSection, MenuSectionItem, SelectedMenuOption } from '@/types/menu';
import { isBundleComponentStep } from '@/types/menu';
import { activeCustomizationGroups } from './explicitCustomization';
import { isSauce, toSauceGroupRule } from './sauceGroup';
import type { CustomizationStep } from './customizationSteps';
import { STEP_TITLES, type CustomerScreen, type DynamicCustomerScreen } from './customerStepPlanner.shared';
import { resolveBundleOptionSelections } from './bundleOptionResolution';

export interface SelectedBundleComponent {
  section: MenuSection;
  item: MenuSectionItem;
  hasCustomization: boolean;
}

type ComponentStepBase = Pick<CustomizationStep, 'id' | 'singleChoice' | 'isRequired'> &
  Partial<
    Pick<
      CustomizationStep,
      | 'manifestRefs'
      | 'compositionRole'
      | 'presentationOrder'
      | 'presentationLabel'
      | 'component'
      | 'sectionItemId'
      | 'parentStepId'
      | 'returnStepId'
    >
  >;

export function projectSelectedComponentScreens(
  screens: readonly CustomerScreen[],
  selected: readonly SelectedBundleComponent[],
  bySection: ReadonlyMap<string, CustomerScreen>,
): DynamicCustomerScreen[] {
  return selected.flatMap((component) => projectSelectedComponent(screens, component, bySection));
}

function projectSelectedComponent(
  screens: readonly CustomerScreen[],
  selectedComponent: SelectedBundleComponent,
  bySection: ReadonlyMap<string, CustomerScreen>,
): DynamicCustomerScreen[] {
  const matching = screens.filter((screen) => isComponentScreenFor(screen, selectedComponent));
  const ownerId = bySection.get(selectedComponent.section.id)?.id;
  const steps = matching.flatMap((screen) => {
    const step = projectComponentScreen(screen, selectedComponent.item, ownerId);
    return step ? [{ screen, step }] : [];
  });
  if (matching.length > 0 && selectedComponent.hasCustomization)
    steps.push(makeSpecialRequestScreen(selectedComponent, ownerId));
  return steps;
}

function isComponentScreenFor(screen: CustomerScreen, component: SelectedBundleComponent): boolean {
  return (
    screen.kind !== 'BundleSection' &&
    !screen.kind.startsWith('Product') &&
    screen.sectionItemId === component.item.id &&
    screen.sectionId === component.section.id
  );
}

function makeSpecialRequestScreen(selected: SelectedBundleComponent, ownerId?: string): DynamicCustomerScreen {
  const id = `special:${selected.item.id}`;
  return {
    screen: {
      id,
      kind: 'BundleComponentIngredient',
      presentationOrder: Number.MAX_SAFE_INTEGER,
      compositionRole: 'Extra',
      refs: [],
      sectionId: selected.section.id,
      sectionItemId: selected.item.id,
      productId: selected.item.productId,
    },
    step: {
      id,
      kind: 'special',
      titleKey: 'product_special_requests',
      title: selected.item.productName,
      singleChoice: false,
      isRequired: false,
      component: selected.item,
      sectionItemId: selected.item.id,
      parentStepId: ownerId,
      returnStepId: ownerId,
      compositionRole: 'Extra',
      presentationOrder: Number.MAX_SAFE_INTEGER,
    },
  };
}

function projectComponentScreen(
  screen: CustomerScreen,
  item: MenuSectionItem,
  ownerStepId?: string,
): CustomizationStep | null {
  const ids = screen.refs.flatMap((ref) => (isBundleComponentStep(ref) ? [ref.scopeId] : []));
  const base = componentStepBase(screen, item, ownerStepId);
  if (screen.kind === 'BundleComponentVariation') return projectComponentVariations(base, ids, item);
  if (screen.kind === 'BundleComponentIngredient' || screen.kind === 'BundleComponentSauce') {
    return projectComponentIngredients(base, screen, ids, item);
  }
  if (screen.kind === 'BundleComponentCustomizationGroup') return projectComponentGroups(base, ids, item);
  if (screen.kind === 'BundleComponentSide') return projectComponentSides(base, ids, item);
  return null;
}

function componentStepBase(screen: CustomerScreen, item: MenuSectionItem, ownerStepId?: string): ComponentStepBase {
  return {
    id: screen.id,
    singleChoice: false,
    isRequired: false,
    manifestRefs: screen.refs,
    compositionRole: screen.compositionRole,
    presentationOrder: screen.presentationOrder,
    presentationLabel: screen.presentationLabel,
    component: item,
    sectionItemId: item.id,
    parentStepId: ownerStepId,
    returnStepId: ownerStepId,
  };
}

function projectComponentVariations(
  base: ComponentStepBase,
  ids: string[],
  item: MenuSectionItem,
): CustomizationStep | null {
  if (item.productVariationId) return null;
  const variations = (item.variations ?? []).filter((variation) => ids.includes(variation.id) && variation.isActive);
  if (!variations.length) return null;
  return {
    ...base,
    kind: 'variations',
    titleKey: STEP_TITLES.BundleComponentVariation,
    variationIds: variations.map((variation) => variation.id),
    singleChoice: true,
    isRequired: Boolean(item.hideBaseProduct),
  };
}

function projectComponentIngredients(
  base: ComponentStepBase,
  screen: CustomerScreen,
  ids: string[],
  item: MenuSectionItem,
): CustomizationStep | null {
  const sauce = screen.kind === 'BundleComponentSauce';
  const ingredients = (item.detailedIngredients ?? []).filter(
    (ingredient) => ids.includes(ingredient.id) && ingredient.isActive && isSauce(ingredient) === sauce,
  );
  if (!ingredients.length) return null;
  const rule = toSauceGroupRule(item);
  const ingredientIds = ingredients.map((ingredient) => ingredient.id);
  const titleKey = sauce ? STEP_TITLES.BundleComponentSauce : STEP_TITLES.BundleComponentIngredient;
  return {
    ...base,
    kind: sauce ? 'sauces' : 'ingredients',
    titleKey,
    title: screen.presentationLabel ?? undefined,
    ingredientIds,
    sauceIds: ingredientIds,
    sauceMin: rule.min,
    singleChoice: sauce && rule.max === 1,
    isRequired: sauce && rule.min > 0,
  };
}

function projectComponentGroups(
  base: ComponentStepBase,
  ids: string[],
  item: MenuSectionItem,
): CustomizationStep | null {
  const groups = activeCustomizationGroups(item).filter((group) => ids.includes(group.id));
  if (!groups.length) return null;
  const [group] = groups;
  return {
    ...base,
    kind: 'group',
    title: base.presentationLabel ?? (groups.length === 1 ? group.name : undefined),
    titleKey: groups.length === 1 ? undefined : STEP_TITLES.BundleComponentCustomizationGroup,
    group,
    groups,
    singleChoice: groups.length === 1 && group.maxSelection === 1,
    isRequired: groups.some((entry) => entry.isRequired || entry.minSelection > 0),
  };
}

function projectComponentSides(
  base: ComponentStepBase,
  ids: string[],
  item: MenuSectionItem,
): CustomizationStep | null {
  const sides = (item.suggestedSideItems ?? []).filter((side) => ids.includes(side.id));
  if (!sides.length) return null;
  return {
    ...base,
    kind: 'sides',
    titleKey: STEP_TITLES.BundleComponentSide,
    sideItemIds: sides.map((side) => side.id),
    requiredSideItemIds: sides.filter((side) => side.isRequired).map((side) => side.id),
    isRequired: sides.some((side) => side.isRequired),
  };
}

export function resolveSelectedComponents(
  sections: readonly MenuSection[],
  selected: readonly SelectedMenuOption[],
): SelectedBundleComponent[] {
  return resolveBundleOptionSelections(sections, selected).flatMap((resolution) => {
    const { section, item } = resolution;
    if (resolution.status !== 'resolved' || !section || !item) return [];
    const hasCustomization =
      (item.variations?.some((variation) => variation.isActive) ?? false) ||
      (item.customizationGroups?.some((group) => group.isActive) ?? false) ||
      (item.detailedIngredients?.some((ingredient) => ingredient.isActive) ?? false) ||
      (item.suggestedSideItems?.length ?? 0) > 0;
    return [{ section, item, hasCustomization }];
  });
}

export function componentScopeExists(
  kind: Exclude<CustomerBundleStepKind, 'BundleSection'>,
  scopeId: string,
  item: MenuSectionItem,
): boolean {
  if (kind === 'BundleComponentVariation')
    return (item.variations ?? []).some((variation) => variation.id === scopeId && variation.isActive);
  if (kind === 'BundleComponentCustomizationGroup')
    return activeCustomizationGroups(item).some((group) => group.id === scopeId);
  if (kind === 'BundleComponentIngredient') {
    return (item.detailedIngredients ?? []).some(
      (ingredient) => ingredient.id === scopeId && ingredient.isActive && !isSauce(ingredient),
    );
  }
  if (kind === 'BundleComponentSauce') {
    return (item.detailedIngredients ?? []).some(
      (ingredient) => ingredient.id === scopeId && ingredient.isActive && isSauce(ingredient),
    );
  }
  if (kind === 'BundleComponentSide') return (item.suggestedSideItems ?? []).some((side) => side.id === scopeId);
  return false;
}
