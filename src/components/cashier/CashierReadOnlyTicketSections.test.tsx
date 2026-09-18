import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import type { OrderItemDto } from '@/types/order';
import { TicketItems } from './CashierReadOnlyTicketSections';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const t = ((key: string) => key) as unknown as TFunction;

function item(overrides: Partial<OrderItemDto> = {}): OrderItemDto {
  return {
    id: 'root',
    productId: 'product',
    quantity: 1,
    unitPrice: 20,
    itemTotal: 20,
    productName: 'Menu',
    ingredientCustomizations: [
      { ingredientId: 'onion', ingredientName: 'Onion', quantity: 0, isRemoved: true },
      { ingredientId: 'cheese', ingredientName: 'Cheese', quantity: 1, isRemoved: false, isAddOn: true },
    ],
    sideItems: [
      {
        id: 'child',
        productId: 'child-product',
        quantity: 1,
        unitPrice: 2,
        itemTotal: 2,
        productName: 'Fries',
        kind: 'BundleChild',
        sideItems: [
          {
            id: 'nested-child',
            productId: 'nested-product',
            quantity: 1,
            unitPrice: 1,
            itemTotal: 1,
            productName: 'Sauce',
            sideItems: [],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('TicketItems', () => {
  it('uses the shared recursive customization renderer for ingredients and children', () => {
    render(<TicketItems items={[item()]} t={t} />);

    expect(screen.getByText(/added_ingredients/)).toBeInTheDocument();
    expect(screen.getByText('Cheese')).toBeInTheDocument();
    expect(screen.getByText(/removed_ingredients/)).toBeInTheDocument();
    expect(screen.getByText('Onion')).toBeInTheDocument();
    expect(screen.getByText('Fries')).toBeInTheDocument();
    expect(screen.getByText('Sauce')).toBeInTheDocument();
  });
});
