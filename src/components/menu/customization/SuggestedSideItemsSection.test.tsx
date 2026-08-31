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

    expect(screen.getByRole('heading', { name: 'suggested_side_group_beverages' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'suggested_side_group_desserts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'suggested_side_group_accompaniments' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'add_ingredient' })[0]);
    expect(onSelectionChange).toHaveBeenCalledWith([{ id: 'cola', quantity: 1 }]);
  });
});
