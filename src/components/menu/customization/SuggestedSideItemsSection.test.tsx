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
});
