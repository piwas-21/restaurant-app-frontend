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
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
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
