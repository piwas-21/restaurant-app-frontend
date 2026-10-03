import { render, screen } from '@testing-library/react';
import type { DeliveryChannelCategoryCandidate } from '@/types/deliveryChannelMenuSelection';
import DeliveryChannelCategoryItems from './DeliveryChannelCategoryItems';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('keeps candidates without an active category visible but not selectable', () => {
  const item: DeliveryChannelCategoryCandidate = {
    selectionKey: 'uncategorized-product:base',
    productId: 'uncategorized-product',
    variationId: null,
    categoryId: null,
    categoryName: null,
    categoryDisplayOrder: null,
    itemDisplayOrder: 1,
    name: 'Unassigned product',
    variationName: null,
    priceMinor: 500,
    available: true,
    supported: false,
    blockReason: 'MissingCategory',
  };

  render(
    <DeliveryChannelCategoryItems
      items={[item]}
      selectedCategoryIds={new Set()}
      overrides={{}}
      currency="EUR"
      locale="en"
      disabled={false}
      onToggle={jest.fn()}
    />,
  );

  const checkbox = screen.getByTestId(`delivery-channel-menu-item-${item.selectionKey}`);
  expect(checkbox).toBeDisabled();
  expect(screen.getByText('deliveryChannels.codes.MissingCategory')).toBeInTheDocument();
});

it('uses distinct variation labels without duplicating the canonical full name', () => {
  const item = (selectionKey: string, name: string, variationName: string, supported: boolean) => ({
    selectionKey,
    productId: 'soup',
    variationId: selectionKey,
    categoryId: 'mains',
    categoryName: 'Mains',
    categoryDisplayOrder: 1,
    itemDisplayOrder: 1,
    name,
    variationName,
    priceMinor: 800,
    available: true,
    supported,
    blockReason: supported ? null : 'UnsupportedChoices',
  });

  render(
    <DeliveryChannelCategoryItems
      items={[item('small', 'Soup — Small', 'Small', true), item('large', 'Soup', 'Large', false)]}
      selectedCategoryIds={new Set()}
      overrides={{}}
      currency="EUR"
      locale="en"
      disabled={false}
      onToggle={jest.fn()}
    />,
  );

  expect(screen.getByRole('checkbox', { name: 'Soup — Small' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Soup — Large' })).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'Soup — Small — Small' })).not.toBeInTheDocument();
});
