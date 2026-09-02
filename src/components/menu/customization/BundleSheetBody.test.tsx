import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import BundleSheetBody, { type BundleSheetController } from './BundleSheetBody';
import { buildBundleSteps } from '@/utils/customizationSteps';
import type { MenuSection } from '@/types/menu';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key) }),
}));

const cheese = {
  id: 'cheese',
  name: 'Extra cheese',
  price: 2,
  isOptional: true,
  isActive: true,
  isIncludedInBasePrice: false,
  maxQuantity: 1,
  displayOrder: 1,
};

/** Single-select, and the first option carries ingredients of its own. */
const section = (withIngredients: boolean): MenuSection => ({
  id: 'main',
  name: 'Choose a main',
  displayOrder: 1,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  items: [
    {
      id: 'si-burger',
      productId: 'burger',
      productName: 'Burger',
      additionalPrice: 4,
      displayOrder: 1,
      isDefault: false,
      detailedIngredients: withIngredients ? [cheese] : [],
    },
    { id: 'si-wrap', productId: 'wrap', productName: 'Wrap', additionalPrice: 0, displayOrder: 2, isDefault: false },
  ],
});

const controller = () =>
  ({
    kind: 'bundle',
    selectedOptions: [],
    visibleErrors: [],
    expandedOptionKey: null,
    currentLanguage: 'en',
    toggleOption: jest.fn(),
    toggleOptionExpanded: jest.fn(),
    setOptionCustomization: jest.fn(),
  }) as unknown as BundleSheetController;

/**
 * The auto-advance rule at the point where it can HURT.
 *
 * `BundleOptionRow` shows its "Customize" disclosure only once the option is selected — so on a
 * single-select section, picking an option that has ingredients and then sliding to the next step
 * 260 ms later carries the guest past a control that had just appeared, with no way to reach it on
 * the forward pass.
 */
describe('BundleSheetBody — auto-advance must not slide past a drill-in', () => {
  const pick = (name: RegExp) => fireEvent.click(screen.getByRole('radio', { name }));

  it('does NOT announce a choice when the picked option has its own ingredients', () => {
    const onChoice = jest.fn();
    const step = buildBundleSteps([section(true)])[0];
    render(<BundleSheetBody controller={controller()} step={step} onChoice={onChoice} />);

    pick(/Burger/);
    expect(onChoice).not.toHaveBeenCalled();
  });

  it('announces it for an option with nothing further to configure', () => {
    const onChoice = jest.fn();
    const step = buildBundleSteps([section(true)])[0];
    render(<BundleSheetBody controller={controller()} step={step} onChoice={onChoice} />);

    pick(/Wrap/);
    expect(onChoice).toHaveBeenCalledTimes(1);
  });

  it('still toggles the option either way — the rule is about ADVANCING, not selecting', () => {
    const sheet = controller();
    const step = buildBundleSteps([section(true)])[0];
    render(<BundleSheetBody controller={sheet} step={step} onChoice={jest.fn()} />);

    pick(/Burger/);
    expect(sheet.toggleOption).toHaveBeenCalledTimes(1);
  });
});
