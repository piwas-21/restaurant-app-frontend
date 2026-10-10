import type { MenuSection, MenuSectionItem, SelectedMenuOption } from '@/types/menu';

export interface BundleOptionResolution {
  index: number;
  selection: SelectedMenuOption;
  sectionId: string;
  status: 'resolved' | 'unresolved';
  reason?: 'missing-section' | 'stale-row' | 'no-match' | 'ambiguous-row' | 'duplicate-selection';
  section?: MenuSection;
  item?: MenuSectionItem;
  canonicalSelection?: SelectedMenuOption;
}

export interface BundleRowSelection {
  selection?: SelectedMenuOption;
  selectedIndex?: number;
  recoverableIndex?: number;
  unresolvedCount: number;
}

export interface BundleOptionLocator {
  sectionId: string;
  itemId: string;
  productVariationId?: string | null;
  menuSectionItemId?: string;
}

/** Resolves legacy product references only when section, product, and fixed variation identify one row. */
export function resolveBundleOptionSelections(
  sections: readonly MenuSection[],
  selections: readonly SelectedMenuOption[],
): BundleOptionResolution[] {
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const provisional = selections.map((selection, index) => resolveOne(sectionById, selection, index));
  const duplicateRows = new Set<string>();
  const rowCounts = new Map<string, number>();
  provisional.forEach((resolution) => {
    if (resolution.status !== 'resolved' || !resolution.item) return;
    const key = `${resolution.sectionId}::${resolution.item.id}`;
    rowCounts.set(key, (rowCounts.get(key) ?? 0) + 1);
  });
  rowCounts.forEach((count, key) => {
    if (count > 1) duplicateRows.add(key);
  });

  return provisional.map((resolution) => {
    const key = resolution.item ? `${resolution.sectionId}::${resolution.item.id}` : '';
    return duplicateRows.has(key)
      ? { ...resolution, status: 'unresolved', reason: 'duplicate-selection', canonicalSelection: undefined }
      : resolution;
  });
}

/** Resolves one selected option by stable row ID, or by a unique legacy catalogue match. */
export function resolveSelectedBundleOption(
  sections: readonly MenuSection[],
  selections: readonly SelectedMenuOption[],
  locator: BundleOptionLocator,
): BundleOptionResolution | undefined {
  const matches = resolveBundleOptionSelections(sections, selections).filter(
    (entry) =>
      entry.status === 'resolved' &&
      entry.item?.productId === locator.itemId &&
      entry.sectionId === locator.sectionId &&
      sameVariation(entry.item.productVariationId, locator.productVariationId) &&
      (!locator.menuSectionItemId || entry.item.id === locator.menuSectionItemId),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function hasUnresolvedBundleOptionSelections(
  sections: readonly MenuSection[],
  selections: readonly SelectedMenuOption[],
): boolean {
  return resolveBundleOptionSelections(sections, selections).some((entry) => entry.status !== 'resolved');
}

export function removeUnresolvedBundleOptionSelections(
  sections: readonly MenuSection[],
  selections: readonly SelectedMenuOption[],
): SelectedMenuOption[] {
  const unresolved = new Set(
    resolveBundleOptionSelections(sections, selections)
      .filter((entry) => entry.status !== 'resolved')
      .map((entry) => entry.index),
  );
  return selections.filter((_, index) => !unresolved.has(index));
}

/** Resolves one rendered row and exposes a legacy draft only when a click can bind it unambiguously. */
export function resolveBundleRowSelection(
  section: MenuSection,
  selections: readonly SelectedMenuOption[],
  row: MenuSectionItem,
): BundleRowSelection {
  const resolutions = resolveBundleOptionSelections([section], selections);
  const selected = resolutions.find((entry) => entry.status === 'resolved' && entry.item?.id === row.id);
  if (selected?.canonicalSelection)
    return { selection: selected.canonicalSelection, selectedIndex: selected.index, unresolvedCount: 0 };

  const unresolved = resolutions.filter(
    (entry) =>
      entry.status === 'unresolved' &&
      entry.sectionId === section.id &&
      entry.selection.itemId === row.productId &&
      sameVariation(entry.selection.productVariationId, row.productVariationId),
  );
  return {
    ...(unresolved.length === 1 ? { recoverableIndex: unresolved[0].index } : {}),
    unresolvedCount: unresolved.length,
  };
}

function resolveOne(
  sectionById: ReadonlyMap<string, MenuSection>,
  selection: SelectedMenuOption,
  index: number,
): BundleOptionResolution {
  const section = sectionById.get(selection.sectionId);
  if (!section) return unresolved(index, selection, 'missing-section');

  if (selection.menuSectionItemId) {
    const item = section.items.find((candidate) => candidate.id === selection.menuSectionItemId);
    if (
      !item ||
      item.productId !== selection.itemId ||
      !sameVariation(item.productVariationId, selection.productVariationId)
    )
      return unresolved(index, selection, 'stale-row', section);
    return resolved(index, selection, section, item);
  }

  const matches = section.items.filter(
    (candidate) =>
      candidate.productId === selection.itemId &&
      sameVariation(candidate.productVariationId, selection.productVariationId),
  );
  if (matches.length === 1) return resolved(index, selection, section, matches[0]);
  return unresolved(index, selection, matches.length > 1 ? 'ambiguous-row' : 'no-match', section);
}

function resolved(
  index: number,
  selection: SelectedMenuOption,
  section: MenuSection,
  item: MenuSectionItem,
): BundleOptionResolution {
  return {
    index,
    selection,
    sectionId: section.id,
    status: 'resolved',
    section,
    item,
    canonicalSelection: { ...selection, sectionId: section.id, itemId: item.productId, menuSectionItemId: item.id },
  };
}

function unresolved(
  index: number,
  selection: SelectedMenuOption,
  reason: BundleOptionResolution['reason'],
  section?: MenuSection,
): BundleOptionResolution {
  return { index, selection, sectionId: selection.sectionId, status: 'unresolved', reason, section };
}

function sameVariation(left?: string | null, right?: string | null): boolean {
  return (left ?? null) === (right ?? null);
}
