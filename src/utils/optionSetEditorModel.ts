import type { OptionSetDetail, OptionSetEntry, OptionSetKind, OptionSetWriteRequest } from '@/types/optionSet';
import type { LanguageCode } from '@/config/languageConfig';

export function createEmptyOptionSetEntry(displayOrder: number): OptionSetEntry {
  return {
    name: '',
    displayOrder,
    isOptional: true,
    maxQuantity: 1,
    price: 0,
    isIncludedInBasePrice: false,
    isRequired: false,
    additionalPrice: 0,
    isDefault: false,
  };
}

export function optionSetEntryReferenceKey(kind: OptionSetKind, entry: OptionSetEntry): string | null {
  const id = kind === 'ingredient' || kind === 'sauce' ? entry.globalIngredientId : entry.productId;
  return id ? `${kind}:${id}` : null;
}

export function isValidOptionSetDraft(
  kind: OptionSetKind | '',
  name: string,
  entries: readonly OptionSetEntry[],
): boolean {
  if (!kind || name.trim().length === 0 || name.trim().length > 200 || entries.length === 0) return false;
  const references = entries.map((entry) => optionSetEntryReferenceKey(kind, entry));
  if (references.some((key) => key === null) || new Set(references).size !== references.length) return false;
  return entries.every((entry) => {
    if (!entry.name.trim() || entry.name.trim().length > 200) return false;
    if ((kind === 'ingredient' || kind === 'sauce') && (entry.price < 0 || entry.maxQuantity < 1)) return false;
    return kind !== 'bundleChoice' || entry.additionalPrice >= 0;
  });
}

export function buildOptionSetWriteRequest(
  kind: OptionSetKind,
  name: string,
  entries: readonly OptionSetEntry[],
  detail?: OptionSetDetail | null,
  sourceLocale: LanguageCode = 'en',
  translations: Readonly<Record<string, string>> = {},
): OptionSetWriteRequest {
  const isIngredientKind = kind === 'ingredient' || kind === 'sauce';
  return {
    kind,
    name: name.trim(),
    sourceLocale,
    translations: { ...translations, [sourceLocale]: name.trim() },
    ...(detail ? { status: detail.status } : {}),
    entries: entries.map((entry, displayOrder) => ({
      ...(entry.id ? { id: entry.id } : {}),
      name: entry.name.trim(),
      displayOrder,
      ...(isIngredientKind ? { globalIngredientId: entry.globalIngredientId } : { productId: entry.productId }),
      ...(entry.productVariationId ? { productVariationId: entry.productVariationId } : {}),
      isOptional: true,
      maxQuantity: isIngredientKind ? Math.max(1, Math.floor(entry.maxQuantity)) : 1,
      price: isIngredientKind ? Math.max(0, entry.price) : 0,
      isIncludedInBasePrice: isIngredientKind && entry.isIncludedInBasePrice,
      isRequired: false,
      additionalPrice: kind === 'bundleChoice' ? Math.max(0, entry.additionalPrice) : 0,
      isDefault: kind === 'bundleChoice' && entry.isDefault,
    })),
  };
}

export function moveOptionSetEntry(entries: readonly OptionSetEntry[], index: number, delta: -1 | 1): OptionSetEntry[] {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= entries.length) return [...entries];
  const next = [...entries];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next.map((entry, displayOrder) => ({ ...entry, displayOrder }));
}
