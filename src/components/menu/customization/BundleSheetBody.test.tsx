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
 * The guided walk at the point where it starts (partner feedback 2026-09): the primary path into
 * an option's screens is the PICK itself — a single-choice section opens the screens the moment
 * the row is chosen; a multi-select section waits for the guest to finish selecting. The row's
 * Customize affordance is the way BACK into a visited option, never the way in.
 */
describe('BundleSheetBody — the pick opens the option’s guided screens', () => {
  it('opens the guided screen for a single-choice pick with its own ingredients', () => {
    const onChoice = jest.fn();
    const sheet = controller();
    const step = buildBundleSteps([section(1)])[0];
    render(<BundleSheetBody controller={sheet} step={step} onChoice={onChoice} />);

    fireEvent.click(screen.getByRole('radio', { name: /Burger/ }));

    // The section step does NOT announce a choice — the option screen takes over from here, and
    // the section advances when that screen's Done ends the walk.
    expect(sheet.beginOptionTourAt).toHaveBeenCalledWith('main', 'burger');
    expect(onChoice).not.toHaveBeenCalled();
  });

  it('keeps the guest on the rows of a multi-select section — the walk starts at Continue', () => {
    const onChoice = jest.fn();
    const sheet = controller();
    const step = buildBundleSteps([section(2)])[0];
    render(<BundleSheetBody controller={sheet} step={step} onChoice={onChoice} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Burger/ }));

    expect(sheet.toggleOption).toHaveBeenCalledTimes(1);
    expect(sheet.beginOptionTourAt).not.toHaveBeenCalled();
    expect(onChoice).not.toHaveBeenCalled();
  });

  it('announces an option with nothing further to configure, single- or multi-choice', () => {
    const onChoice = jest.fn();
    const single = buildBundleSteps([section(1)])[0];
    const { rerender } = render(<BundleSheetBody controller={controller()} step={single} onChoice={onChoice} />);
    fireEvent.click(screen.getByRole('radio', { name: /Wrap/ }));
    expect(onChoice).toHaveBeenCalledTimes(1);

    const multi = buildBundleSteps([section(2)])[0];
    rerender(<BundleSheetBody controller={controller()} step={multi} onChoice={onChoice} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Wrap/ }));
    expect(onChoice).toHaveBeenCalledTimes(2);
  });

  it('treats a re-pick of the selected radio as a no-op — no re-open, no advance', () => {
    const onChoice = jest.fn();
    const sheet = controller({
      selectedOptions: [{ sectionId: 'main', itemId: 'burger', quantity: 1 }],
    });
    const step = buildBundleSteps([section(1)])[0];
    render(<BundleSheetBody controller={sheet} step={step} onChoice={onChoice} />);

    fireEvent.click(screen.getByRole('radio', { name: /Burger/ }));

    expect(sheet.beginOptionTourAt).not.toHaveBeenCalled();
    expect(onChoice).not.toHaveBeenCalled();
  });

  it('still toggles the option either way — the rule is about NAVIGATING, not selecting', () => {
    const sheet = controller();
    const step = buildBundleSteps([section(1)])[0];
    render(<BundleSheetBody controller={sheet} step={step} onChoice={jest.fn()} />);

    fireEvent.click(screen.getByRole('radio', { name: /Burger/ }));
    expect(sheet.toggleOption).toHaveBeenCalledTimes(1);
  });
});
