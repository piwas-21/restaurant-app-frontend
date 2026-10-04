import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import MenuOrderOverlays from './MenuOrderOverlays';

jest.mock(
  '@/components/menu/ItemCustomizationSheet',
  () =>
    function CustomizationProbe() {
      return <p>Customization</p>;
    },
);
jest.mock(
  '@/components/menu/OfferFamilyChoiceModal',
  () =>
    function OfferFamilyChoiceModalProbe() {
      return null;
    },
);
jest.mock(
  '@/components/order/OrderFlowModals',
  () =>
    function OrderFlowModalsProbe() {
      return null;
    },
);
jest.mock(
  '@/components/order/CartSheet',
  () =>
    function CartSheetProbe() {
      return <div data-testid="cart-sheet" />;
    },
);

function props(open: boolean, switching = false): ComponentProps<typeof MenuOrderOverlays> {
  return {
    sheet: { product: {}, bundle: {}, drinks: [] },
    cart: { isSheetOpen: open, closeSheet: jest.fn() },
    followUp: { switchFlow: { pending: switching ? {} : null } },
    onSwitchOrderType: jest.fn(),
  } as unknown as ComponentProps<typeof MenuOrderOverlays>;
}

describe('Menu basket visibility', () => {
  it('mounts the basket when it is open and no order-type conflict is pending', () => {
    render(<MenuOrderOverlays {...props(true)} />);
    expect(screen.getByTestId('cart-sheet')).toBeInTheDocument();
  });

  it.each([
    [false, false],
    [true, true],
  ])('does not mount a hidden or conflicting basket (%s, %s)', (open, switching) => {
    render(<MenuOrderOverlays {...props(open, switching)} />);
    expect(screen.queryByTestId('cart-sheet')).not.toBeInTheDocument();
    expect(screen.getAllByText('Customization')).toHaveLength(2);
  });
});
