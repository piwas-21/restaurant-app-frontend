import { fireEvent, render, screen } from '@testing-library/react';
import ProductCustomizationGroupsEditor from './ProductCustomizationGroupsEditor';

jest.mock('@/hooks/admin/useCustomizationProductOptions', () => ({
  useCustomizationProductOptions: () => [{ id: 'meat-1', name: 'Kebab', basePrice: 8 }],
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ProductCustomizationGroupsEditor', () => {
  it('creates an unsaved group and keeps translated text in the active locale', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <ProductCustomizationGroupsEditor
        groups={[]}
        ingredients={[]}
        productId="tacos-1"
        currentLanguage="fr"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'add_customization_group' }));
    const [groups] = onChange.mock.calls[0];
    expect(groups[0]).not.toHaveProperty('id');

    rerender(
      <ProductCustomizationGroupsEditor
        groups={groups}
        ingredients={[]}
        productId="tacos-1"
        currentLanguage="fr"
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Viande' } });
    const updatedGroup = onChange.mock.calls.at(-1)?.[0][0];
    expect(updatedGroup.content.fr).toEqual({ name: 'Viande', description: '' });
  });

  it('adds a product choice with no surcharge by default', () => {
    const onChange = jest.fn();
    render(
      <ProductCustomizationGroupsEditor
        groups={[
          {
            name: 'Viande',
            displayOrder: 0,
            isRequired: true,
            minSelection: 1,
            maxSelection: 1,
            includedFreeUnits: 1,
            isActive: true,
            content: {},
            ingredientOptions: [],
            productOptions: [],
          },
        ]}
        ingredients={[]}
        productId="tacos-1"
        currentLanguage="fr"
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'meat-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    const added = onChange.mock.calls.at(-1)?.[0][0].productOptions[0];
    expect(added).toMatchObject({ optionProductId: 'meat-1', additionalPrice: 0 });
    expect(added).not.toHaveProperty('id');
  });
});
