import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CustomizationGroupSection from './CustomizationGroupSection';
import type { CustomizationGroupSelection, ProductCustomizationGroup } from '@/types/menu';
import { OrderType } from '@/types/order';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg?: unknown) => {
      if (typeof arg === 'string') return arg;
      if (arg && typeof arg === 'object') {
        return `${key}(${Object.entries(arg)
          .map(([name, value]) => `${name}=${value}`)
          .join(',')})`;
      }
      return key;
    },
  }),
}));
jest.mock('@/hooks/checkout/useEnabledOrderTypes', () => ({
  useEnabledOrderTypes: () => ({ enabled: ['DineIn', 'Takeaway'], loading: false }),
}));

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

function Harness({
  onChoice,
  customizationGroup = group,
  initialSelections = [],
}: Readonly<{
  onChoice: () => void;
  customizationGroup?: ProductCustomizationGroup;
  initialSelections?: CustomizationGroupSelection[];
}>) {
  const [selections, setSelections] = useState<CustomizationGroupSelection[]>(initialSelections);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [, setQuantities] = useState<Record<string, number>>({});
  return (
    <>
      <CustomizationGroupSection
        group={customizationGroup}
        groups={[customizationGroup]}
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

it('disables unavailable product targets, displays the reason and clears stale selections on replacement', () => {
  const unavailableGroup: ProductCustomizationGroup = {
    ...group,
    productOptions: [
      {
        ...group.productOptions[0],
        optionProductIsActive: false,
        optionProductIsAvailable: false,
        availability: { canOrder: false, reason: 'Unavailable', allowedOrderTypes: [] },
      },
    ],
  };
  const onChoice = jest.fn();
  render(
    <Harness
      onChoice={onChoice}
      customizationGroup={unavailableGroup}
      initialSelections={[{ groupId: group.id, options: [{ kind: 1, optionId: 'kebab-member', quantity: 1 }] }]}
    />,
  );

  const unavailableChoice = screen.getByRole('radio', { name: /Kebab.*Unavailable/ });
  expect(unavailableChoice).toBeDisabled();
  expect(unavailableChoice).not.toBeChecked();
  expect(screen.getByText('Unavailable')).toBeInTheDocument();
  fireEvent.click(unavailableChoice);
  expect(screen.getByTestId('payload')).toHaveTextContent('kebab-member');

  fireEvent.click(screen.getByRole('radio', { name: 'Poulet' }));
  expect(screen.getByTestId('payload')).toHaveTextContent('chicken-member');
  expect(screen.getByTestId('payload')).not.toHaveTextContent('kebab-member');
  expect(onChoice).toHaveBeenCalledTimes(1);
});

it('disables a wrong-channel product target and names only restaurant-enabled channels', () => {
  const wrongChannelGroup: ProductCustomizationGroup = {
    ...group,
    productOptions: [
      {
        ...group.productOptions[0],
        optionProductIsActive: true,
        optionProductIsAvailable: true,
        availability: {
          canOrder: false,
          reason: 'WrongOrderType',
          allowedOrderTypes: [OrderType.Takeaway],
        },
      },
    ],
  };

  render(<Harness onChoice={jest.fn()} customizationGroup={wrongChannelGroup} />);

  const blockedChoice = screen.getByRole('radio', { name: /Kebab.*availability_only_for/ });
  expect(blockedChoice).toBeDisabled();
  expect(screen.getByText('availability_only_for(orderTypes=Takeaway)')).toBeInTheDocument();
});

it('keeps a channel-limited product target selectable when no channel-specific block was returned', () => {
  const browseGroup: ProductCustomizationGroup = {
    ...group,
    productOptions: [
      {
        ...group.productOptions[0],
        optionProductIsActive: true,
        optionProductIsAvailable: true,
        availability: {
          canOrder: true,
          reason: 'Available',
          allowedOrderTypes: [OrderType.Takeaway],
        },
      },
    ],
  };

  render(<Harness onChoice={jest.fn()} customizationGroup={browseGroup} />);

  expect(screen.getByRole('radio', { name: /Kebab/ })).toBeEnabled();
});
