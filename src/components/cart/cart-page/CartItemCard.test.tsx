import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CartItem } from '@/components/cart/cartTypes';
import CartItemCard from './CartItemCard';

// `i18n` is part of the mock, not decoration: CartItemCard reads `i18n.language` to pick the
// variation's localized name, so a `t`-only mock throws before anything renders.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span data-testid="img">{alt}</span>,
}));

const noop = () => {};

function renderCard(item: Partial<CartItem>, overrides: Partial<React.ComponentProps<typeof CartItemCard>> = {}) {
  return render(
    <CartItemCard
      item={{ quantity: 1, unitPrice: 10, itemTotal: 10, productName: 'Combo', ...item } as unknown as CartItem}
      isSyncing={false}
      editingInstructions={null}
      setEditingInstructions={noop}
      instructionsValue=""
      setInstructionsValue={noop}
      onUpdateQuantity={noop}
      onRemoveItem={noop}
      onSaveInstructions={noop}
      styles={{}}
      {...overrides}
    />,
  );
}

// OrderLineSummary is deliberately NOT mocked here. These tests exist to pin what the /cart card
// SHOWS, and #189's whole subject is which renderer produces it — a mock would let the card mount
// the shared component and render none of the rows, while every assertion below still passed.

// #189 migrated this card onto the shared OrderLineSummary and deleted CartItemCustomizations.
// These are that component's tests, moved here rather than dropped: they pin claims about what
// /cart shows, and /cart is now this file.
describe('CartItemCard — the line summary', () => {
  it('shows added ingredients with their quantity', () => {
    renderCard({
      selectedIngredientNames: ['Cheese'],
      selectedIngredients: ['i1'],
      ingredientQuantities: { i1: 2 },
    } as Partial<CartItem>);

    expect(screen.getByText('Added:')).toBeInTheDocument();
    expect(screen.getByText('Cheese')).toBeInTheDocument();
    expect(screen.getByText(/× 2/)).toBeInTheDocument();
  });

  // #363: the cart could never show a removal while the order view always could.
  it('shows removed ingredients', () => {
    renderCard({ removedIngredientNames: ['Onion', 'Cheese'] } as Partial<CartItem>);

    expect(screen.getByText('Removed:')).toBeInTheDocument();
    expect(screen.getByText('Onion, Cheese')).toBeInTheDocument();
  });

  // `[]` is a REAL server answer — a line customized without removing anything — and must not print
  // a bare "Removed:" label. This is why the guard tests `.length`, not truthiness.
  it('prints no Removed label for an empty removal list', () => {
    renderCard({
      removedIngredientNames: [],
      selectedIngredientNames: ['Cheese'],
      selectedIngredients: ['i1'],
    } as Partial<CartItem>);

    expect(screen.getByText('Cheese')).toBeInTheDocument();
    expect(screen.queryByText('Removed:')).not.toBeInTheDocument();
  });

  it('shows add-on side items', () => {
    renderCard({
      selectedSideItems: [{ id: 's1', name: 'Fries', quantity: 1, subTotal: 3.5 }],
    } as Partial<CartItem>);

    expect(screen.getByText('Side Items:')).toBeInTheDocument();
    expect(screen.getByText('Fries')).toBeInTheDocument();
  });

  // Carried over from CartItemCustomizations, and now a claim about `hideInstructions` rather than
  // about a component that omitted the row: CartItemInstructionsEditor owns the line's notes for
  // display AND edit, so the summary must not print a second copy. Without the flag the card shows
  // "No onions" twice.
  it('does not print a second special-requests row for the line', () => {
    renderCard({ specialInstructions: 'No onions' } as Partial<CartItem>);

    expect(screen.queryByText('Special Requests:')).not.toBeInTheDocument();
    // Exactly one copy — the editor's. `getAllByText` rather than `getByText` so the failure
    // reports the count instead of the generic "found multiple elements".
    expect(screen.getAllByText(/No onions/)).toHaveLength(1);
  });

  // A COMPONENT's notes are not the line's, so `hideInstructions` must not swallow them.
  it('still shows a bundle component’s own special requests', () => {
    renderCard({
      specialInstructions: 'Line note',
      childItems: [
        { id: 'c1', quantity: 1, unitPrice: 0, itemTotal: 0, productName: 'Pizza', specialInstructions: 'Child note' },
      ],
    } as Partial<CartItem>);

    expect(screen.getByText('Child note')).toBeInTheDocument();
  });
});

// #363. Before #189 the card rendered bundle components as its own flat "Includes:" list and never
// mounted OrderLineSummary, so it was the ONE cart surface that could not show a component's
// removals — the /menu rail and checkout both could, which left the two carts disagreeing. #363
// patched a removals row into that bespoke list; #189 deletes the list, and these assertions now
// hold because the card renders the same component every other surface does. Same claims, so the
// coverage that fix earned is not lost with the code it was written against.
describe('CartItemCard — bundle component removals', () => {
  it('shows a component’s removed ingredients', () => {
    renderCard({
      childItems: [
        {
          id: 'c1',
          quantity: 1,
          unitPrice: 0,
          itemTotal: 0,
          productName: 'Pizza',
          removedIngredientNames: ['Cheese', 'Basil'],
        },
      ],
    } as Partial<CartItem>);

    expect(screen.getByText('Pizza')).toBeInTheDocument();
    expect(screen.getByText('Cheese, Basil')).toBeInTheDocument();
  });

  it('prints no Removed label for a component with an empty list', () => {
    renderCard({
      childItems: [
        { id: 'c1', quantity: 1, unitPrice: 0, itemTotal: 0, productName: 'Pizza', removedIngredientNames: [] },
      ],
    } as Partial<CartItem>);

    expect(screen.getByText('Pizza')).toBeInTheDocument();
    expect(screen.queryByText('Removed:')).not.toBeInTheDocument();
  });

  it('prints no Removed label for an uncustomized component', () => {
    renderCard({
      childItems: [{ id: 'c1', quantity: 1, unitPrice: 0, itemTotal: 0, productName: 'Pizza' }],
    } as Partial<CartItem>);

    expect(screen.queryByText('Removed:')).not.toBeInTheDocument();
  });

  // A component of a component. The deleted "Includes:" list walked ONE level and would have
  // dropped this silently; the shared renderer recurses.
  //
  // FORWARD-LOOKING, not a claim about today: the cart API cannot currently emit this shape.
  // `BasketMappingService.MapChildItem` sets no `ChildItems` (nor `SelectedIngredientNames`, by its
  // own docstring), so a basket child arrives childless and this fixture is hand-built. The
  // assertion is here so the recursion cannot be quietly removed before the backend grows the
  // nesting — it is not evidence that /cart renders a grandchild in production.
  it('shows a component nested below the first level', () => {
    renderCard({
      childItems: [
        {
          id: 'c1',
          quantity: 1,
          unitPrice: 0,
          itemTotal: 0,
          productName: 'Burger Combo',
          childItems: [
            {
              id: 'c2',
              quantity: 1,
              unitPrice: 0,
              itemTotal: 0,
              productName: 'Beef Burger',
              removedIngredientNames: ['Pickles'],
            },
          ],
        },
      ],
    } as Partial<CartItem>);

    expect(screen.getByText('Beef Burger')).toBeInTheDocument();
    expect(screen.getByText('Pickles')).toBeInTheDocument();
  });
});

// The old Includes list printed each component's upcharge and NO count. The shared renderer shows
// the count and no price, for the eight render sites that never showed one — so /cart asks for the
// price explicitly (`showChildPrices`), which also suppresses the count. These pin all three
// claims: without the prop the migration would have quietly dropped a number the guest could see,
// without the `> 0` guard it would print "+CHF 0.00" on every free component, and without the
// suppression it would print a count that goes stale against that price on the first stepper press.
describe('CartItemCard — component upcharge', () => {
  it('shows a component’s upcharge', () => {
    renderCard({
      childItems: [{ id: 'c1', quantity: 1, unitPrice: 2.99, itemTotal: 0, productName: 'Pizza' }],
    } as Partial<CartItem>);

    expect(screen.getByText('+CHF 2.99')).toBeInTheDocument();
  });

  it('shows nothing for a component with no upcharge', () => {
    renderCard({
      childItems: [{ id: 'c1', quantity: 1, unitPrice: 0, itemTotal: 0, productName: 'Pizza' }],
    } as Partial<CartItem>);

    expect(screen.getByText('Pizza')).toBeInTheDocument();
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  // One bundle, two Cokes at CHF 1.50: the backend stores the child as `{quantity: 2, unitPrice:
  // 1.50}` and folds 1.50 × 2 into the parent, so "× 2  +CHF 1.50" reconciles to the 3.00 the line
  // carries — until the card's own stepper is pressed, which rescales the root and not the child
  // (`BasketService.UpdateBasketItemAsync`). /cart is the only surface with both the stepper and the
  // price, so it is the only one where a reconciling pair can silently stop reconciling.
  it('prints the upcharge without the count that would go stale beside it', () => {
    renderCard({
      childItems: [{ id: 'c1', quantity: 2, unitPrice: 1.5, itemTotal: 0, productName: 'Coca-Cola' }],
    } as Partial<CartItem>);

    expect(screen.getByText('+CHF 1.50')).toBeInTheDocument();
    // Document-wide: an assertion scoped to the name node would pass a restructure that moved the
    // count into a sibling span, which is the count still on screen.
    expect(screen.queryByText(/×\s*2/)).not.toBeInTheDocument();
  });
});

// The card's own controls. Untested before #189 — the file's coverage floor said so in as many
// words. They are covered here because the migration DELETED covered JSX (the Includes list and its
// map callback), which would otherwise have let the floor fall as a side effect of a refactor that
// removed no capability. `itemId` resolution is the part worth pinning: it falls back
// basketItemId → id → productId, and the handlers are what carry it to the cart.
describe('CartItemCard — controls', () => {
  const line = { basketItemId: 'b1', quantity: 2, unitPrice: 10, itemTotal: 20 } as Partial<CartItem>;

  it('steps the quantity down and up by one, carrying the basket item id', () => {
    const onUpdateQuantity = jest.fn();
    renderCard(line, { onUpdateQuantity });

    fireEvent.click(screen.getByLabelText('Decrease quantity'));
    fireEvent.click(screen.getByLabelText('Increase quantity'));

    expect(onUpdateQuantity.mock.calls).toEqual([
      ['b1', 1],
      ['b1', 3],
    ]);
  });

  it('removes the line by the same id', () => {
    const onRemoveItem = jest.fn();
    renderCard(line, { onRemoveItem });

    fireEvent.click(screen.getByLabelText('Remove item'));

    expect(onRemoveItem).toHaveBeenCalledWith('b1');
  });

  // Without basketItemId the card falls back to id, then productId — a line optimistically added
  // has no basket id yet, and a control that sent `undefined` would silently no-op.
  it('falls back to id, then productId, when there is no basket item id', () => {
    const onRemoveItem = jest.fn();
    const { unmount } = renderCard({ id: 'local-1', quantity: 1 } as Partial<CartItem>, { onRemoveItem });
    fireEvent.click(screen.getByLabelText('Remove item'));
    unmount();

    renderCard({ productId: 'p1', quantity: 1 } as Partial<CartItem>, { onRemoveItem });
    fireEvent.click(screen.getByLabelText('Remove item'));

    expect(onRemoveItem.mock.calls).toEqual([['local-1'], ['p1']]);
  });

  // Both guards on the decrement button, which differ: it is off at quantity 1 REGARDLESS of sync
  // state, so a guest cannot step a line to zero instead of removing it.
  it('disables every control while the cart is syncing, and the decrement at quantity 1', () => {
    const { unmount } = renderCard({ ...line, quantity: 1 } as Partial<CartItem>);
    expect(screen.getByLabelText('Decrease quantity')).toBeDisabled();
    expect(screen.getByLabelText('Increase quantity')).toBeEnabled();
    unmount();

    renderCard(line, { isSyncing: true });
    expect(screen.getByLabelText('Increase quantity')).toBeDisabled();
    expect(screen.getByLabelText('Remove item')).toBeDisabled();
  });
});

// The header block: the image, the localized variation name, and the customization-price row.
describe('CartItemCard — header', () => {
  it('renders the product image with the product name as its alt text', () => {
    renderCard({ productImageUrl: '/img/combo.png', productName: 'Lunch Combo' } as Partial<CartItem>);

    expect(screen.getByTestId('img')).toHaveTextContent('Lunch Combo');
  });

  /*
   * The three fallbacks below were uncovered before this MR and stayed uncovered while the
   * variation resolver sat inline. Moving that resolver into `variationLabel` took three COVERED
   * branches out of this file, and a file's branch ratio is a fraction — so a neutral extraction
   * pushed it from 86% to 85% and the per-file threshold refused the build. The honest answer is to
   * cover what was never covered, not to lower the number.
   */
  it('omits the image block entirely when the line carries no photo', () => {
    renderCard({ productName: 'Lunch Combo' } as Partial<CartItem>);

    expect(screen.queryByTestId('img')).not.toBeInTheDocument();
  });

  it('falls back to a placeholder name rather than rendering an empty heading', () => {
    renderCard({ productName: undefined } as Partial<CartItem>);

    expect(screen.getByRole('heading', { name: 'Unknown Item' })).toBeInTheDocument();
  });

  it('uses a generic alt text when the line has a photo but no name', () => {
    renderCard({ productImageUrl: '/img/x.png', productName: undefined } as Partial<CartItem>);

    expect(screen.getByTestId('img')).toHaveTextContent('Product');
  });

  it('prefers the current language’s variation name', () => {
    renderCard({
      variationName: 'Large',
      variationContent: { en: { name: 'Large (EN)' }, de: { name: 'Groß' } },
    } as unknown as Partial<CartItem>);

    expect(screen.getByText('Large (EN)')).toBeInTheDocument();
  });

  // Signed, and absent at zero — a "+CHF 0.00" row on an uncustomized line is noise.
  it.each([
    [2.5, '+CHF 2.50'],
    [-1, 'CHF -1.00'],
  ])('shows a customization price of %s as %s', (customizationPrice, expected) => {
    renderCard({ customizationPrice } as Partial<CartItem>);
    expect(screen.getByText(new RegExp(expected.replace(/[+.]/g, '\\$&')))).toBeInTheDocument();
  });

  it('shows no customization row when there is no customization price', () => {
    renderCard({ customizationPrice: 0 } as Partial<CartItem>);
    expect(screen.queryByText(/Customizations/)).not.toBeInTheDocument();
  });
});
