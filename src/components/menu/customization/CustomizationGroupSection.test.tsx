import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CustomizationGroupSection from './CustomizationGroupSection';
import type { CustomizationGroupSelection, ProductCustomizationGroup } from '@/types/menu';

const group: ProductCustomizationGroup = {
  id: 'meat',
  name: 'Viande',
  displayOrder: 1,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  includedFreeUnits: 0,
  isActive: true,
  content: {},
  ingredientOptions: [{ id: 'chicken-member', productIngredientId: 'chicken', displayOrder: 1, isDefault: false }],
  productOptions: [
    {
      id: 'kebab-member',
      optionProductId: 'kebab',
      optionProductName: 'Kebab',
      additionalPrice: 3,
      displayOrder: 2,
      isDefault: false,
    },
  ],
};

function Harness({ onChoice }: Readonly<{ onChoice: () => void }>) {
  const [selections, setSelections] = useState<CustomizationGroupSelection[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [, setQuantities] = useState<Record<string, number>>({});
  return (
    <>
      <CustomizationGroupSection
        group={group}
        groups={[group]}
        ingredients={[
          {
            id: 'chicken',
            name: 'Poulet',
            price: 0,
            isOptional: true,
            isActive: true,
            displayOrder: 1,
          },
        ]}
        selections={selections}
        onSelectionsChange={setSelections}
        onIngredientSelectionChange={setSelectedIngredients}
        onIngredientQuantityChange={(id, quantity) => setQuantities((current) => ({ ...current, [id]: quantity }))}
        onChoice={onChoice}
        currentLanguage="fr"
      />
      <output data-testid="ingredients">{selectedIngredients.join(',')}</output>
      <output data-testid="payload">{JSON.stringify(selections)}</output>
    </>
  );
}

it('renders mixed targets but submits stable membership identity', () => {
  const onChoice = jest.fn();
  render(<Harness onChoice={onChoice} />);

  fireEvent.click(screen.getByRole('radio', { name: 'Poulet' }));
  expect(screen.getByTestId('ingredients')).toHaveTextContent('chicken');
  expect(screen.getByTestId('payload')).toHaveTextContent('chicken-member');
  expect(onChoice).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('radio', { name: /Kebab/ }));
  expect(screen.getByTestId('ingredients')).toBeEmptyDOMElement();
  expect(screen.getByTestId('payload')).toHaveTextContent('kebab-member');
  expect(screen.getByText('+CHF 3.00')).toBeInTheDocument();
});
