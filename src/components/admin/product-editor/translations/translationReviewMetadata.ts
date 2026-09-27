import { LANGUAGE_CODES } from '@/config/languageConfig';
import type { TranslationFieldRef } from '@/services/translationWorkbenchService';
import type { EditorTranslationMetadataPatch, LocalizedOwnerMetadataInput } from '@/types/translationMetadata';
import type { TranslationReviewField } from './translationReviewFields';

export const localizedReferenceKey = (ref: TranslationFieldRef, locale: string): string =>
  `${ref.entityType}|${ref.entityId ?? ''}|${ref.clientKey ?? ''}|${ref.fieldKey}|${locale}`;

const emptyOwner = (): { sourceLocales: Record<string, string>; acceptedSuggestionIds: Record<string, string> } => ({
  sourceLocales: {},
  acceptedSuggestionIds: {},
});

const freezeOwner = (owner: ReturnType<typeof emptyOwner>): LocalizedOwnerMetadataInput => owner;

export function createTranslationMetadataPatch(
  fields: readonly TranslationReviewField[],
  acceptedIds: Readonly<Record<string, string>>,
  expectedContentVersion?: string,
): EditorTranslationMetadataPatch {
  const product = emptyOwner();
  const variations: Record<number, ReturnType<typeof emptyOwner>> = {};
  const ingredients: Record<number, ReturnType<typeof emptyOwner>> = {};
  const menuSections: Record<number, ReturnType<typeof emptyOwner>> = {};

  for (const field of fields) {
    const { input, slot } = field;
    const ref = input.fieldRef;
    let owner = product;
    if (slot.ref.target === 'variation') owner = variations[slot.ref.index] ??= emptyOwner();
    else if (slot.ref.target === 'ingredient') owner = ingredients[slot.ref.index] ??= emptyOwner();
    else if (slot.ref.target === 'menuSection') owner = menuSections[slot.ref.index] ??= emptyOwner();
    owner.sourceLocales[ref.fieldKey] = input.sourceLocale;

    for (const locale of LANGUAGE_CODES) {
      const suggestionId = acceptedIds[localizedReferenceKey(ref, locale)];
      if (suggestionId) owner.acceptedSuggestionIds[`${ref.fieldKey}.${locale}`] = suggestionId;
    }
  }

  return {
    product: {
      ...freezeOwner(product),
      ...(expectedContentVersion ? { expectedContentVersion } : {}),
    },
    variations: Object.fromEntries(Object.entries(variations).map(([index, owner]) => [index, freezeOwner(owner)])),
    ingredients: Object.fromEntries(Object.entries(ingredients).map(([index, owner]) => [index, freezeOwner(owner)])),
    menuSections: Object.fromEntries(Object.entries(menuSections).map(([index, owner]) => [index, freezeOwner(owner)])),
  };
}
