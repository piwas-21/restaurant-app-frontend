import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';
import type { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import type { TranslationFieldInput, TranslationFieldRef } from '@/services/translationWorkbenchService';
import { isPersistedMenuId } from '@/utils/menuSectionDraft';
import {
  buildTranslationSlots,
  type ProductContentRow,
  type TranslationSlot,
  type TranslatableVariation,
  withVariationClientKeys,
} from './translationSlots';

export { applyReviewedTranslations } from './applyReviewedTranslations';
export type { ReviewedTextChange } from './applyReviewedTranslations';

type Editor = ReturnType<typeof useProductEditorForm>;
type EditorSource = Pick<
  Editor,
  'form' | 'detailedIngredients' | 'menuDefinition' | 'categories' | 'primaryCategoryId'
> & {
  readonly variations: { readonly fields: readonly { readonly id: string }[] };
};

export interface TranslationReviewField {
  readonly input: TranslationFieldInput;
  /** Snapshot fields shared by product and simple-owner review flows. */
  readonly slot: Pick<TranslationSlot, 'key' | 'fieldLabel' | 'source' | 'translations'> & {
    readonly group?: TranslationSlot['group'];
    readonly multiline?: boolean;
    readonly ref?: TranslationSlot['ref'];
  };
  readonly sourceLocaleKnown: boolean;
}

export function fieldReferenceKey(ref: TranslationFieldRef): string {
  return [ref.entityType, ref.entityId ?? '', ref.clientKey ?? '', ref.fieldKey].join('|');
}

const localeValue = (locale: string): LanguageCode =>
  LANGUAGE_CODES.includes(locale as LanguageCode) ? (locale as LanguageCode) : 'en';

function idOrPosition(id: string | undefined, position: number): string | number {
  if (id) return id;
  return position;
}

function fieldIdentity(slot: TranslationSlot, editor: EditorSource, productId: string) {
  const { ref } = slot;
  if (ref.target === 'item') {
    return productId
      ? { entityType: 'product' as const, entityId: productId }
      : { entityType: 'product' as const, clientKey: 'product:draft' }; // pragma: allowlist secret -- stable unsaved-row identity
  }
  if (ref.target === 'variation') {
    const id = ref.variationId;
    return isPersistedMenuId(id)
      ? { entityType: 'productVariation' as const, entityId: id }
      : {
          entityType: 'productVariation' as const,
          clientKey: `variation:${ref.clientKey ?? id ?? ref.index}`, // pragma: allowlist secret -- stable local row identity
        }; // pragma: allowlist secret -- local draft key
  }
  if (ref.target === 'ingredient') {
    const id = ref.ingredientId;
    return isPersistedMenuId(id)
      ? { entityType: 'productIngredient' as const, entityId: id }
      : { entityType: 'productIngredient' as const, clientKey: `ingredient:${idOrPosition(id, ref.index)}` }; // pragma: allowlist secret -- local draft key
  }
  const id = editor.menuDefinition.sections[ref.index]?.id;
  return isPersistedMenuId(id)
    ? { entityType: 'menuSection' as const, entityId: id }
    : { entityType: 'menuSection' as const, clientKey: `section:${id || ref.index}` }; // pragma: allowlist secret -- local draft key
}

export function buildTranslationReviewFields(
  editor: EditorSource,
  productId: string,
  sourceLocaleFor: (slotKey: string, slot: TranslationSlot) => string,
  sourceLocaleKnownFor: (slotKey: string, slot: TranslationSlot) => boolean,
): TranslationReviewField[] {
  const values = editor.form.getValues();
  const context = {
    dishName: String(values.name ?? ''),
    category: editor.categories?.find((category) => category.id === editor.primaryCategoryId)?.name ?? null,
    exclusions: [],
  };
  const slots = buildTranslationSlots({
    name: String(values.name ?? ''),
    description: String(values.description ?? ''),
    content: values.content as ProductContentRow[] | undefined,
    variations: withVariationClientKeys(
      values.variations as TranslatableVariation[] | undefined,
      editor.variations.fields,
    ),
    ingredients: editor.detailedIngredients,
    sections: editor.menuDefinition.sections,
  });

  return slots.map((slot) => {
    const identity = fieldIdentity(slot, editor, productId);
    return {
      slot,
      sourceLocaleKnown: sourceLocaleKnownFor(slot.key, slot),
      input: {
        fieldRef: {
          ...identity,
          fieldKey: slot.ref.target === 'ingredient' ? 'name' : slot.ref.field,
        },
        sourceLocale: localeValue(sourceLocaleFor(slot.key, slot)),
        sourceText: slot.source,
        context,
        targetTexts: LANGUAGE_CODES.reduce(
          (current, locale) => ({ ...current, [locale]: slot.translations[locale] ?? '' }),
          {} as Record<LanguageCode, string>,
        ),
      },
    };
  });
}
