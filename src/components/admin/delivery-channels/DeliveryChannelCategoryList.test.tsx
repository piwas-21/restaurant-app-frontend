import { render, screen } from '@testing-library/react';
import DeliveryChannelCategoryList from './DeliveryChannelCategoryList';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('sets the native checkbox indeterminate property for a partially selected category', () => {
  render(
    <DeliveryChannelCategoryList
      categories={[
        {
          categoryId: 'mains',
          name: 'Mains',
          displayOrder: 1,
          totalItemCount: 3,
          supportedItemCount: 3,
          unsupportedItemCount: 0,
        },
      ]}
      selectedCategoryIds={new Set(['mains'])}
      overrides={{
        'meal-3::': {
          selectionKey: 'meal-3::',
          productId: 'meal-3',
          variationId: null,
          categoryId: 'mains',
          selected: false,
          supported: true,
        },
      }}
      disabled={false}
      onToggle={jest.fn()}
    />,
  );

  const checkbox = screen.getByTestId('delivery-channel-category-mains') as HTMLInputElement;
  expect(checkbox.checked).toBe(false);
  expect(checkbox.indeterminate).toBe(true);
  expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
});
