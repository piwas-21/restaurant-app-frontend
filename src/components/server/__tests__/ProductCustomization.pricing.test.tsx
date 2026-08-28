import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductCustomization from '../ProductCustomization';
import { getProductById } from '@/services/menuService';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));

/**
 * S7 — the waiter sheet's money, pinned.
 *
 * This file exists so the price-math consolidation cannot hide a behaviour change inside a
 * cleanup. It was written and made green against the sheet's OWN arithmetic (the `totalPrice`
 * memo that summed `variation.finalPrice + Σ selected optional price + Σ side price × qty`),
 * BEFORE that memo was replaced by the shared `useLinePrice`. Every assertion below is therefore
 * either "unchanged by S7" or carries a comment saying what changed and why.
 *
 * The fixture is deliberately the shape that makes the two sheets disagree: an optional
 * ingredient that is INCLUDED IN THE BASE PRICE (`cheese`), which the guest sheet pre-selects and
 * prices at 0, and one that is not (`bacon`), which both sheets charge for.
 */
const BASE_PRICE = 10;

const detail = {
  success: true,
  data: {
    id: 'p1',
    name: 'Margherita',
    basePrice: BASE_PRICE,
    hideBaseProduct: false,
    variations: [
      { id: 'small', name: 'Small', priceModifier: 0, finalPrice: 10, isActive: true, displayOrder: 1 },
      { id: 'large', name: 'Large', priceModifier: 3, finalPrice: 13, isActive: true, displayOrder: 2 },
    ],
    detailedIngredients: [
      // Required — defines the dish, priced into the base, removable by nobody.
      {
        id: 'dough',
        name: 'Dough',
        isActive: true,
        isOptional: false,
        price: 0,
        isIncludedInBasePrice: true,
        maxQuantity: 1,
      },
      // The one that matters: optional, but you already paid for one of it.
      {
        id: 'cheese',
        name: 'Cheese',
        isActive: true,
        isOptional: true,
        price: 2,
        isIncludedInBasePrice: true,
        maxQuantity: 3,
      },
      // A plain paid extra.
      {
        id: 'bacon',
        name: 'Bacon',
        isActive: true,
        isOptional: true,
        price: 1.5,
        isIncludedInBasePrice: false,
        maxQuantity: 2,
      },
      // Off the menu — must never be offered and never be priced.
      {
        id: 'truffle',
        name: 'Truffle',
        isActive: false,
        isOptional: true,
        price: 9,
        isIncludedInBasePrice: false,
        maxQuantity: 1,
      },
    ],
    suggestedSideItems: [
      { id: 'fries', name: 'Fries', price: 4, isRequired: true, displayOrder: 1 },
      { id: 'coke', name: 'Coke', price: 2.5, isRequired: false, displayOrder: 2 },
    ],
    allergens: [],
  },
};

const product = { id: 'p1', name: 'Margherita', basePrice: BASE_PRICE } as never;

const openSheet = () => {
  (getProductById as jest.Mock).mockResolvedValue(detail);
  return render(<ProductCustomization product={product} isOpen onClose={jest.fn()} onConfirm={jest.fn()} />);
};

/** The footer button is the waiter's price: "Add to Order · CHF 14.00". */
const addButton = () => screen.getByRole('button', { name: /Add to Order/ });
const totalText = () => addButton().textContent ?? '';

const tap = (label: string) => fireEvent.click(screen.getByText(label).closest('button') as HTMLButtonElement);

describe('S7 — waiter sheet totals (pinned before the shared-price-math change)', () => {
  it('opens at base + the required side, with no variation chosen', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));
  });

  it('charges a plain optional extra at its price', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    tap('Bacon');

    expect(totalText()).toContain('CHF 15.50');
  });

  it('adds the chosen variation', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    tap('Large');

    expect(totalText()).toContain('CHF 17.00');
  });

  it('adds an optional side item', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    tap('Coke');

    expect(totalText()).toContain('CHF 16.50');
  });

  it('multiplies the whole line by the quantity', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    fireEvent.click(screen.getByText('+'));

    expect(totalText()).toContain('CHF 28.00');
  });

  it('never prices an inactive ingredient — it is not even offered', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    expect(screen.queryByText('Truffle')).not.toBeInTheDocument();
  });

  /**
   * THE DEFECT, pinned in its pre-fix state.
   *
   * `cheese` is `isIncludedInBasePrice` — the guest already paid for one of it inside the CHF 10.
   * The guest sheet opens with it TICKED and prices it at 0. This sheet opens with it un-ticked,
   * and charging CHF 2 to tick it means the same pizza with the same cheese on it costs CHF 2 more
   * when a waiter enters it than when a guest does.
   */
  it('DEFECT: charges CHF 2 for cheese that is already in the base price', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    tap('Cheese');

    expect(totalText()).toContain('CHF 16.00');
  });

  /** And the other half: a waiter cannot take the cheese OFF, so the refund can never happen. */
  it('DEFECT: offers no way to remove an ingredient that is included in the base price', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    // Un-ticked at open, and the only affordance re-prices upwards. There is no −CHF 2 state.
    expect(totalText()).toContain('CHF 14.00');
    expect(screen.queryByText('-CHF 2.00')).not.toBeInTheDocument();
  });

  /** No stepper: `maxQuantity: 2` on bacon is unreachable, so the second rasher is free. */
  it('DEFECT: has no quantity stepper, so maxQuantity is unreachable', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    tap('Bacon');
    tap('Bacon');

    // Tapping twice toggles off rather than reaching quantity 2.
    expect(totalText()).toContain('CHF 14.00');
  });
});
