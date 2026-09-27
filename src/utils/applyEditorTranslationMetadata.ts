import type { EditorTranslationMetadataPatch, TranslationMetadata } from '@/types/translationMetadata';

type PayloadRow = object;

function stripOwnerMetadata<T extends object>(row: T): T {
  if (!('translationMetadata' in row)) return row;
  return Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'translationMetadata')) as T;
}

function hasOwnerMetadata(metadata: TranslationMetadata | undefined): metadata is TranslationMetadata {
  return Boolean(
    metadata &&
    (Object.keys(metadata.sourceLocales ?? {}).length > 0 ||
      Object.keys(metadata.acceptedSuggestionIds ?? {}).length > 0),
  );
}

function addOwnerMetadata(rows: unknown, metadata: Readonly<Record<number, TranslationMetadata>>): unknown {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row: unknown, index: number) => {
    if (typeof row !== 'object' || row === null) return row;
    const clean = stripOwnerMetadata(row);
    const ownerMetadata = metadata[index];
    return hasOwnerMetadata(ownerMetadata) ? { ...(clean as PayloadRow), translationMetadata: ownerMetadata } : clean;
  });
}

/** Attach staged review metadata to the same product/variation/ingredient/section payload as its text. */
export function applyEditorTranslationMetadata(
  payload: Record<string, unknown>,
  detailedIngredients: readonly object[],
  patch: EditorTranslationMetadataPatch,
): { payload: Record<string, unknown>; detailedIngredients: PayloadRow[] } {
  const nextPayload = stripOwnerMetadata(payload) as Record<string, unknown>;
  if (hasOwnerMetadata(patch.product)) nextPayload.translationMetadata = patch.product;
  nextPayload.variations = addOwnerMetadata(payload.variations, patch.variations);
  nextPayload.menuDefinition = (() => {
    const definition = payload.menuDefinition;
    if (typeof definition !== 'object' || definition === null) return definition;
    const source = definition as Readonly<Record<string, unknown>>;
    return { ...source, sections: addOwnerMetadata(source.sections, patch.menuSections) };
  })();
  return {
    payload: nextPayload,
    detailedIngredients: detailedIngredients.map((row, index) => {
      const clean = stripOwnerMetadata(row);
      const ownerMetadata = patch.ingredients[index];
      return hasOwnerMetadata(ownerMetadata) ? { ...(clean as PayloadRow), translationMetadata: ownerMetadata } : clean;
    }),
  };
}
