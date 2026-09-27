import type { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import { applyReviewedTranslations, buildTranslationReviewFields } from './translationReviewFields';

describe('translation review identities for unsaved variations', () => {
  it('keeps a pending review attached to its variation after rows are reordered', () => {
    let rows = [
      { name: 'Small', content: {} },
      { name: 'Large', content: {} },
    ];
    let fields = [{ id: 'field-small' }, { id: 'field-large' }];
    const form = {
      getValues: jest.fn((name?: string) => (name === 'variations' ? rows : { name: 'Pizza', variations: rows })),
      setValue: jest.fn(),
    };
    const editor = {
      form,
      variations: {
        get fields() {
          return fields;
        },
      },
      detailedIngredients: [],
      menuDefinition: { sections: [] },
      changeIngredients: jest.fn(),
      changeMenuDefinition: jest.fn(),
    } as unknown as ReturnType<typeof useProductEditorForm>;
    const beforeReorder = buildTranslationReviewFields(
      editor,
      'product-1',
      () => 'en',
      () => true,
    );
    const large = beforeReorder.find((field) => field.slot.source === 'Large');

    expect(large?.input.fieldRef.clientKey).toBe('variation:field-large');

    rows = [rows[1], rows[0]];
    fields = [fields[1], fields[0]];
    expect(
      applyReviewedTranslations(editor, [
        {
          fieldRef: large!.input.fieldRef,
          locale: 'fr',
          text: 'Grande',
        },
      ]),
    ).toBe(1);
    expect(form.setValue).toHaveBeenCalledWith('variations.0.content.fr.name', 'Grande', { shouldDirty: true });
  });

  it('uses the ingredient index when a draft ingredient has a blank ID', () => {
    const ingredients = [
      {
        id: '',
        name: 'Cheese',
        isOptional: false,
        price: 0,
        isIncludedInBasePrice: false,
        isActive: true,
        displayOrder: 0,
        maxQuantity: 1,
      },
    ];
    const editor = {
      form: { getValues: jest.fn(() => ({ name: 'Pizza' })) },
      variations: { fields: [] },
      detailedIngredients: ingredients,
      menuDefinition: { sections: [] },
      changeIngredients: jest.fn(),
      changeMenuDefinition: jest.fn(),
    } as unknown as ReturnType<typeof useProductEditorForm>;

    const field = buildTranslationReviewFields(
      editor,
      'product-1',
      () => 'en',
      () => true,
    ).find((candidate) => candidate.slot.ref.target === 'ingredient');

    expect(field?.input.fieldRef.clientKey).toBe('ingredient:0');
    expect(
      applyReviewedTranslations(editor, [{ fieldRef: field!.input.fieldRef, locale: 'fr', text: 'Fromage' }]),
    ).toBe(1);
    expect(editor.changeIngredients).toHaveBeenCalledWith([
      expect.objectContaining({ id: '', content: { fr: { name: 'Fromage' } } }),
    ]);
  });
});
