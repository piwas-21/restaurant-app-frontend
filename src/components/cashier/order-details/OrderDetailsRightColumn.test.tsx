import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import OrderDetailsRightColumn from './OrderDetailsRightColumn';
import {
  makeOrder,
  makeOrderItem,
  singleKitchenBundleOrder,
  mixedKitchenBundleOrder,
} from '@/utils/__fixtures__/bundleOrderFixture';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

const mockExportKitchenItemsToPDF = jest.fn();
jest.mock('@/utils/pdfExportUtils', () => ({
  exportOrderToPDF: jest.fn(),
  exportKitchenItemsToPDF: (...args: unknown[]) => mockExportKitchenItemsToPDF(...args),
}));

beforeEach(() => mockExportKitchenItemsToPDF.mockClear());

describe('OrderDetailsRightColumn — kitchen print buttons', () => {
  it('offers only the front-kitchen button for a single-kitchen bundle', () => {
    render(<OrderDetailsRightColumn order={singleKitchenBundleOrder()} />);

    expect(screen.getByRole('button', { name: /Front Kitchen/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back Kitchen/ })).not.toBeInTheDocument();
  });

  it('offers BOTH buttons when the only back-kitchen item is nested in a front-kitchen bundle', () => {
    // The #237 regression: no top-level item is BackKitchen, so a top-level-only check hid this.
    render(<OrderDetailsRightColumn order={mixedKitchenBundleOrder()} />);

    expect(screen.getByRole('button', { name: /Front Kitchen/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back Kitchen/ })).toBeInTheDocument();
  });

  it('prints the requested kitchen', () => {
    const order = mixedKitchenBundleOrder();
    render(<OrderDetailsRightColumn order={order} />);

    fireEvent.click(screen.getByRole('button', { name: /Back Kitchen/ }));

    expect(mockExportKitchenItemsToPDF).toHaveBeenCalledWith(order, 'BackKitchen', expect.anything());
  });

  it('offers neither button when nothing routes to a kitchen', () => {
    const order = makeOrder([makeOrderItem({ id: 'water', productName: 'Still Water', kitchenType: 'None' })]);
    render(<OrderDetailsRightColumn order={order} />);

    expect(screen.queryByRole('button', { name: /Front Kitchen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back Kitchen/ })).not.toBeInTheDocument();
  });
});
