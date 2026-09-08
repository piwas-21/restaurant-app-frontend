import '@testing-library/jest-dom';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BundleSectionSelector from './BundleSectionSelector';
import { updateBundleOption } from '@/utils/bundleSelection';
import type { DetailedIngredient, MenuSection, SelectedMenuOption } from '@/types/menu';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const sauce = (id: string, extra: Partial<DetailedIngredient> = {}): DetailedIngredient => ({
  id,
  name: id,
  kind: 'sauce',
  price: 0,
  isOptional: true,
  isIncludedInBasePrice: false,
  isActive: true,
  displayOrder: 1,
  maxQuantity: 1,
  ...extra,
});
const ingredients = [
  sauce('salsa'),
  sauce('mayo'),
  sauce('stored-none', { isNoneOption: true }),
  sauce('cheese', { kind: 'ingredient' }),
];

function StatefulBundle({ max, initial }: { max: number; initial: SelectedMenuOption }) {
  const [selectedOptions, setSelectedOptions] = useState([initial]);
  const section: MenuSection = {
    id: 'main',
    name: 'Main',
    displayOrder: 1,
    isRequired: true,
    minSelection: 1,
    maxSelection: 1,
    items: [
      {
        id: 'item',
        productId: 'burger',
        productName: 'Burger',
        additionalPrice: 0,
        displayOrder: 1,
        isDefault: true,
        detailedIngredients: ingredients,
        sauceMin: 0,
        sauceMax: max,
        sauceIncludedFree: 0,
      },
    ],
  };
  return (
    <>
      <BundleSectionSelector
        section={section}
        selectedOptions={selectedOptions}
        expandedOptionKey="main::burger"
        currentLanguage="en"
        onToggleOption={() => undefined}
        onToggleExpanded={() => undefined}
        onCustomizationChange={(sectionId, itemId, patch) =>
          setSelectedOptions((previous) => updateBundleOption(previous, sectionId, itemId, patch))
        }
      />
      <output aria-label="bundle state">{JSON.stringify(selectedOptions[0])}</output>
    </>
  );
}

function openBundle(max: number, selected: string[]) {
  render(
    <StatefulBundle
      max={max}
      initial={{
        sectionId: 'main',
        itemId: 'burger',
        quantity: 1,
        selectedIngredients: ['cheese', ...selected],
        ingredientQuantities: { cheese: 2, ...Object.fromEntries(selected.map((id) => [id, 1])) },
        specialInstructions: 'Keep separate',
      }}
    />,
  );
  // The sauce group renders EXPANDED in the option panel since the parity change (partner
  // feedback, mcdoner) — no disclosure header to open, the rows are on screen immediately.
}

function expectState(selected: string[], quantities: Record<string, number>) {
  expect(JSON.parse(screen.getByRole('status', { name: 'bundle state' }).textContent ?? '')).toEqual({
    sectionId: 'main',
    itemId: 'burger',
    quantity: 1,
    selectedIngredients: ['cheese', ...selected],
    ingredientQuantities: { cheese: 2, ...quantities },
    specialInstructions: 'Keep separate',
  });
}

describe('Bundle sauce quantity composition — real state, not callback spies', () => {
  it('keeps the replaced radio sauce at zero when the new sauce is selected in the same event', () => {
    openBundle(1, ['salsa']);
    fireEvent.click(screen.getByRole('radio', { name: 'mayo sauce_max_reached' }));
    expectState(['mayo'], { salsa: 0, mayo: 1 });
  });

  it('keeps every zero when the synthetic no-sauce answer clears several rows', () => {
    openBundle(3, ['salsa', 'mayo']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'sauce_none' }));
    // Zeroes exactly the rows it REMOVES — the selected ones. The unselected stored-none copy
    // never claimed a unit, so no explicit 0 of it goes into the payload (the same rule the
    // stored isNoneOption answer follows; the two "no sauce" answers now agree).
    expectState([], { salsa: 0, mayo: 0 });
  });

  it('composes stored isNoneOption selection and clearing in both directions', () => {
    openBundle(3, ['salsa', 'mayo']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'stored-none' }));
    expectState(['stored-none'], { salsa: 0, mayo: 0, 'stored-none': 1 });
    fireEvent.click(screen.getByRole('checkbox', { name: 'salsa' }));
    expectState(['salsa'], { salsa: 1, mayo: 0, 'stored-none': 0 });
  });
});
