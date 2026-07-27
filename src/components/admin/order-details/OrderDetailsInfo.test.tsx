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
