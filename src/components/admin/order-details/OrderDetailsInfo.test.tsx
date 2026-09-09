import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import OrderDetailsInfo from './OrderDetailsInfo';
import { singleKitchenBundleOrder, nestedBundleOrder } from '@/utils/__fixtures__/bundleOrderFixture';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

describe('OrderDetailsInfo — bundle components', () => {
  it('shows the components of a combo, exactly once each', () => {
    render(<OrderDetailsInfo order={singleKitchenBundleOrder()} />);

    expect(screen.getByText(/Mezze Combo/)).toBeInTheDocument();
    expect(screen.getByText(/Hummus/)).toBeInTheDocument();
    expect(screen.getByText(/Fattoush Salad/)).toBeInTheDocument();
  });

  it('reaches a component of a component', () => {
    render(<OrderDetailsInfo order={nestedBundleOrder()} />);

    expect(screen.getByText(/Mezze Selection/)).toBeInTheDocument();
    expect(screen.getByText(/Hummus/)).toBeInTheDocument();
  });

  it('counts LINES in the section heading, not components', () => {
    render(<OrderDetailsInfo order={singleKitchenBundleOrder()} />);

    expect(screen.getByText(/Order Items \(1\)/)).toBeInTheDocument();
  });

  it('shows a line note once — the surface renders it, the summary must not repeat it', () => {
    const order = singleKitchenBundleOrder();
    order.items[0].specialInstructions = 'No garlic';

    render(<OrderDetailsInfo order={order} />);

    expect(screen.getAllByText(/No garlic/)).toHaveLength(1);
  });
});

/**
 * The admin order-details item list must show the ingredients/sauces the guest chose — including a
 * paid extra at its default quantity 1, which the old qty>1-only diff hid on every order surface.
 */
describe('OrderDetailsInfo — chosen ingredients', () => {
  it('renders a chosen sauce at quantity 1 and hides the plain base recipe', () => {
    const order = singleKitchenBundleOrder();
    order.items = [
      {
        id: 'item-1',
        productId: 'p-1',
        productName: 'Kebab Plate',
        quantity: 1,
        unitPrice: 18,
        itemTotal: 18,
        ingredientCustomizations: [
          { ingredientId: 'i1', ingredientName: 'Dough', quantity: 1, isRemoved: false },
          { ingredientId: 'i2', ingredientName: 'Garlic Sauce', quantity: 1, isRemoved: false, isAddOn: true },
          { ingredientId: 'i3', ingredientName: 'Onion', quantity: 0, isRemoved: true },
        ],
      },
    ];

    render(<OrderDetailsInfo order={order} />);

    expect(screen.getByText('Garlic Sauce')).toBeInTheDocument();
    expect(screen.getByText(/Added/)).toBeInTheDocument();
    expect(screen.getByText('Onion')).toBeInTheDocument();
    expect(screen.getByText(/Removed/)).toBeInTheDocument();
    expect(screen.queryByText('Dough')).not.toBeInTheDocument();
  });
});
