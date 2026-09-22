import { render, screen } from '@testing-library/react';
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
      favoriteIds={[]}
      showFavorites={false}
      onShowFavorites={jest.fn()}
      onToggleFavorite={jest.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'server.round.unavailable_item:Delivery only dish' })).toBeDisabled();
  expect(screen.getByText('server.round.unavailable_for_dine_in')).toBeInTheDocument();
});
