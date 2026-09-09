import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ItemCustomizationSheet from '@/components/menu/ItemCustomizationSheet';
import { useBundleCustomizationSheet } from '@/hooks/menu/useBundleCustomizationSheet';
import type { DetailedIngredient, MenuBundleItem, MenuSection } from '@/types/menu';

/**
 * Bundle sauce quantity composition through the REAL sheet and the REAL per-option screen — real
 * state, not callback spies. These behaviors used to be pinned against the inline drill-in
 * (`BundleOptionRow`'s panel); since the 2026-09 owner decision the guest customizes a selected
 * option on the guided screen (`BundleOptionCustomizationScreen`), so that is what must be driven:
 * the same sauce composition rules, one navigation deeper.
 *
 * The sauce group renders as its OWN step now (the same machinery the product flow runs), so each
 * case taps Customize, walks to the sauces step, and asserts the stored bundle state.
 */

jest.mock('@/components/cart/CartContext', () => ({ useCart: () => ({ addItem: jest.fn() }) }));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));
jest.mock('@/hooks/menu/useItemAvailabilityNotice', () => ({
  useItemAvailabilityNotice: jest.fn(() => null),
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
      sauceMax: 1,
      sauceIncludedFree: 0,
    },
  ],
};

const BUNDLE: MenuBundleItem = {
  id: 'combo',
  name: 'Combo',
  content: { en: { name: 'Combo', description: '' } },
  basePrice: 10,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  displayOrder: 1,
  menuDefinition: {
    id: 'md',
    isAlwaysAvailable: true,
    availableMonday: true,
    availableTuesday: true,
    availableWednesday: true,
    availableThursday: true,
    availableFriday: true,
    availableSaturday: true,
    availableSunday: true,
    sections: [section],
  },
};

function Harness({ bundle, initial }: { bundle: MenuBundleItem; initial: Record<string, unknown> }) {
  const controller = useBundleCustomizationSheet();
  // Seed the option's stored customization directly — the fixture stands in for the state a
  // previous visit had committed, which is what the composition rules must survive.
  (Harness as unknown as { seed: () => void }).seed = () => {
    controller.openForBundle(bundle);
    controller.setOptionCustomization('main', 'burger', initial as never);
  };
  return (
    <>
      <ItemCustomizationSheet controller={controller} />
      {/* The state probe: the STORED bundle option, serialized — the composition rules are about
          what the line carries, and the screen's rows can say yes while the payload says no. */}
      <output aria-label="bundle state">{JSON.stringify(controller.selectedOptions[0])}</output>
    </>
  );
}

/** Open the sheet, then the option's screen, then its sauces step. */
async function openSaucesStep(max: number, selected: string[]) {
  const bundle: MenuBundleItem = {
    ...BUNDLE,
    menuDefinition: {
      ...BUNDLE.menuDefinition,
      sections: [{ ...section, items: [{ ...section.items[0], sauceMax: max }] }],
    },
  };
  render(
    <Harness
      bundle={bundle}
      initial={{
        selectedIngredients: ['cheese', ...selected],
        ingredientQuantities: { cheese: 2, ...Object.fromEntries(selected.map((id) => [id, 1])) },
        specialInstructions: 'Keep separate',
      }}
    />,
  );
  await act(async () => {
    (Harness as unknown as { seed: () => void }).seed();
  });
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

  // The guided screen: Customize → the ingredients step → Continue to the sauces step.
  fireEvent.click(screen.getByRole('button', { name: 'customize' }));
  await waitFor(() => expect(screen.getByText('customize_ingredients')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /step_continue/ }));
  await waitFor(() => expect(screen.getByText('sauces')).toBeInTheDocument());
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

describe('Bundle sauce quantity composition through the guided option screen — real state', () => {
  it('keeps the replaced radio sauce at zero when the new sauce is selected in the same event', async () => {
    await openSaucesStep(1, ['salsa']);
    fireEvent.click(screen.getByRole('radio', { name: /mayo/ }));
    expectState(['mayo'], { salsa: 0, mayo: 1 });
  });

  it('keeps every zero when the synthetic no-sauce answer clears several rows', async () => {
    await openSaucesStep(3, ['salsa', 'mayo']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'sauce_none' }));
    // Zeroes exactly the rows it REMOVES — the selected ones. The unselected stored-none copy
    // never claimed a unit, so no explicit 0 of it goes into the payload (the same rule the
    // stored isNoneOption answer follows; the two "no sauce" answers now agree).
    expectState([], { salsa: 0, mayo: 0 });
  });

  it('composes stored isNoneOption selection and clearing in both directions', async () => {
    await openSaucesStep(3, ['salsa', 'mayo']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'stored-none' }));
    expectState(['stored-none'], { salsa: 0, mayo: 0, 'stored-none': 1 });
    fireEvent.click(screen.getByRole('checkbox', { name: 'salsa' }));
    expectState(['salsa'], { salsa: 1, mayo: 0, 'stored-none': 0 });
  });
});
