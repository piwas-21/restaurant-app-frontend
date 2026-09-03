import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CartItem } from '@/components/cart/cartTypes';
import CartLineList from './CartLineList';

jest.mock('react-i18next', () => ({
  // `i18n` too: `CartLineList` reads `i18n.language` to resolve the line's variation in the
  // reading language, and a mock returning only `t` throws on the real component's own code.
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key, i18n: { language: 'en' } }),
}));
jest.mock('./OrderLineSummary', () => ({
  __esModule: true,
  // Records what the list ASKED for. The variation row is rendered by `OrderLineSummary`, so the
  // thing this list is responsible for is passing the resolved label and turning the row on —
  // `OrderLineSummary.test` owns whether the row then draws.
  default: ({ line, showVariation }: { line: { variation?: string }; showVariation?: boolean }) => (
    <div data-testid="line-summary" data-variation={showVariation ? (line.variation ?? '') : undefined} />
  ),
}));

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

  /**
   * The reported gap: the /cart card and the checkout list have always shown the chosen size and
   * this list did not, so the basket flyout — the only cart surface on /menu since the rail left it
   * — was the one place a guest could not check WHICH variation they had added.
   */
  it('hands the summary the chosen variation, resolved for the reading language', () => {
    setup({
      items: [item({ variationContent: { en: { name: 'Large' } }, variationName: 'Large (40 cm)' })],
    });
    expect(screen.getByTestId('line-summary')).toHaveAttribute('data-variation', 'Large');
  });

  it("asks for the variation row even on a line that has none, so the empty case is the summary's call", () => {
    setup({ items: [item()] });
    expect(screen.getByTestId('line-summary')).toHaveAttribute('data-variation', '');
  });
});
