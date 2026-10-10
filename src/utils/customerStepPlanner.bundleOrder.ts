import type { CustomerStepDescriptor, MenuSection } from '@/types/menu';
import type { CustomizationStep } from './customizationSteps';
import type { CustomerScreen, DynamicCustomerScreen } from './customerStepPlanner.shared';

export function orderBundleSteps(
  steps: CustomizationStep[],
  dynamic: DynamicCustomerScreen[],
  sectionScreens: readonly CustomerScreen[],
  sections: readonly MenuSection[],
  issues: string[],
): CustomizationStep[] {
  const bySection = new Map(
    steps.flatMap((step) => (step.kind === 'section' && step.section ? [[step.section.id, step] as const] : [])),
  );
  const graph = createDependencyGraph(steps);
  addComponentOwnerDependencies(dynamic, bySection, graph, issues);
  addSectionParentDependencies(sectionScreens, sections, bySection, graph, issues);
  addRequiredChoiceDependencies(dynamic, sectionScreens, sections, bySection, graph);
  const ordered = topologicalOrder(steps, graph);
  if (ordered.length !== steps.length) issues.push('dependency-cycle');
  return ordered;
}

interface DependencyGraph {
  edges: Map<string, Set<string>>;
  incoming: Map<string, number>;
}

function createDependencyGraph(steps: readonly CustomizationStep[]): DependencyGraph {
  return { edges: new Map(), incoming: new Map(steps.map((step) => [step.id, 0])) };
}

function addDependency(graph: DependencyGraph, before?: string, after?: string): void {
  if (!before || !after || before === after || !graph.incoming.has(before) || !graph.incoming.has(after)) return;
  const targets = graph.edges.get(before) ?? new Set<string>();
  if (targets.has(after)) return;
  targets.add(after);
  graph.edges.set(before, targets);
  graph.incoming.set(after, (graph.incoming.get(after) ?? 0) + 1);
}

function addComponentOwnerDependencies(
  dynamic: readonly DynamicCustomerScreen[],
  bySection: ReadonlyMap<string, CustomizationStep>,
  graph: DependencyGraph,
  issues: string[],
): void {
  for (const { screen, step } of dynamic) {
    const owner = screen.sectionId ? bySection.get(screen.sectionId) : undefined;
    if (!owner) issues.push('component-without-section-step');
    addDependency(graph, owner?.id, step.id);
  }
}

function addSectionParentDependencies(
  screens: readonly CustomerScreen[],
  sections: readonly MenuSection[],
  bySection: ReadonlyMap<string, CustomizationStep>,
  graph: DependencyGraph,
  issues: string[],
): void {
  for (const screen of screens) {
    const ref = sectionRef(screen);
    if (!ref?.parentComponentId) continue;
    const ownerSection = sections.find((candidate) =>
      candidate.items.some((item) => item.id === ref.parentComponentId),
    );
    const parentStep = ownerSection ? bySection.get(ownerSection.id) : undefined;
    if (!parentStep) issues.push('section-dependency-without-parent');
    addDependency(graph, parentStep?.id, bySection.get(ref.targetId)?.id);
  }
}

function addRequiredChoiceDependencies(
  dynamic: readonly DynamicCustomerScreen[],
  sectionScreens: readonly CustomerScreen[],
  sections: readonly MenuSection[],
  bySection: ReadonlyMap<string, CustomizationStep>,
  graph: DependencyGraph,
): void {
  for (const { screen, step } of dynamic) {
    if (step.compositionRole !== 'Extra' || !screen.sectionItemId) continue;
    addRequiredChoiceDependenciesForExtra(screen.sectionItemId, step.id, sectionScreens, sections, bySection, graph);
  }
}

function addRequiredChoiceDependenciesForExtra(
  parentComponentId: string,
  extraStepId: string,
  sectionScreens: readonly CustomerScreen[],
  sections: readonly MenuSection[],
  bySection: ReadonlyMap<string, CustomizationStep>,
  graph: DependencyGraph,
): void {
  for (const candidate of sectionScreens) {
    const ref = sectionRef(candidate);
    if (!ref || ref.parentComponentId !== parentComponentId || !sectionIsRequired(ref, sections)) continue;
    addDependency(graph, bySection.get(ref.targetId)?.id, extraStepId);
  }
}

function sectionRef(screen: CustomerScreen) {
  return screen.refs.find(
    (entry): entry is Extract<CustomerStepDescriptor, { kind: 'BundleSection' }> => entry.kind === 'BundleSection',
  );
}

function sectionIsRequired(
  ref: Extract<CustomerStepDescriptor, { kind: 'BundleSection' }>,
  sections: readonly MenuSection[],
): boolean {
  const section = sections.find((entry) => entry.id === ref.targetId);
  return ref.compositionRole === 'RequiredChoice' || Boolean(section?.isRequired) || (section?.minSelection ?? 0) > 0;
}

function topologicalOrder(steps: readonly CustomizationStep[], graph: DependencyGraph): CustomizationStep[] {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const compare = (left: CustomizationStep, right: CustomizationStep) =>
    priority(left) - priority(right) || left.id.localeCompare(right.id);
  const ready = steps.filter((step) => graph.incoming.get(step.id) === 0).sort(compare);
  const ordered: CustomizationStep[] = [];
  while (ready.length) appendReadyStep(ready, ordered, graph, byId, compare);
  return ordered;
}

function appendReadyStep(
  ready: CustomizationStep[],
  ordered: CustomizationStep[],
  graph: DependencyGraph,
  byId: ReadonlyMap<string, CustomizationStep>,
  compare: (left: CustomizationStep, right: CustomizationStep) => number,
): void {
  const step = ready.shift();
  if (!step) return;
  ordered.push(step);
  for (const target of graph.edges.get(step.id) ?? []) {
    const count = (graph.incoming.get(target) ?? 1) - 1;
    graph.incoming.set(target, count);
    if (count === 0) {
      const next = byId.get(target);
      if (next) ready.push(next);
    }
  }
  ready.sort(compare);
}

function priority(step: CustomizationStep): number {
  if (step.presentationOrder !== undefined) return step.presentationOrder;
  return step.kind === 'special' ? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER - 1;
}
