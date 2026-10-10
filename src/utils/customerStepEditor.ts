import type {
  BundleSectionCustomerStep,
  CustomerCompositionRole,
  CustomerStepDescriptor,
  CustomerStepManifest,
  MenuSection,
} from '@/types/menu';
import { isBundleComponentStep } from '@/types/menu';
import {
  findCustomerStepCompletionTarget,
  groupCustomerStepScreens,
  makeCustomerStepManifest,
  type CustomerStepScreen,
} from './customerStepManifest';
import { isCustomerScreenOrderValid } from './customerStepDependencies';

export { isCustomerScreenOrderValid } from './customerStepDependencies';

export function reorderCustomerScreens(
  manifest: CustomerStepManifest,
  screenId: string,
  targetIndex: number,
  sections: readonly MenuSection[],
): CustomerStepManifest | null {
  const screens = groupCustomerStepScreens(manifest);
  const currentIndex = screens.findIndex((screen) => screen.id === screenId);
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= screens.length) return null;
  const [moved] = screens.splice(currentIndex, 1);
  screens.splice(targetIndex, 0, moved);
  if (!isCustomerScreenOrderValid(screens, sections)) return null;
  const orderByRef = new Map<string, number>();
  screens.forEach((screen, order) => screen.refs.forEach((ref) => orderByRef.set(refKey(ref), order)));
  return makeCustomerStepManifest(
    manifest.revision,
    manifest.steps.map((step) => ({
      ...step,
      presentationOrder: orderByRef.get(refKey(step)) ?? step.presentationOrder,
    })),
  );
}

export function changeCustomerScreenRole(
  manifest: CustomerStepManifest,
  screen: CustomerStepScreen,
  role: Exclude<CustomerCompositionRole, 'Unknown'>,
  sections: readonly MenuSection[],
): CustomerStepManifest | null {
  const refKeys = new Set(screen.refs.map(refKey));
  const next = makeCustomerStepManifest(
    manifest.revision,
    manifest.steps.map((step) => {
      if (!refKeys.has(refKey(step))) return step;
      const updated = { ...step, compositionRole: role };
      return role === 'Dish' ? updated : withoutPresentationLabel(updated);
    }),
  );
  return isCustomerScreenOrderValid(groupCustomerStepScreens(next), sections) ? next : null;
}

export function canChangeCustomerScreenRole(
  manifest: CustomerStepManifest,
  screen: CustomerStepScreen,
  role: Exclude<CustomerCompositionRole, 'Unknown'>,
  sections: readonly MenuSection[],
): boolean {
  return changeCustomerScreenRole(manifest, screen, role, sections) !== null;
}

export function changeCustomerScreenLabel(
  manifest: CustomerStepManifest,
  screen: CustomerStepScreen,
  label: string | null,
): CustomerStepManifest {
  const refKeys = new Set(screen.refs.map(refKey));
  return makeCustomerStepManifest(
    manifest.revision,
    manifest.steps.map((step) => {
      if (!refKeys.has(refKey(step))) return step;
      const { presentationLabel: _oldLabel, ...withoutLabel } = step;
      return label?.trim() ? { ...withoutLabel, presentationLabel: label.trim() } : withoutLabel;
    }),
  );
}

/** Mirror the backend's append behavior when newly added rows have no saved manifest reference yet. */
export function completeCustomerManifestForEditor(
  manifest: CustomerStepManifest,
  defaultSteps: readonly CustomerStepDescriptor[],
): CustomerStepManifest {
  const steps = manifest.steps.map((step) => ({ ...step }));
  const seen = new Set(steps.map(refKey));
  let nextOrder = Math.max(-1, ...steps.map((step) => step.presentationOrder)) + 1;
  const defaultScreens = groupCustomerStepScreens(makeCustomerStepManifest(manifest.revision, defaultSteps));
  for (const screen of defaultScreens) {
    const missing = screen.refs.filter((step) => !seen.has(refKey(step)));
    if (!missing.length) continue;
    missing.forEach((step) => seen.add(refKey(step)));
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
  return makeCustomerStepManifest(manifest.revision, steps);
}

export function changeBundleSectionParent(
  manifest: CustomerStepManifest,
  targetSectionId: string,
  parentComponentId: string | null,
  sections: readonly MenuSection[],
): CustomerStepManifest | null {
  const next = makeCustomerStepManifest(
    manifest.revision,
    manifest.steps.map((step) =>
      step.kind === 'BundleSection' && step.targetId === targetSectionId ? withParent(step, parentComponentId) : step,
    ),
  );
  return isCustomerScreenOrderValid(groupCustomerStepScreens(next), sections) ? next : null;
}

function withParent(step: BundleSectionCustomerStep, parentComponentId: string | null): BundleSectionCustomerStep {
  const { parentComponentId: _oldParent, ...withoutParent } = step;
  return parentComponentId ? { ...withoutParent, parentComponentId } : withoutParent;
}

function withoutPresentationLabel<T extends CustomerStepDescriptor>(step: T): T {
  const { presentationLabel: _label, ...rest } = step;
  return rest as T;
}

function refKey(step: CustomerStepDescriptor): string {
  if (step.kind === 'BundleSection') return `${step.kind}:${step.targetId}`;
  if (isBundleComponentStep(step)) return `${step.kind}:${step.sectionItemId}:${step.scopeId}`;
  return `${step.kind}:${step.targetId}`;
}
