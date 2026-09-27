import type { EditorTranslationMetadataPatch, TranslationMetadata } from '@/types/translationMetadata';

type PayloadRow = object;

function addOwnerMetadata(rows: unknown, metadata: Readonly<Record<number, TranslationMetadata>>): unknown {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row: unknown, index: number) => {
    if (typeof row !== 'object' || row === null) return row;
    const ownerMetadata = metadata[index];
    return ownerMetadata ? { ...(row as PayloadRow), translationMetadata: ownerMetadata } : row;
  });
}

/** Attach staged review metadata to the same product/variation/ingredient/section payload as its text. */
export function applyEditorTranslationMetadata(
  payload: Record<string, unknown>,
  detailedIngredients: readonly object[],
  patch: EditorTranslationMetadataPatch,
): { payload: Record<string, unknown>; detailedIngredients: PayloadRow[] } {
  const nextPayload: Record<string, unknown> = { ...payload, translationMetadata: patch.product };
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
      const ownerMetadata = patch.ingredients[index];
      return ownerMetadata ? { ...row, translationMetadata: ownerMetadata } : row;
    }),
  };
}
