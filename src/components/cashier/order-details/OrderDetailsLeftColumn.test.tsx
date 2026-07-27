import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import OrderDetailsLeftColumn from './OrderDetailsLeftColumn';
import { singleKitchenBundleOrder, nestedBundleOrder } from '@/utils/__fixtures__/bundleOrderFixture';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

describe('OrderDetailsLeftColumn — bundle components', () => {
  it('shows the components of a combo, exactly once each', () => {
    render(<OrderDetailsLeftColumn order={singleKitchenBundleOrder()} />);

    expect(screen.getByText(/Mezze Combo/)).toBeInTheDocument();
    expect(screen.getByText(/Hummus/)).toBeInTheDocument();
    expect(screen.getByText(/Fattoush Salad/)).toBeInTheDocument();
  });

  it('reaches a component of a component', () => {
    render(<OrderDetailsLeftColumn order={nestedBundleOrder()} />);

    expect(screen.getByText(/Mezze Selection/)).toBeInTheDocument();
    expect(screen.getByText(/Hummus/)).toBeInTheDocument();
  });

  it('shows a line note once — the surface renders it, the summary must not repeat it', () => {
    const order = singleKitchenBundleOrder();
    order.items[0].specialInstructions = 'No garlic';

    render(<OrderDetailsLeftColumn order={order} />);

    expect(screen.getAllByText(/No garlic/)).toHaveLength(1);
  });
});
