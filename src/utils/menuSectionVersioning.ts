import type { MenuSection, MenuSectionItem } from '@/types/menu';
import { isPersistedMenuId } from './menuSectionDraft';

let fallbackIdSequence = 0;

/** Local-only row keys; persisted IDs are never minted by the browser. */
export function createTemporaryMenuId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return `temp-${cryptoApi.randomUUID()}`;
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const words = cryptoApi.getRandomValues(new Uint32Array(4));
    const random = Array.from(words, (word) => word.toString(16).padStart(8, '0')).join('');
    return `temp-${random}-${fallbackIdSequence++}`;
  }

  // Keep local drafts usable where browser crypto is unavailable. The per-module sequence prevents
  // same-tick collisions in this last-resort path.
  return `temp-${Date.now()}-${fallbackIdSequence++}`;
}

function normalizedTranslations(section: MenuSection): unknown {
  return Object.entries(section.translations ?? {})
    .map(([language, translation]) => [
      language.trim().toLowerCase(),
      translation.name.trim(),
      translation.description?.trim() || null,
    ])
    .sort(([left], [right]) => String(left).localeCompare(String(right)));
}

function normalizedItems(section: MenuSection, includeIds: boolean): unknown[] {
  return section.items.map((item) => ({
    ...(includeIds ? { id: isPersistedMenuId(item.id) ? item.id : null } : {}),
    productId: item.productId,
    productVariationId: item.productVariationId ?? null,
    additionalPrice: item.additionalPrice,
    displayOrder: item.displayOrder,
    isDefault: item.isDefault,
  }));
}

function normalizedSection(section: MenuSection, includeIds: boolean): unknown {
  return {
    ...(includeIds ? { id: isPersistedMenuId(section.id) ? section.id : null } : {}),
    name: section.name,
    description: section.description ?? null,
    displayOrder: section.displayOrder,
    isRequired: section.isRequired,
    minSelection: section.minSelection,
    maxSelection: section.maxSelection,
    allowRepeatedItems: section.allowRepeatedItems ?? false,
    translations: normalizedTranslations(section),
    items: normalizedItems(section, includeIds),
  };
}

/** Compare only fields the section PATCH writes, including stable persisted identities. */
export function menuSectionsEqual(left: readonly MenuSection[], right: readonly MenuSection[]): boolean {
  return (
    JSON.stringify(left.map((section) => normalizedSection(section, true))) ===
    JSON.stringify(right.map((section) => normalizedSection(section, true)))
  );
}

/** Keep the server's canonical section content while sending reviewed translation provenance. */
export function withSectionTranslationMetadata(
  persistedSections: readonly MenuSection[],
  draftSections: readonly MenuSection[],
): MenuSection[] {
  const draftsById = new Map(draftSections.map((section) => [section.id, section]));
  return persistedSections.map((section) => ({
    ...section,
    translationMetadata: draftsById.get(section.id)?.translationMetadata,
  }));
}

function sameItemContent(left: MenuSectionItem, right: MenuSectionItem): boolean {
  return (
    left.productId === right.productId &&
    (left.productVariationId ?? null) === (right.productVariationId ?? null) &&
    left.additionalPrice === right.additionalPrice &&
    left.displayOrder === right.displayOrder &&
    left.isDefault === right.isDefault
  );
}

function sameSectionContent(left: MenuSection, right: MenuSection): boolean {
  return JSON.stringify(normalizedSection(left, false)) === JSON.stringify(normalizedSection(right, false));
}

/** Add server-assigned IDs to a local draft while retaining product names and other read-side data. */
export function mergePatchedMenuSections(
  draftSections: readonly MenuSection[],
  persistedSections: readonly MenuSection[],
): MenuSection[] {
  const unusedSections = new Set(persistedSections.map((_, index) => index));

  return draftSections.map((draft) => {
    let sectionIndex = isPersistedMenuId(draft.id)
      ? persistedSections.findIndex((section, index) => unusedSections.has(index) && section.id === draft.id)
      : -1;

    if (sectionIndex < 0) {
      sectionIndex = persistedSections.findIndex(
        (section, index) => unusedSections.has(index) && sameSectionContent(draft, section),
      );
    }
    if (sectionIndex < 0) return draft;

    unusedSections.delete(sectionIndex);
    const persisted = persistedSections[sectionIndex];
    const unusedItems = new Set(persisted.items.map((_, index) => index));
    const items = draft.items.map((item) => {
      let itemIndex = isPersistedMenuId(item.id)
        ? persisted.items.findIndex((candidate, index) => unusedItems.has(index) && candidate.id === item.id)
        : -1;
      if (itemIndex < 0) {
        itemIndex = persisted.items.findIndex(
          (candidate, index) => unusedItems.has(index) && sameItemContent(item, candidate),
        );
      }
      if (itemIndex < 0) return item;

      unusedItems.delete(itemIndex);
      return { ...item, id: persisted.items[itemIndex].id };
    });

    return { ...draft, id: persisted.id, items };
  });
}
