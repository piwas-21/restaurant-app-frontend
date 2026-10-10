import type { BundleSectionCustomerStep, CustomerStepDescriptor, MenuSection } from '@/types/menu';
import { isBundleComponentStep, isProductCustomerStep } from '@/types/menu';
import { customerStepScopeKey, isSinglePickerKind, type CustomerStepScreen } from './customerStepManifest';

/** Enforce owner ordering and required sibling dependencies for editor and planner projections. */
export function isCustomerScreenOrderValid(
  screens: readonly CustomerStepScreen[],
  sections: readonly MenuSection[],
): boolean {
  if (!hasOneGlobalPickerPerOwner(screens)) return false;
  const positions = new Map(screens.map((screen, index) => [screen.id, index]));
  const sectionScreens = mapSectionScreens(screens);
  const componentOwners = mapComponentOwners(sections);
  const dependencies = collectRequiredChildren(screens, sections);
  const requiredProductChoices = screens.filter(
    (screen) => screen.kind.startsWith('Product') && screen.compositionRole === 'RequiredChoice',
  );
  const requiredComponentChoices = collectRequiredComponentChoices(screens);
  const isBefore = (left: CustomerStepScreen | undefined, right: CustomerStepScreen) =>
    Boolean(left && (positions.get(left.id) ?? -1) < (positions.get(right.id) ?? -1));
  const context: RefPositionContext = {
    sectionScreens,
    componentOwners,
    requiredChildren: dependencies,
    requiredProductChoices,
    requiredComponentChoices,
    isBefore,
  };

  if (!screens.every((screen) => screen.refs.every((ref) => isValidRefPosition(ref, screen, context)))) return false;
  return !hasSectionDependencyCycle(screens, componentOwners);
}

function hasOneGlobalPickerPerOwner(screens: readonly CustomerStepScreen[]): boolean {
  const seen = new Set<string>();
  for (const screen of screens) {
    if (!isSinglePickerKind(screen.kind)) continue;
    const key = `${screen.kind}:${customerStepScopeKey(screen.refs[0])}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

function collectRequiredComponentChoices(screens: readonly CustomerStepScreen[]): Map<string, CustomerStepScreen[]> {
  const result = new Map<string, CustomerStepScreen[]>();
  for (const screen of screens) {
    const ref = screen.refs.find(isBundleComponentStep);
    if (!ref || screen.compositionRole !== 'RequiredChoice') continue;
    const choices = result.get(ref.sectionItemId) ?? [];
    choices.push(screen);
    result.set(ref.sectionItemId, choices);
  }
  return result;
}

function mapSectionScreens(screens: readonly CustomerStepScreen[]): Map<string, CustomerStepScreen> {
  const result = new Map<string, CustomerStepScreen>();
  for (const screen of screens) {
    const ref = screen.refs[0];
    if (ref.kind === 'BundleSection') result.set(ref.targetId, screen);
  }
  return result;
}

function mapComponentOwners(sections: readonly MenuSection[]): Map<string, string> {
  return new Map(sections.flatMap((section) => section.items.map((item) => [item.id, section.id] as const)));
}

function collectRequiredChildren(
  screens: readonly CustomerStepScreen[],
  sections: readonly MenuSection[],
): Map<string, CustomerStepScreen[]> {
  const result = new Map<string, CustomerStepScreen[]>();
  for (const child of screens) {
    const ref = child.refs.find((entry) => entry.kind === 'BundleSection');
    if (ref?.kind !== 'BundleSection' || !ref.parentComponentId || !isRequiredChoice(ref, sections)) continue;
    const siblings = result.get(ref.parentComponentId) ?? [];
    siblings.push(child);
    result.set(ref.parentComponentId, siblings);
  }
  return result;
}

function isRequiredChoice(ref: BundleSectionCustomerStep, sections: readonly MenuSection[]): boolean {
  const section = sections.find((entry) => entry.id === ref.targetId);
  return ref.compositionRole === 'RequiredChoice' || Boolean(section?.isRequired) || (section?.minSelection ?? 0) > 0;
}

interface RefPositionContext {
  sectionScreens: ReadonlyMap<string, CustomerStepScreen>;
  componentOwners: ReadonlyMap<string, string>;
  requiredChildren: ReadonlyMap<string, readonly CustomerStepScreen[]>;
  requiredProductChoices: readonly CustomerStepScreen[];
  requiredComponentChoices: ReadonlyMap<string, readonly CustomerStepScreen[]>;
  isBefore: (left: CustomerStepScreen | undefined, right: CustomerStepScreen) => boolean;
}

function isValidRefPosition(
  ref: CustomerStepDescriptor,
  screen: CustomerStepScreen,
  context: RefPositionContext,
): boolean {
  const {
    sectionScreens,
    componentOwners,
    requiredChildren,
    requiredProductChoices,
    requiredComponentChoices,
    isBefore,
  } = context;
  if (ref.kind === 'BundleSection') {
    if (!ref.parentComponentId) return true;
    const ownerId = componentOwners.get(ref.parentComponentId);
    const ownerScreen = ownerId ? sectionScreens.get(ownerId) : undefined;
    return Boolean(
      ownerId && ownerId !== ref.targetId && ownerScreen?.compositionRole === 'Dish' && isBefore(ownerScreen, screen),
    );
  }
  if (isProductCustomerStep(ref)) {
    return screen.compositionRole !== 'Extra' || requiredProductChoices.every((choice) => isBefore(choice, screen));
  }
  if (!isBundleComponentStep(ref)) return true;
  const owner = sectionScreens.get(ref.sectionId);
  if (!owner || !isBefore(owner, screen)) return false;
  if (screen.compositionRole !== 'Extra') return true;
  return (
    (requiredChildren.get(ref.sectionItemId) ?? []).every((child) => isBefore(child, screen)) &&
    (requiredComponentChoices.get(ref.sectionItemId) ?? []).every((choice) => isBefore(choice, screen))
  );
}

function hasSectionDependencyCycle(
  screens: readonly CustomerStepScreen[],
  ownerSection: ReadonlyMap<string, string>,
): boolean {
  const edges = new Map<string, string[]>();
  for (const screen of screens) {
    const ref = screen.refs.find((entry): entry is BundleSectionCustomerStep => entry.kind === 'BundleSection');
    if (!ref?.parentComponentId) continue;
    const parent = ownerSection.get(ref.parentComponentId);
    if (!parent) return true;
    const targets = edges.get(parent) ?? [];
    targets.push(ref.targetId);
    edges.set(parent, targets);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const child of edges.get(id) ?? []) if (visit(child)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return [...edges.keys()].some(visit);
}
