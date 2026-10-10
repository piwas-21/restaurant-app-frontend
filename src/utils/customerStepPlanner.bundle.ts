import type {
  CustomerStepDescriptor,
  CustomerStepManifest,
  MenuSection,
  MenuSectionItem,
  SelectedMenuOption,
} from '@/types/menu';
import { isBundleComponentStep } from '@/types/menu';
import { buildBundleSteps, type CustomizationStep } from './customizationSteps';
import {
  defaultBundleCustomerStepManifest,
  groupCustomerStepScreens,
  makeCustomerStepManifest,
} from './customerStepManifest';
import { isCustomerScreenOrderValid } from './customerStepDependencies';
import { addReview, completeManifest, type CustomerScreen, type PlanResult } from './customerStepPlanner.shared';
import { orderBundleSteps } from './customerStepPlanner.bundleOrder';
import {
  componentScopeExists,
  projectSelectedComponentScreens,
  resolveSelectedComponents,
  type SelectedBundleComponent,
} from './customerStepPlanner.bundleComponents';
import { resolveBundleOptionSelections } from './bundleOptionResolution';

export function buildMixedBundleSteps(
  sections: readonly MenuSection[],
  manifest: CustomerStepManifest | null | undefined,
  selectedOptions: readonly SelectedMenuOption[],
): CustomizationStep[] {
  const effective = manifest?.steps.length
    ? manifest
    : defaultBundleCustomerStepManifest(sections, manifest?.revision ?? 0);
  if (effective.steps.length === 0) return markSelectionRecovery(buildBundleSteps(sections), sections, selectedOptions);
  const result = planBundleManifest(sections, effective, selectedOptions);
  if (!result.valid) return markSelectionRecovery(buildBundleSteps(sections), sections, selectedOptions);
  return addReview(markSelectionRecovery(result.steps, sections, selectedOptions), 'menu');
}

function markSelectionRecovery(
  steps: CustomizationStep[],
  sections: readonly MenuSection[],
  selections: readonly SelectedMenuOption[],
): CustomizationStep[] {
  const unresolved = resolveBundleOptionSelections(sections, selections).filter((entry) => entry.status !== 'resolved');
  if (!unresolved.length) return steps;
  const sectionSteps = steps.filter((step) => step.kind === 'section' && step.section);
  const availableIds = new Set(sectionSteps.map((step) => step.section?.id));
  const recoveryIds = new Set(
    unresolved.filter((entry) => availableIds.has(entry.sectionId)).map((entry) => entry.sectionId),
  );
  if (unresolved.some((entry) => !availableIds.has(entry.sectionId)) && sectionSteps[0]?.section)
    recoveryIds.add(sectionSteps[0].section.id);
  return steps.map((step) =>
    step.kind === 'section' && step.section && recoveryIds.has(step.section.id)
      ? { ...step, selectionRecovery: true }
      : step,
  );
}

export function inspectBundleManifest(sections: readonly MenuSection[], manifest: CustomerStepManifest): string[] {
  return planBundleManifest(sections, manifest, []).issues;
}

function planBundleManifest(
  sections: readonly MenuSection[],
  manifest: CustomerStepManifest,
  selectedOptions: readonly SelectedMenuOption[],
): PlanResult {
  const validation = validateBundleManifest(sections, manifest);
  const { completed, issues, sectionById } = validation;
  if (issues.length) return { steps: [], valid: false, issues: [...new Set(issues)] };

  const screens = groupCustomerStepScreens(makeCustomerStepManifest(manifest.revision, completed.steps));
  const selected = resolveSelectedComponents(sections, selectedOptions);
  const visibleSectionScreens = visibleBundleSectionScreens(screens, selected);
  const bySection = sectionScreenMap(visibleSectionScreens);
  const content = projectBundleSections(visibleSectionScreens, sectionById, sections, bySection);
  const dynamicScreens = projectSelectedComponentScreens(screens, selected, bySection);

  const nodes = [...content, ...dynamicScreens.map((entry) => entry.step)];
  const ordered = orderBundleSteps(nodes, dynamicScreens, visibleSectionScreens, sections, issues);
  return issues.length
    ? { steps: [], valid: false, issues: [...new Set(issues)] }
    : { steps: ordered, valid: true, issues: [] };
}

function validateBundleManifest(sections: readonly MenuSection[], manifest: CustomerStepManifest) {
  const defaults = defaultBundleCustomerStepManifest(sections, manifest.revision);
  const completed = completeManifest(manifest, defaults.steps);
  const issues = [...completed.issues];
  if (manifest.schemaVersion !== 1) issues.push('unsupported-schema');
  if (!Number.isInteger(manifest.revision) || manifest.revision < 0) issues.push('invalid-revision');
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const itemById = new Map(
    sections.flatMap((section) => section.items.map((item) => [item.id, { item, section }] as const)),
  );
  for (const descriptor of completed.steps) validateBundleDescriptor(descriptor, sectionById, itemById, issues);
  const screens = groupCustomerStepScreens(makeCustomerStepManifest(manifest.revision, completed.steps));
  if (!isCustomerScreenOrderValid(screens, sections)) issues.push('invalid-dependency-order');
  return { completed, issues, sectionById };
}

function validateBundleDescriptor(
  descriptor: CustomerStepDescriptor,
  sectionById: ReadonlyMap<string, MenuSection>,
  itemById: ReadonlyMap<string, { item: MenuSectionItem; section: MenuSection }>,
  issues: string[],
): void {
  if (descriptor.kind === 'BundleSection') {
    if (!sectionById.has(descriptor.targetId)) issues.push('stale-section');
    if (descriptor.parentComponentId && !itemById.has(descriptor.parentComponentId))
      issues.push('stale-parent-component');
    return;
  }
  if (!isBundleComponentStep(descriptor)) {
    issues.push('wrong-owner-kind');
    return;
  }
  const owner = itemById.get(descriptor.sectionItemId);
  if (
    owner?.section.id !== descriptor.sectionId ||
    !owner ||
    owner.item.productId !== descriptor.productId ||
    !componentScopeExists(descriptor.kind, descriptor.scopeId, owner.item)
  ) {
    issues.push('stale-component-scope');
  }
}

function visibleBundleSectionScreens(
  screens: readonly CustomerScreen[],
  selected: readonly SelectedBundleComponent[],
): CustomerScreen[] {
  const selectedIds = new Set(selected.map((component) => component.item.id));
  return screens.filter((screen) => {
    if (screen.kind !== 'BundleSection') return false;
    const ref = screen.refs[0];
    return ref.kind === 'BundleSection' && (!ref.parentComponentId || selectedIds.has(ref.parentComponentId));
  });
}

function sectionScreenMap(screens: readonly CustomerScreen[]): Map<string, CustomerScreen> {
  return new Map(
    screens.flatMap((screen) => {
      const ref = screen.refs[0];
      return ref.kind === 'BundleSection' ? [[ref.targetId, screen] as const] : [];
    }),
  );
}

function projectBundleSections(
  screens: readonly CustomerScreen[],
  sectionById: ReadonlyMap<string, MenuSection>,
  sections: readonly MenuSection[],
  bySection: ReadonlyMap<string, CustomerScreen>,
): CustomizationStep[] {
  return screens.flatMap((screen) => {
    const ref = screen.refs[0];
    if (ref.kind !== 'BundleSection') return [];
    const section = sectionById.get(ref.targetId);
    const ownerSection = ref.parentComponentId
      ? sections.find((candidate) => candidate.items.some((item) => item.id === ref.parentComponentId))
      : undefined;
    const parentStepId = ownerSection ? bySection.get(ownerSection.id)?.id : undefined;
    return [
      {
        id: screen.id,
        kind: 'section',
        title: section?.name,
        singleChoice: section?.maxSelection === 1,
        isRequired: Boolean(section?.isRequired),
        section,
        parentStepId,
        returnStepId: parentStepId,
        manifestRefs: screen.refs,
        compositionRole: screen.compositionRole,
        presentationOrder: screen.presentationOrder,
        presentationLabel: screen.presentationLabel,
      },
    ];
  });
}
