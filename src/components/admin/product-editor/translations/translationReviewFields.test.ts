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
});
