import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductCustomization from '../ProductCustomization';
import { getProductById } from '@/services/menuService';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    // Interpolating stub: S7's per-ingredient stepper labels itself with the ingredient's name,
    // and a `(key) => key` stub would make both "+" buttons indistinguishable again.
    t: (key: string, arg?: string | Record<string, string>) => {
      if (typeof arg === 'object' && arg !== null) {
        const labels: Record<string, string> = {
          increase_quantity_of_item: `Increase quantity of ${arg.itemName}`,
          decrease_quantity_of_item: `Decrease quantity of ${arg.itemName}`,
        };
        return labels[key] ?? key;
      }
      return arg ?? key;
    },
  }),
}));

jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));

/**
 * S7 — the waiter sheet's money, pinned.
 *
 * This file exists so the price-math consolidation cannot hide a behaviour change inside a
 * cleanup. It was written and made green against the sheet's OWN arithmetic (the `totalPrice`
 * memo that summed `variation.finalPrice + Σ selected optional price + Σ side price × qty`),
 * BEFORE that memo was replaced by the shared `useLinePrice` — see the previous commit for the
 * pinned pre-fix numbers. Every assertion below is therefore either UNCHANGED by S7, or carries a
 * comment naming what changed and why. Six of the nine original assertions are unchanged; the
 * three named DEFECT are the ones this slice exists to move, and they now assert the guest
 * sheet's numbers instead.
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

const openSheet = (onConfirm: jest.Mock = jest.fn()) => {
  (getProductById as jest.Mock).mockResolvedValue(detail);
  render(<ProductCustomization product={product} isOpen onClose={jest.fn()} onConfirm={onConfirm} />);
  return onConfirm;
};

/** The footer button is the waiter's price: "Add to Order · CHF 14.00". */
const addButton = () => screen.getByRole('button', { name: /Add to Order/ });
const totalText = () => addButton().textContent ?? '';

const chip = (label: string) => screen.getByText(label).closest('button') as HTMLButtonElement;
const tap = (label: string) => fireEvent.click(chip(label));

describe('S7 — waiter sheet totals', () => {
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

    // By role now, not by text: S7's per-ingredient stepper also renders a "+".
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));

    expect(totalText()).toContain('CHF 28.00');
  });

  it('never prices an inactive ingredient — it is not even offered', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    expect(screen.queryByText('Truffle')).not.toBeInTheDocument();
  });

  /**
   * FIXED by S7 — this assertion changed, and it is the whole point of the slice.
   *
   * Before: opening un-ticked and charging CHF 2 to tick `cheese` back on, so the same pizza with
   * the same cheese cost CHF 2 more entered by a waiter than by a guest.
   * After: the sheet opens on the base recipe, cheese is already on, and it costs nothing —
   * because the base price bought it. `CHF 14.00` is the guest sheet's number for this line.
   */
  it('does not charge again for an ingredient the base price already bought', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    expect(chip('Cheese')).toHaveAttribute('aria-pressed', 'true');
    expect(totalText()).toContain('CHF 14.00');
  });

  /**
   * FIXED by S7 — the other half. A waiter can finally enter "no cheese", and the line gets the
   * same CHF 2 refund the guest sheet has always given.
   */
  it('refunds an included ingredient the waiter takes off', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    tap('Cheese');

    expect(chip('Cheese')).toHaveAttribute('aria-pressed', 'false');
    expect(totalText()).toContain('CHF 12.00');
  });

  /** …and putting it back returns the line to the advertised base, not to base + 2. */
  it('returns to the advertised price when the ingredient goes back on', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    tap('Cheese');
    tap('Cheese');

    expect(totalText()).toContain('CHF 14.00');
  });

  /**
   * FIXED by S7 — `maxQuantity: 2` on bacon is reachable, and the second rasher is charged.
   * The clamp is the price math's own, so the stepper cannot offer a quantity the server refuses.
   */
  it('charges each extra portion, up to the ingredient maximum', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    tap('Bacon');
    expect(totalText()).toContain('CHF 15.50');

    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Bacon' }));
    expect(totalText()).toContain('CHF 17.00');

    // At the maximum the control says so rather than disappearing from the tab order.
    const plus = screen.getByRole('button', { name: 'Increase quantity of Bacon' });
    expect(plus).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(plus);
    expect(totalText()).toContain('CHF 17.00');
  });

  /** A minus at 1 removes the extra rather than dead-ending on a disabled button (guest parity). */
  it('takes the extra off when the stepper goes below one', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    tap('Bacon');
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Bacon' }));
    expect(totalText()).toContain('CHF 17.00');

    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity of Bacon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity of Bacon' }));

    expect(totalText()).toContain('CHF 14.00');
    expect(chip('Bacon')).toHaveAttribute('aria-pressed', 'false');
  });

  /** BaseModal, not the hand-rolled overlay it replaces (CLAUDE.md §5 rule 2). */
  it('is a real dialog', async () => {
    openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Margherita');
  });

  /**
   * The payload, end to end. Selecting is not adding since S7, so the order line must say what
   * CHANGED — otherwise a kitchen ticket reads "Add: Cheese" for cheese the dish always had.
   */
  it('sends what changed, not what is selected', async () => {
    const onConfirm = openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    tap('Cheese'); // off the dish
    tap('Bacon'); // on the dish
    fireEvent.click(addButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const result = onConfirm.mock.calls[0][0];
    expect(result.addedIngredients).toEqual([{ id: 'bacon', name: 'Bacon', price: 1.5, quantity: 1 }]);
    expect(result.removedIngredients).toEqual([{ id: 'cheese', name: 'Cheese', price: 2, quantity: 1 }]);
    // The unit price is the shared math's, not a second derivation: 10 − 2 + 1.50 + 4 fries.
    expect(result.finalPrice).toBe(13.5);
  });

  it('confirms once per line quantity, at the per-unit price', async () => {
    const onConfirm = openSheet();
    await waitFor(() => expect(totalText()).toContain('CHF 14.00'));

    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    fireEvent.click(addButton());

    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(onConfirm.mock.calls[0][0].finalPrice).toBe(14);
  });
});
