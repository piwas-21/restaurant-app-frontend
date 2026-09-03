import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import SuggestedSideItemsSection from './SuggestedSideItemsSection';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const sideItems = [
  { id: 'cola', name: 'Cola', price: 2, isRequired: false, displayOrder: 1, type: 'beverage' as const },
  { id: 'baklava', name: 'Baklava', price: 3, isRequired: false, displayOrder: 2, type: 'dessert' as const },
  { id: 'fries', name: 'Fries', price: 2.5, isRequired: false, displayOrder: 3, type: 'sideItem' as const },
];

describe('SuggestedSideItemsSection', () => {
  it('partitions typed sides under localized headings without changing the selection payload', () => {
    const onSelectionChange = jest.fn();
    render(
      <SuggestedSideItemsSection
        sideItems={sideItems}
        selectedSideItems={[]}
        onSelectionChange={onSelectionChange}
        currentLanguage="fr"
      />,
    );

    const beverages = screen.getByRole('button', { name: /suggested_side_group_beverages/i });
    expect(screen.getByRole('heading', { name: /suggested_side_group_beverages/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /suggested_side_group_desserts/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /suggested_side_group_accompaniments/ })).toBeInTheDocument();
    expect(beverages).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'add_ingredient' })).not.toBeInTheDocument();

    fireEvent.click(beverages);
    expect(beverages).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'add_ingredient' }));
    expect(onSelectionChange).toHaveBeenCalledWith([{ id: 'cola', quantity: 1 }]);
  });

  it('starts a group with a required preselection open, preserving the visible selection and payload', () => {
    const onSelectionChange = jest.fn();
    const requiredDrink = { ...sideItems[0], isRequired: true };
    render(
      <SuggestedSideItemsSection
        sideItems={[requiredDrink, ...sideItems.slice(1)]}
        selectedSideItems={[{ id: 'cola', quantity: 2 }]}
        onSelectionChange={onSelectionChange}
        currentLanguage="fr"
      />,
    );

    const beverages = screen.getByRole('button', { name: /suggested_side_group_beverages/i });
    expect(beverages).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Cola')).toBeInTheDocument();
    expect(screen.getByLabelText('required')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'increase_quantity' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /suggested_side_group_desserts/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: 'increase_quantity' }));
    expect(onSelectionChange).toHaveBeenCalledWith([{ id: 'cola', quantity: 3 }]);
  });

  /**
   * The guided flow gives each partition its own step, so a step renders its own group and nothing
   * else. Without the filter every side step drew all three and the split changed only the count —
   * the guest would still have scrolled past the desserts, one screen later.
   */
  it('renders only the asked-for partition', () => {
    render(
      <SuggestedSideItemsSection
        sideItems={sideItems}
        selectedSideItems={[]}
        onSelectionChange={jest.fn()}
        currentLanguage="en"
        variant="plain"
        onlyGroup="desserts"
      />,
    );

    expect(screen.getByRole('heading', { name: /suggested_side_group_desserts/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /suggested_side_group_beverages/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /suggested_side_group_accompaniments/ })).not.toBeInTheDocument();
    expect(screen.getByText('Baklava')).toBeInTheDocument();
    expect(screen.queryByText('Cola')).not.toBeInTheDocument();
  });

  it('renders every partition when none is named — the scrolling sheet is unchanged', () => {
    render(
      <SuggestedSideItemsSection
        sideItems={sideItems}
        selectedSideItems={[]}
        onSelectionChange={jest.fn()}
        currentLanguage="en"
        variant="plain"
      />,
    );

    expect(screen.getByText('Cola')).toBeInTheDocument();
    expect(screen.getByText('Baklava')).toBeInTheDocument();
    expect(screen.getByText('Fries')).toBeInTheDocument();
  });

  /**
   * `bare` is `plain` minus the heading. The guided flow's step panel already titles the screen
   * ("Add a dessert"), so the group's own <h3> under it was the same thing said twice — but the
   * ROWS must still be there, which is what makes this more than an assertion about a missing node.
   */
  it('drops its own heading in the bare variant, keeping the rows', () => {
    render(
      <SuggestedSideItemsSection
        sideItems={sideItems}
        selectedSideItems={[]}
        onSelectionChange={jest.fn()}
        currentLanguage="en"
        variant="bare"
        onlyGroup="desserts"
      />,
    );

    expect(screen.queryByRole('heading', { name: /suggested_side_group_desserts/ })).not.toBeInTheDocument();
    expect(screen.getByText('Baklava')).toBeInTheDocument();
  });

  /**
   * The degenerate case `bare` would make worse. A `sides` step that carried no `sideGroup` would
   * render all three partitions — and, under `bare`, all three with NO heading: three unlabelled
   * lists back to back, silently, in the visual tree and the accessibility tree alike.
   * `ProductSheetBody` derives the variant from the same field, so the fallback is develop's own
   * screen rather than something new; this pins the shape that fallback renders.
   */
  it('names every partition when it is asked for all of them', () => {
    render(
      <SuggestedSideItemsSection
        sideItems={sideItems}
        selectedSideItems={[]}
        onSelectionChange={jest.fn()}
        currentLanguage="en"
        variant="plain"
      />,
    );

    expect(screen.getByRole('heading', { name: /suggested_side_group_beverages/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /suggested_side_group_desserts/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /suggested_side_group_accompaniments/ })).toBeInTheDocument();
  });
});
