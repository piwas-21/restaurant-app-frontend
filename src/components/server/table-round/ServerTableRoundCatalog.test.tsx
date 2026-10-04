import { fireEvent, render, screen } from '@testing-library/react';
import { OrderType } from '@/types/order';
import ServerTableRoundCatalog from './ServerTableRoundCatalog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) => `${key}${values?.name ? `:${values.name}` : ''}`,
  }),
}));

it('keeps a channel-blocked product visible but prevents adding it', () => {
  render(
    <ServerTableRoundCatalog
      categories={[]}
      products={[
        {
          id: 'delivery-only',
          name: 'Delivery only dish',
          basePrice: 12,
          type: 'mainItem',
          isActive: true,
          isAvailable: true,
          availability: { canOrder: false, reason: 'WrongOrderType', allowedOrderTypes: [OrderType.Delivery] },
        },
      ]}
      isLoading={false}
      error={null}
      selectedCategoryId={null}
      onSelectCategory={jest.fn()}
      searchQuery=""
      onSearchChange={jest.fn()}
      onRetry={jest.fn()}
      onTapProduct={jest.fn()}
      tapPendingId={null}
      canAddItems
      favoriteIds={[]}
      showFavorites={false}
      onShowFavorites={jest.fn()}
      onToggleFavorite={jest.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'server.round.unavailable_item:Delivery only dish' })).toBeDisabled();
  expect(screen.getByText('server.round.unavailable_for_dine_in')).toBeInTheDocument();
});

it('keeps products visible but disables adding until the active draft is ready', () => {
  const onTapProduct = jest.fn();
  render(
    <ServerTableRoundCatalog
      categories={[]}
      products={[
        {
          id: 'soup',
          name: 'Soup',
          basePrice: 8,
          type: 'mainItem',
          isActive: true,
          isAvailable: true,
          availability: { canOrder: true, reason: 'Available', allowedOrderTypes: [OrderType.DineIn] },
        },
      ]}
      isLoading={false}
      error={null}
      selectedCategoryId={null}
      onSelectCategory={jest.fn()}
      searchQuery=""
      onSearchChange={jest.fn()}
      onRetry={jest.fn()}
      onTapProduct={onTapProduct}
      tapPendingId={null}
      canAddItems={false}
      favoriteIds={[]}
      showFavorites={false}
      onShowFavorites={jest.fn()}
      onToggleFavorite={jest.fn()}
    />,
  );

  const addButton = screen.getByRole('button', { name: 'server.round.add_item:Soup' });
  expect(addButton).toBeDisabled();
  expect(screen.getByText('Soup')).toBeInTheDocument();
  fireEvent.click(addButton);
  expect(onTapProduct).not.toHaveBeenCalled();
});
