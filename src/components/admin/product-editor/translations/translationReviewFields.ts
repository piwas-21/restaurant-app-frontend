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
import { nextProductContent, withIngredientTranslation } from './translationWrites';

type Editor = ReturnType<typeof useProductEditorForm>;
type EditorSource = Pick<Editor, 'form' | 'detailedIngredients' | 'menuDefinition'> & {
  readonly variations: { readonly fields: readonly { readonly id: string }[] };
};

export interface TranslationReviewField {
  readonly input: TranslationFieldInput;
  readonly slot: TranslationSlot;
  readonly sourceLocaleKnown: boolean;
}

export function fieldReferenceKey(ref: TranslationFieldRef): string {
  return [ref.entityType, ref.entityId ?? '', ref.clientKey ?? '', ref.fieldKey].join('|');
}

const localeValue = (locale: string): LanguageCode =>
  LANGUAGE_CODES.includes(locale as LanguageCode) ? (locale as LanguageCode) : 'en';

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
          clientKey: `variation:${ref.clientKey || id || ref.index}`, // pragma: allowlist secret -- stable local row identity
        }; // pragma: allowlist secret -- local draft key
  }
  if (ref.target === 'ingredient') {
    const id = ref.ingredientId;
    return isPersistedMenuId(id)
      ? { entityType: 'productIngredient' as const, entityId: id }
      : { entityType: 'productIngredient' as const, clientKey: `ingredient:${id || ref.index}` }; // pragma: allowlist secret -- local draft key
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
        targetTexts: LANGUAGE_CODES.reduce(
          (current, locale) => ({ ...current, [locale]: slot.translations[locale] ?? '' }),
          {} as Record<LanguageCode, string>,
        ),
      },
    };
  });
}

export interface ReviewedTextChange {
  readonly fieldRef: TranslationFieldRef;
  readonly locale: LanguageCode;
  readonly text: string;
}

function matchesReference(id: string | undefined, position: number, ref: TranslationFieldRef, prefix: string): boolean {
  return ref.entityId ? id === ref.entityId : ref.clientKey === `${prefix}:${id || position}`;
}

function applyProductChange(editor: Editor, change: ReviewedTextChange): boolean {
  const rows = (editor.form.getValues('content') ?? []) as ProductContentRow[];
  editor.form.setValue('content', nextProductContent(rows, change.locale, change.fieldRef.fieldKey, change.text), {
    shouldDirty: true,
  });
  return true;
}

function applyVariationChange(editor: Editor, change: ReviewedTextChange): boolean {
  const rows = editor.form.getValues('variations') as Array<{ id?: string }> | undefined;
  const clientKey = change.fieldRef.clientKey?.replace(/^variation:/, '');
  const index =
    rows?.findIndex((row, position) =>
      change.fieldRef.entityId
        ? row.id === change.fieldRef.entityId
        : clientKey
          ? editor.variations.fields[position]?.id === clientKey || row.id === clientKey
          : matchesReference(row.id, position, change.fieldRef, 'variation'),
    ) ?? -1;
  if (index < 0) return false;
  editor.form.setValue(`variations.${index}.content.${change.locale}.${change.fieldRef.fieldKey}`, change.text, {
    shouldDirty: true,
  });
  return true;
}

function applyIngredientChange(
  ingredients: Editor['detailedIngredients'],
  change: ReviewedTextChange,
): Editor['detailedIngredients'] {
  const index = ingredients.findIndex((ingredient, position) =>
    matchesReference(ingredient.id, position, change.fieldRef, 'ingredient'),
  );
  if (index < 0) return ingredients;
  return ingredients.map((ingredient, position) =>
    position === index ? withIngredientTranslation(ingredient, change.locale, change.text) : ingredient,
  );
}

function applySectionChange(
  sections: Editor['menuDefinition']['sections'],
  change: ReviewedTextChange,
): Editor['menuDefinition']['sections'] {
  const index = sections.findIndex((section, position) =>
    matchesReference(section.id, position, change.fieldRef, 'section'),
  );
  if (index < 0) return sections;
  return sections.map((section, position) => {
    if (position !== index) return section;
    const previous = section.translations?.[change.locale] ?? { name: '', description: '' };
    return {
      ...section,
      translations: {
        ...section.translations,
        [change.locale]: { ...previous, [change.fieldRef.fieldKey]: change.text },
      },
    };
  });
}

interface TranslationOwnerUpdates {
  readonly ingredients: Editor['detailedIngredients'];
  readonly sections: Editor['menuDefinition']['sections'];
  readonly applied: number;
}

function applyOneTranslation(
  editor: Editor,
  change: ReviewedTextChange,
  ingredients: Editor['detailedIngredients'],
  sections: Editor['menuDefinition']['sections'],
): TranslationOwnerUpdates {
  switch (change.fieldRef.entityType) {
    case 'product':
      return { ingredients, sections, applied: Number(applyProductChange(editor, change)) };
    case 'productVariation':
      return { ingredients, sections, applied: Number(applyVariationChange(editor, change)) };
    case 'productIngredient': {
      const next = applyIngredientChange(ingredients, change);
      return { ingredients: next, sections, applied: Number(next !== ingredients) };
    }
    case 'menuSection': {
      const next = applySectionChange(sections, change);
      return { ingredients, sections: next, applied: Number(next !== sections) };
    }
    default:
      return { ingredients, sections, applied: 0 };
  }
}

export function applyReviewedTranslations(editor: Editor, changes: readonly ReviewedTextChange[]): number {
  let applied = 0;
  let ingredients = editor.detailedIngredients;
  let sections = editor.menuDefinition.sections;

  for (const change of changes) {
    const updated = applyOneTranslation(editor, change, ingredients, sections);
    ingredients = updated.ingredients;
    sections = updated.sections;
    applied += updated.applied;
  }

  if (ingredients !== editor.detailedIngredients) editor.changeIngredients(ingredients);
  if (sections !== editor.menuDefinition.sections) {
    editor.changeMenuDefinition({ ...editor.menuDefinition, sections });
  }
  return applied;
}
