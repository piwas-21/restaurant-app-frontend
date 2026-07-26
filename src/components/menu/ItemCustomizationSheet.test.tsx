import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { OrderType } from '@/types/order';
import ItemCustomizationSheet, { type SheetController } from './ItemCustomizationSheet';
import { useItemAvailabilityNotice, type AvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';

/**
 * The sheet's §9.10 guard. Before it, a blocked card was two clicks from being defeated: "Details"
 * opened this sheet, whose footer Add was unconditional, and only the server's untranslated
 * rejection stopped the order.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

// The decision is covered by `useItemAvailabilityNotice.test.ts`; here we pin what the sheet does
// with the answer, so this file stays provider-less like the hook tests.
jest.mock('@/hooks/menu/useItemAvailabilityNotice', () => ({
  useItemAvailabilityNotice: jest.fn(() => null),
}));

jest.mock('@/components/menu/customization/ProductSheetBody', () => ({
  __esModule: true,
  default: () => <div data-testid="product-body" />,
}));

const mockedNotice = useItemAvailabilityNotice as jest.Mock;

const addToCart = jest.fn();

function controller(availability?: unknown): SheetController & { close: jest.Mock } {
  return {
    kind: 'product',
    isOpen: true,
    isLoading: false,
    isSubmitting: false,
    product: { id: 'p1', name: 'Dürüm', availability },
    title: 'Dürüm',
    description: '',
    quantity: 1,
    setQuantity: jest.fn(),
    linePrice: { total: 12, base: 12, extras: 0 },
    addToCart,
    close: jest.fn(),
  } as unknown as SheetController & { close: jest.Mock };
}

const BLOCKED: AvailabilityNotice = {
  tone: 'blocked',
  message: 'Takeaway and Delivery only',
  switchTo: OrderType.Takeaway,
  switchLabel: 'Switch to Takeaway',
  hint: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedNotice.mockReturnValue(null);
});

describe('ItemCustomizationSheet — order-type guard', () => {
  it('keeps the normal footer when the item is orderable', () => {
    render(<ItemCustomizationSheet controller={controller()} />);

    expect(screen.getByRole('button', { name: /Add to Order|add_to_order/ })).toBeInTheDocument();
    expect(screen.queryByText('Takeaway and Delivery only')).not.toBeInTheDocument();
  });

  it('READS the handed-over verdict — the link the whole guard hangs on', () => {
    const availability = { canOrder: false, reason: 'WrongOrderType', allowedOrderTypes: [OrderType.Takeaway] };

    render(<ItemCustomizationSheet controller={controller(availability)} />);

    // Without this the sheet could pass `undefined` to the decision hook and every other assertion
    // in this file would still pass, because the hook is mocked.
    expect(mockedNotice).toHaveBeenCalledWith(availability);
  });

  it('refuses the add on the SERVER verdict even before a reason can be rendered', () => {
    // The enabled-channel list is still loading, so there is no notice — but `canOrder` is false and
    // the server would reject the add in English. Refuse first, explain if we can.
    mockedNotice.mockReturnValue(null);

    render(<ItemCustomizationSheet controller={controller({ canOrder: false, reason: 'WrongOrderType' })} />);

    expect(screen.queryByRole('button', { name: /Add to Order|add_to_order/ })).not.toBeInTheDocument();
  });

  it('replaces Add AND the quantity stepper with the reason and the way out when blocked', () => {
    const onSwitchOrderType = jest.fn();
    mockedNotice.mockReturnValue(BLOCKED);

    render(<ItemCustomizationSheet controller={controller()} onSwitchOrderType={onSwitchOrderType} />);

    // The add is gone, not merely disabled — a disabled Add explains nothing (#208).
    expect(screen.queryByRole('button', { name: /Add to Order|add_to_order/ })).not.toBeInTheDocument();
    // …and so is the stepper: a quantity for something that cannot be ordered is noise.
    expect(screen.queryByLabelText('Increase quantity')).not.toBeInTheDocument();
    expect(screen.getByText('Takeaway and Delivery only')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Takeaway' }));
    expect(onSwitchOrderType).toHaveBeenCalledWith(OrderType.Takeaway);
    // Switching must never sneak the add through.
    expect(addToCart).not.toHaveBeenCalled();
  });

  it('CLOSES on switch — the verdict it holds was taken at open time and cannot be re-resolved', () => {
    const onSwitchOrderType = jest.fn();
    const ctrl = controller();
    mockedNotice.mockReturnValue(BLOCKED);

    render(<ItemCustomizationSheet controller={ctrl} onSwitchOrderType={onSwitchOrderType} />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Takeaway' }));

    // Leaving it open re-labels the footer to a THIRD channel and never restores Add: the guest did
    // exactly what the UI asked and the UI asks again. Closing lands them on the grid, which
    // refetches and shows the card already unblocked.
    expect(ctrl.close).toHaveBeenCalled();
  });

  it('renders nothing at all while closed', () => {
    const closed = { ...controller(), isOpen: false } as SheetController;

    const { container } = render(<ItemCustomizationSheet controller={closed} />);

    expect(container).toBeEmptyDOMElement();
  });
});
