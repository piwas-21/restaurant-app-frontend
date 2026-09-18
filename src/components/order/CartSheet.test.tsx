import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import CartSheet, { type CartSheetProps } from './CartSheet';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

// The basket's contents (lines, totals, checkout) are covered by the checkout flows; this file
// pins the SHELL, whose presentation changed with the mcdoner mobile-fit fixes (2026-09-18).
jest.mock('./CartContents', () => ({
  __esModule: true,
  default: () => <div data-testid="cart-contents" />,
}));

function renderCart() {
  const followUp = { pickType: jest.fn() } as unknown as CartSheetProps['followUp'];
  return render(<CartSheet isOpen onClose={jest.fn()} followUp={followUp} />);
}

describe('CartSheet shell', () => {
  it('renders the basket contents inside the modal', () => {
    renderCart();

    expect(screen.getByTestId('cart-contents')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Shopping Basket' })).toBeInTheDocument();
  });

  // The basket is a phone-first scrollable surface: it must take the shared docked sheet
  // (definite 90dvh height, BaseModal) rather than its own auto-height phone CSS, which WebKit
  // collapsed to a ~90px strip on real iOS Safari (2026-09-18 staging report).
  it('docks to the shared responsive bottom sheet on phones', () => {
    renderCart();

    expect(screen.getByRole('dialog')).toHaveAttribute('data-presentation', 'responsive-sheet');
  });
});
