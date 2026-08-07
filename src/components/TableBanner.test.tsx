import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TableBanner from './TableBanner';
import { OrderType } from '@/types/order';

const mockClearTableContext = jest.fn();
const mockClearOrderType = jest.fn();

const mockTableState = {
  hasTableContext: true,
  tableContext: { tableId: 't-5', tableNumber: '5', qrScanned: true, isOutdoor: false },
  clearTableContext: mockClearTableContext,
};
const mockOrderTypeState = { orderType: OrderType.DineIn as OrderType | null };

jest.mock('@/contexts/TableContext', () => ({ useTableContext: () => mockTableState }));
jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ state: mockOrderTypeState, clearOrderType: mockClearOrderType }),
}));
// The second argument is a STRING fallback for most keys but an interpolation OBJECT for
// `ordering_for_table` ("Ordering for Table {{number}}"). Returning it verbatim made React throw
// "Objects are not valid as a React child" — the stub, not the component. Interpolate instead, so
// the rendered text is what a guest actually reads and an unfilled placeholder would be visible.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg?: string | Record<string, unknown>) => {
      if (typeof arg === 'string') return arg;
      if (arg && typeof arg === 'object') {
        // Resolve against the REAL en.json value for the one interpolated key on this banner —
        // echoing the key back would leave nothing to interpolate, and the test would pass whether
        // or not the placeholder was ever filled.
        const source = key === 'ordering_for_table' ? 'Ordering for Table {{number}}' : key;
        return Object.entries(arg).reduce<string>(
          (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)),
          source,
        );
      }
      return key;
    },
  }),
}));

const openConfirm = () => fireEvent.click(screen.getAllByRole('button', { name: 'Clear table selection' })[0]);

const clearAndConfirm = () => {
  openConfirm();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTableState.hasTableContext = true;
  mockOrderTypeState.orderType = OrderType.DineIn;
});

describe('TableBanner', () => {
  it('renders nothing without a table context', () => {
    mockTableState.hasTableContext = false;

    const { container } = render(<TableBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  /**
   * The reported defect: `ordering_for_table` is "Ordering for Table {{number}}" in all ten
   * locales, but `t()` was called with no interpolation values and the number was rendered in a
   * SEPARATE span beside it — so a guest who scanned a QR read the literal
   * "Ordering for Table {{number}} 7". Asserting on the absence of `{{` rather than on the exact
   * sentence, because the same mistake in any other key on this banner should also fail here.
   */
  it('renders the table number INTO the sentence, leaving no unfilled placeholder', () => {
    render(<TableBanner />);

    const banner = screen.getAllByRole('status')[0];
    expect(banner).toHaveTextContent('Ordering for Table 5');
    expect(banner.textContent).not.toContain('{{');
  });

  it('confirms before clearing rather than blocking on window.confirm', () => {
    render(<TableBanner />);

    openConfirm();

    expect(mockClearTableContext).not.toHaveBeenCalled();
    expect(screen.getByText(/Clear table selection\?/)).toBeInTheDocument();
    // BaseModal, not a raw overlay — this is a customer-facing surface (frontend rule 2).
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // G2: clearing the table used to leave the order type on Dine-In with an orphaned table number
  // — the banner vanished while checkout still believed the guest was seated.
  it('clears the dine-in order type along with the table', () => {
    render(<TableBanner />);

    clearAndConfirm();

    expect(mockClearTableContext).toHaveBeenCalledTimes(1);
    expect(mockClearOrderType).toHaveBeenCalledTimes(1);
  });

  it('leaves a deliberately-chosen Takeaway alone — only the scan-derived choice is undone', () => {
    mockOrderTypeState.orderType = OrderType.Takeaway;
    render(<TableBanner />);

    clearAndConfirm();

    expect(mockClearTableContext).toHaveBeenCalledTimes(1);
    expect(mockClearOrderType).not.toHaveBeenCalled();
  });

  it('cancelling the confirm changes nothing', () => {
    render(<TableBanner />);

    openConfirm();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockClearTableContext).not.toHaveBeenCalled();
    expect(mockClearOrderType).not.toHaveBeenCalled();
  });
});
