import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { useTranslationsWorkbench } from './useTranslationsWorkbench';
import type { useProductEditorForm } from './useProductEditorForm';

type Editor = ReturnType<typeof useProductEditorForm>;

describe('useTranslationsWorkbench menu section writes', () => {
  const menuDefinition = {
    sections: [
      { id: 'section-1', name: 'Soup', description: 'A warm soup', translations: {} },
      { id: 'section-2', name: 'Salad', description: 'A fresh salad', translations: {} },
    ],
  };

  function setup() {
    const changeMenuDefinition = jest.fn();
    const changeIngredients = jest.fn();
    const hook = renderHook(() => {
      const form = useForm({
        defaultValues: { name: '', description: '', content: [], variations: [] },
      });
      const editor = {
        form,
        detailedIngredients: [],
        changeIngredients,
        variations: { fields: [] },
        menuDefinition,
        changeMenuDefinition,
      } as unknown as Editor;
      return useTranslationsWorkbench(editor);
    });
    return { ...hook, changeMenuDefinition };
  }

  it('writes a manually edited menu section translation while preserving other section data', () => {
    const { result, changeMenuDefinition } = setup();

    act(() => {
      result.current.setTranslation({ target: 'menuSection', index: 0, field: 'name' }, 'fr', 'Soupe');
    });

    expect(changeMenuDefinition).toHaveBeenCalledWith({
      ...menuDefinition,
      sections: [
        {
          ...menuDefinition.sections[0],
          translations: { fr: { name: 'Soupe', description: '' } },
        },
        menuDefinition.sections[1],
      ],
    });
  });

  it('copies source name and description into empty menu section translations', () => {
    const { result, changeMenuDefinition } = setup();

    act(() => {
      result.current.setTargetLocale('fr');
    });
    act(() => {
      result.current.copySourceToEmpty();
    });

    expect(changeMenuDefinition).toHaveBeenCalledWith({
      ...menuDefinition,
      sections: [
        {
          ...menuDefinition.sections[0],
          translations: { fr: { name: 'Soup', description: 'A warm soup' } },
        },
        {
          ...menuDefinition.sections[1],
          translations: { fr: { name: 'Salad', description: 'A fresh salad' } },
        },
      ],
    });
    expect(result.current.lastCopy?.filled).toBe(4);
  });
});
