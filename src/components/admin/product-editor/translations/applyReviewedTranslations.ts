import { type LanguageCode } from '@/config/languageConfig';
import type { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import type { TranslationFieldRef } from '@/services/translationWorkbenchService';
import type { ProductContentRow } from './translationSlots';
import { nextProductContent, withIngredientTranslation } from './translationWrites';

type Editor = ReturnType<typeof useProductEditorForm>;

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
    rows?.findIndex((row, position) => {
      if (change.fieldRef.entityId) return row.id === change.fieldRef.entityId;
      if (clientKey) return editor.variations.fields[position]?.id === clientKey || row.id === clientKey;
      return matchesReference(row.id, position, change.fieldRef, 'variation');
    }) ?? -1;
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
