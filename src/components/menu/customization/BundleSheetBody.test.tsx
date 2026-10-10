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

/** The first option carries ingredients of its own; the second carries nothing further. */
const section = (maxSelection: number): MenuSection => ({
  id: 'main',
  name: 'Choose a main',
  displayOrder: 1,
  isRequired: true,
  minSelection: 1,
  maxSelection,
  items: [
    {
      id: 'si-burger',
      productId: 'burger',
      productName: 'Burger',
      additionalPrice: 4,
      displayOrder: 1,
      isDefault: false,
      detailedIngredients: [cheese],
    },
    { id: 'si-wrap', productId: 'wrap', productName: 'Wrap', additionalPrice: 0, displayOrder: 2, isDefault: false },
  ],
});

const controller = (over: Partial<BundleSheetController> = {}) =>
  ({
    kind: 'bundle',
    selectedOptions: [],
    visibleErrors: [],
    expandedOptionKey: null,
    currentLanguage: 'en',
    toggleOption: jest.fn(),
    toggleOptionExpanded: jest.fn(),
    setOptionCustomization: jest.fn(),
    beginOptionTourAt: jest.fn(),
    ...over,
  }) as unknown as BundleSheetController;

/**
 * Every bundle, including legacy bundles without a saved customerStepManifest, uses the same
 * mixed step planner. A single-choice pick advances to the next planned screen; a multi-select
 * section stays open until Continue so the guest can choose multiple rows.
 */
describe('BundleSheetBody — legacy and configured bundles use the mixed flow', () => {
  it('advances a single-choice pick into the next planned screen without opening a separate tour', () => {
    const onChoice = jest.fn();
    const sheet = controller();
    const step = buildBundleSteps([section(1)])[0];
    render(
      <BundleSheetBody controller={sheet} step={step} onChoice={onChoice} plannedSteps={[step]} onJump={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /Burger/ }));

    expect(sheet.beginOptionTourAt).not.toHaveBeenCalled();
    expect(onChoice).toHaveBeenCalledTimes(1);
  });

  it('keeps the guest on the rows of a multi-select section — the walk starts at Continue', () => {
    const onChoice = jest.fn();
    const sheet = controller();
    const step = buildBundleSteps([section(2)])[0];
    render(
      <BundleSheetBody controller={sheet} step={step} onChoice={onChoice} plannedSteps={[step]} onJump={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Burger/ }));

    expect(sheet.toggleOption).toHaveBeenCalledTimes(1);
    expect(sheet.beginOptionTourAt).not.toHaveBeenCalled();
    expect(onChoice).not.toHaveBeenCalled();
  });

  it('advances a simple radio choice but leaves multi-select sections open for more choices', () => {
    const onChoice = jest.fn();
    const single = buildBundleSteps([section(1)])[0];
    const { rerender } = render(
      <BundleSheetBody
        controller={controller()}
        step={single}
        onChoice={onChoice}
        plannedSteps={[single]}
        onJump={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /Wrap/ }));
    expect(onChoice).toHaveBeenCalledTimes(1);

    const multi = buildBundleSteps([section(2)])[0];
    rerender(
      <BundleSheetBody
        controller={controller()}
        step={multi}
        onChoice={onChoice}
        plannedSteps={[multi]}
        onJump={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Wrap/ }));
    expect(onChoice).toHaveBeenCalledTimes(1);
  });

  it('treats a re-pick of the selected radio as a no-op — no re-open, no advance', () => {
    const onChoice = jest.fn();
    const sheet = controller({
      selectedOptions: [{ sectionId: 'main', itemId: 'burger', quantity: 1 }],
    });
    const step = buildBundleSteps([section(1)])[0];
    render(
      <BundleSheetBody controller={sheet} step={step} onChoice={onChoice} plannedSteps={[step]} onJump={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /Burger/ }));

    expect(sheet.beginOptionTourAt).not.toHaveBeenCalled();
    expect(onChoice).not.toHaveBeenCalled();
  });

  it('still toggles the option either way — the rule is about NAVIGATING, not selecting', () => {
    const sheet = controller();
    const step = buildBundleSteps([section(1)])[0];
    render(
      <BundleSheetBody controller={sheet} step={step} onChoice={jest.fn()} plannedSteps={[step]} onJump={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /Burger/ }));
    expect(sheet.toggleOption).toHaveBeenCalledTimes(1);
  });

  it('routes Customize to that selected component’s first screen in the shared plan', () => {
    const selectedOptions = [{ sectionId: 'main', itemId: 'burger', menuSectionItemId: 'si-burger', quantity: 1 }];
    const sheet = controller({ selectedOptions });
    const sectionStep = buildBundleSteps([section(1)])[0];
    const componentStep = {
      id: 'component:si-burger',
      kind: 'ingredients',
      titleKey: 'customize_ingredients',
      singleChoice: false,
      isRequired: false,
      sectionItemId: 'si-burger',
      parentStepId: sectionStep.id,
    } as const;
    const onJump = jest.fn();
    render(
      <BundleSheetBody
        controller={sheet}
        step={sectionStep}
        onChoice={jest.fn()}
        plannedSteps={[sectionStep, componentStep]}
        onJump={onJump}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /customer_cta_customize_item/ }));

    expect(onJump).toHaveBeenCalledWith(componentStep);
  });
});
