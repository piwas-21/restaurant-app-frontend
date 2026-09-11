import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import OrderDetailsRightColumn from './OrderDetailsRightColumn';
import {
  makeOrder,
  makeOrderItem,
  allUnassignedOrder,
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
  it('offers General and only the front-kitchen station for a single-kitchen bundle', () => {
    render(<OrderDetailsRightColumn order={singleKitchenBundleOrder()} />);

    expect(screen.getByRole('button', { name: /General Kitchen/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Front Kitchen/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back Kitchen/ })).not.toBeInTheDocument();
  });

  it('offers General and BOTH station buttons when back work is nested in a front-kitchen bundle', () => {
    // The #237 regression: no top-level item is BackKitchen, so a top-level-only check hid this.
    render(<OrderDetailsRightColumn order={mixedKitchenBundleOrder()} />);

    expect(screen.getByRole('button', { name: /General Kitchen/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Front Kitchen/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back Kitchen/ })).toBeInTheDocument();
  });

  it('prints the requested kitchen', () => {
    const order = mixedKitchenBundleOrder();
    render(<OrderDetailsRightColumn order={order} />);

    fireEvent.click(screen.getByRole('button', { name: /Back Kitchen/ }));

    expect(mockExportKitchenItemsToPDF).toHaveBeenCalledWith(order, 'BackKitchen', expect.anything());
  });

  it('offers and prints General Kitchen for an all-unassigned order', () => {
    const order = allUnassignedOrder();
    render(<OrderDetailsRightColumn order={order} />);

    const button = screen.getByRole('button', { name: /General Kitchen/ });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);

    expect(mockExportKitchenItemsToPDF).toHaveBeenCalledWith(order, 'GeneralKitchen', expect.anything());
    expect(screen.queryByRole('button', { name: /Front Kitchen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back Kitchen/ })).not.toBeInTheDocument();
  });

  it('keeps the General action available when no line routes to Front or Back', () => {
    const order = makeOrder([makeOrderItem({ id: 'water', productName: 'Still Water', kitchenType: 'None' })]);
    render(<OrderDetailsRightColumn order={order} />);

    expect(screen.getByRole('button', { name: /General Kitchen/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Front Kitchen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back Kitchen/ })).not.toBeInTheDocument();
  });
});
