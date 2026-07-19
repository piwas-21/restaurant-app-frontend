import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CartItem } from '@/components/cart/cartTypes';
import CartLineList from './CartLineList';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
jest.mock('./OrderLineSummary', () => ({ __esModule: true, default: () => <div data-testid="line-summary" /> }));

const styles = {
  itemList: 'itemList',
  item: 'item',
  itemName: 'itemName',
  itemPrice: 'itemPrice',
  itemControls: 'ic',
  iconButton: 'ib',
  qtyGroup: 'qg',
  qtyButton: 'qb',
  qty: 'q',
} as const;

const item = (over: Partial<CartItem> = {}): CartItem => ({
  basketItemId: 'b1',
  productName: 'Shakshuka',
  quantity: 2,
  unitPrice: 12,
  itemTotal: 24,
  ...over,
});

type Overrides = { items?: CartItem[]; disabled?: boolean };

const setup = (over: Overrides = {}) => {
  const props = {
    items: [item()],
    disabled: false,
    onQty: jest.fn(),
    onRemove: jest.fn(),
    styles,
    headerClassName: 'itemRow',
    ...over,
  };
  render(<CartLineList {...props} />);
  return props;
};

describe('CartLineList', () => {
  it('renders a line per item with its name and summary', () => {
    setup({ items: [item(), item({ basketItemId: 'b2', productName: 'Sourdough' })] });
    expect(screen.getByText('Shakshuka')).toBeInTheDocument();
    expect(screen.getByText('Sourdough')).toBeInTheDocument();
    expect(screen.getAllByTestId('line-summary')).toHaveLength(2);
  });

  it('wires the stepper + remove to the basket item id', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(p.onQty).toHaveBeenCalledWith('b1', 3);
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(p.onQty).toHaveBeenCalledWith('b1', 1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove item' }));
    expect(p.onRemove).toHaveBeenCalledWith('b1');
  });

  it('falls back to id then productId when basketItemId is absent', () => {
    const p = setup({ items: [item({ basketItemId: undefined, id: undefined, productId: 'p9' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Remove item' }));
    expect(p.onRemove).toHaveBeenCalledWith('p9');
  });
});
