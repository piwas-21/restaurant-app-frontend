import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ItemCustomizationSheet from './ItemCustomizationSheet';
import { useItemCustomizationSheet } from '@/hooks/menu/useItemCustomizationSheet';
import { getProductById } from '@/services/menuService';

/**
 * The guided flow end to end, driven by the REAL controller rather than a hand-built one.
 *
 * Pinning it against `useItemCustomizationSheet` is deliberate: the flow is derived from the same
 * payload the controller seeds itself from, so a fixture written here by hand could only prove that
 * the two agree with each other — the producer is what has to be pinned, not the shape.
 */

const mockAddItem = jest.fn().mockResolvedValue(undefined);

jest.mock('@/components/cart/CartContext', () => ({ useCart: () => ({ addItem: mockAddItem }) }));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options?: unknown) =>
      typeof options === 'string'
        ? options
        : options && typeof options === 'object'
          ? `${key}:${Object.values(options as Record<string, unknown>).join('|')}`
          : key,
  }),
}));
jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));
jest.mock('@/hooks/menu/useItemAvailabilityNotice', () => ({ useItemAvailabilityNotice: jest.fn(() => null) }));

const mockedNotice = jest.requireMock('@/hooks/menu/useItemAvailabilityNotice').useItemAvailabilityNotice as jest.Mock;

const BLOCKED_NOTICE = {
  tone: 'blocked' as const,
  message: 'Takeaway only',
  switchTo: null,
  switchLabel: '',
  shortMessage: 'Takeaway only',
  hint: null,
};

const mockGetProductById = getProductById as jest.Mock;

const ingredient = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  price: 2,
  isOptional: true,
  isActive: true,
  displayOrder: 1,
  ...extra,
});

/** Variations + ingredients + sauces + a beverages side group ⇒ four decisions and a review. */
const COMPLEX = {
  id: 'p1',
  name: 'Dürüm',
  content: { en: { name: 'Dürüm' } },
  basePrice: 12,
  type: 'mainItem',
  variations: [
    { id: 'v1', name: 'Regular', isActive: true, priceModifier: 0, displayOrder: 1 },
    { id: 'v2', name: 'Large', isActive: true, priceModifier: 3, displayOrder: 2 },
  ],
  detailedIngredients: [
    ingredient('onion', 'Onion', { isIncludedInBasePrice: true }),
    ingredient('garlic', 'Garlic sauce', { kind: 'sauce' }),
  ],
  suggestedSideItems: [{ id: 'cola', name: 'Cola', price: 3, type: 'beverage', isRequired: false, displayOrder: 1 }],
};

/**
 * Two side partitions — the shape that motivated the split. Measured on the demo tenant's real
 * catalogue, 22 of 58 products look exactly like this (beverages + desserts) and offer 19 side
 * items between them; in one panel that is 1278px of content behind a sticky Continue.
 */
const TWO_SIDE_GROUPS = {
  ...COMPLEX,
  id: 'p4',
  suggestedSideItems: [
    { id: 'cola', name: 'Cola', price: 3, type: 'beverage', isRequired: false, displayOrder: 1 },
    { id: 'baklava', name: 'Baklava', price: 5, type: 'dessert', isRequired: false, displayOrder: 2 },
  ],
};

/**
 * Same shape, but the product demands a sauce. This is the required gate a guest can actually
 * REACH: nothing seeds a sauce selection, whereas a variations step opens already answered by
 * `buildInitialSheetState` (see the backstop note on `stepBlocker`).
 */
const GATED = { ...COMPLEX, id: 'p3', sauceMin: 1 };

/**
 * One decision and nothing else — the case that must NOT grow a stepper.
 *
 * A `mainItem`, deliberately, and every test that uses it hands the sheet a populated drinks list:
 * a beverage fixture would dodge `offersGenericDrinks` and an absent `drinks` prop would dodge the
 * upsell entirely, so the pair would assert the invariant for a case that does not ship.
 */
const SIMPLE = {
  id: 'p2',
  name: 'Ayran',
  content: { en: { name: 'Ayran' } },
  basePrice: 3,
  type: 'mainItem',
  variations: [],
  detailedIngredients: [ingredient('mint', 'Mint')],
  suggestedSideItems: [],
};

/**
 * A ready DrinkUpsell — the hook itself is pinned by `useDrinkUpsell.test.ts`.
 *
 * `reset` is shared across fixtures on purpose: the real hook's is `useCallback([], [])`-stable,
 * and the flow's open-time snapshot keys on it. A fresh `jest.fn()` per call would re-fire that
 * effect on every rerender and quietly defeat the very freeze the tests below assert.
 */
const resetDrinks = jest.fn();
const upsell = (drinks: Array<{ id: string; name: string; price: number }>, subtotal = 0) => ({
  drinks,
  selected: {},
  subtotal,
  add: jest.fn(),
  remove: jest.fn(),
  reset: resetDrinks,
  addSelected: jest.fn().mockResolvedValue(undefined),
  summary: () => [],
});

function Harness({ drinks }: { drinks?: ReturnType<typeof upsell> }) {
  const controller = useItemCustomizationSheet();
  (Harness as unknown as { open: (id: string) => Promise<void> }).open = (id: string) =>
    controller.openForProduct(id, { forceSheet: true });
  return <ItemCustomizationSheet controller={controller} drinks={drinks} />;
}

async function openSheetWith(product: object, drinks?: ReturnType<typeof upsell>) {
  mockGetProductById.mockResolvedValue({ data: product });
  const rendered = render(<Harness drinks={drinks} />);
  await act(async () => {
    await (Harness as unknown as { open: (id: string) => Promise<void> }).open('p');
  });
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  return rendered;
}

const openSheet = (product: object, drinks?: ReturnType<typeof upsell>) => openSheetWith(product, drinks);

beforeEach(() => {
  jest.clearAllMocks();
  mockedNotice.mockReturnValue(null);
});

/** The footer's one forward control — labelled Skip on an untouched optional step, else Continue. */
const advance = () => fireEvent.click(screen.getByRole('button', { name: /^step_(skip|continue)$/ }));

describe('the flow is CONDITIONAL — a simple item must not pay for the complex ones', () => {
  it('gives a one-decision item no progress bar, no Continue, and an Add straight away', async () => {
    // With drinks on offer: the upsell may EXTEND a guided flow, never create one.
    await openSheet(SIMPLE, upsell([{ id: 'cola', name: 'Cola', price: 3.5 }]));

    expect(screen.queryByRole('navigation', { name: 'step_progress' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'step_continue' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add_to_order/ })).toBeInTheDocument();
    // The note has nowhere else to live without a review step, so it stays on the single screen.
    expect(screen.getByLabelText('product_special_requests')).toBeInTheDocument();
  });

  it('gives a four-decision item a progress bar and one decision on screen at a time', async () => {
    await openSheet(COMPLEX);

    expect(screen.getByRole('navigation', { name: 'step_progress' })).toBeInTheDocument();
    // Step one is the variations, and NOTHING else: the ingredient checkbox that used to sit two
    // blocks below it in the same scroll is not rendered at all.
    expect(screen.getByRole('radio', { name: /Large/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Onion/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add_to_order/ })).not.toBeInTheDocument();
  });
});

describe('the required-step gate', () => {
  /**
   * Continue is never disabled — a disabled control explains nothing (#208) — so the refusal has to
   * SAY something. Nothing on arrival, a reason once the guest presses it.
   */
  it('says nothing on arrival, then states the reason and holds the step', async () => {
    await openSheet(GATED);
    advance(); // past the variations
    advance(); // past the ingredients, onto the sauces
    expect(screen.getByRole('checkbox', { name: /Garlic sauce/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^step_(skip|continue)$/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('step_blocked_sauces');
    // Still on the sauces: the drinks group from the next step has not appeared.
    expect(screen.queryByRole('button', { name: /add_ingredient/ })).not.toBeInTheDocument();
  });

  it('moves on once the required choice is made', async () => {
    await openSheet(GATED);
    advance();
    advance();

    fireEvent.click(screen.getByRole('checkbox', { name: /Garlic sauce/ }));
    advance();
    expect(screen.getByRole('button', { name: /add_ingredient/ })).toBeInTheDocument();
  });
});

describe('walking the flow', () => {
  /**
   * The reported defect, end to end: with both partitions in ONE step the desserts sat below the
   * fold under a permanently-reachable Continue, so a guest picked a drink and never saw them.
   * Each partition is now its own screen, and the assertion that matters is the NEGATIVE one —
   * that the dessert is not on the drinks screen and the drink is not on the dessert screen.
   */
  it('gives each side partition its own screen', async () => {
    await openSheet(TWO_SIDE_GROUPS);
    advance(); // variations
    advance(); // ingredients
    advance(); // sauces

    expect(screen.getByText('Cola')).toBeInTheDocument();
    expect(screen.queryByText('Baklava')).not.toBeInTheDocument();

    advance();

    expect(screen.getByText('Baklava')).toBeInTheDocument();
    expect(screen.queryByText('Cola')).not.toBeInTheDocument();
  });

  it('reaches each decision in turn and ends on the review', async () => {
    await openSheet(COMPLEX);

    advance();
    expect(screen.getByRole('checkbox', { name: /Onion/ })).toBeInTheDocument();

    // Sauces are their own step now. In the layout this replaces they were a collapsed disclosure
    // at the bottom of the ingredient block, which is precisely how a guest missed them.
    advance();
    expect(screen.getByRole('checkbox', { name: /Garlic sauce/ })).toBeInTheDocument();

    advance();
    expect(screen.getByRole('button', { name: /add_ingredient/ })).toBeInTheDocument(); // the drinks side group

    advance();
    expect(screen.getByRole('button', { name: /add_to_order/ })).toBeInTheDocument();
  });

  /**
   * The anti-miss guarantee (MENU-CUSTOMIZATION-FLOW-PLAN §3.3): a step the guest walked past is
   * listed on the review with an explicit None, not omitted.
   */
  it('lists every skipped step on the review as None', async () => {
    await openSheet(COMPLEX);

    for (let step = 0; step < 4; step += 1) advance();

    // Variations answered by the seeded default; the other three untouched.
    expect(screen.getAllByText('step_nothing_selected')).toHaveLength(3);
    expect(screen.getByText('Regular')).toBeInTheDocument();
  });

  /**
   * A jump forward would route straight around the required gate below — which is the same hole the
   * collapsed disclosures left open, reopened from the other side. Caught by mutation: removing the
   * `disabled` left all 28 sheet tests green.
   */
  it('will not let the progress bar jump to a step the guest has not reached', async () => {
    await openSheet(COMPLEX);

    const segments = screen.getAllByRole('button', { name: /^step_n_of_m:/ });
    expect(segments[0]).toBeEnabled();
    expect(segments.slice(1).every((segment) => segment.hasAttribute('disabled'))).toBe(true);

    advance();
    expect(screen.getAllByRole('button', { name: /^step_n_of_m:/ })[1]).toBeEnabled();
    expect(screen.getAllByRole('button', { name: /^step_n_of_m:/ })[2]).toBeDisabled();
  });

  it('offers a way back to any step that was skipped', async () => {
    await openSheet(COMPLEX);

    for (let step = 0; step < 4; step += 1) advance();

    fireEvent.click(screen.getAllByRole('button', { name: /step_change_named:sauces/ })[0]);
    expect(screen.getByRole('checkbox', { name: /Garlic sauce/ })).toBeInTheDocument();
  });
});

describe('the always-offered drinks step', () => {
  const DRINKS = [{ id: 'cola', name: 'Cola', price: 3.5 }];
  /** No beverages group of its own — the case the admin did NOT curate. */
  const NO_BEVERAGES = { ...COMPLEX, id: 'p4', suggestedSideItems: [] };

  it('offers the whole beverage list on a dish whose admin attached none', async () => {
    await openSheet(NO_BEVERAGES, upsell(DRINKS));

    advance(); // variations -> ingredients
    advance(); // ingredients -> sauces
    advance(); // sauces -> drinks
    expect(screen.getByText('Cola')).toBeInTheDocument();
    expect(screen.getByText('step_drinks_hint')).toBeInTheDocument();
  });

  /**
   * The admin's curation wins where it exists: COMPLEX already offers a Cola as a suggested SIDE,
   * so a second generic drinks step would ask the same question twice with two different payloads.
   */
  it('stays out of the way when the dish already curates a beverages group', async () => {
    await openSheet(COMPLEX, upsell(DRINKS));

    for (let step = 0; step < 4; step += 1) advance();
    expect(screen.getByRole('button', { name: /add_to_order/ })).toBeInTheDocument();
    expect(screen.queryByText('step_drinks_hint')).not.toBeInTheDocument();
  });

  /**
   * The drinks are separate basket lines and never enter `useLinePrice` — but the guest is about to
   * be charged for both, so the button must name the sum they will actually pay.
   */
  it('names the sum of the LINE and the chosen drinks on the Add button', async () => {
    await openSheet(NO_BEVERAGES, upsell(DRINKS, 3.5));

    for (let step = 0; step < 4; step += 1) advance();
    // The dish is 12.00 and the chosen drink 3.50; a button that showed 12.00 would under-quote.
    expect(screen.getByRole('button', { name: /add_to_order/ })).toHaveTextContent('15.50');
  });

  it('adds no step at all when the beverage list came back empty', async () => {
    await openSheet(NO_BEVERAGES, upsell([]));

    advance();
    advance();
    advance(); // sauces -> review, with no drinks step in between
    expect(screen.getByRole('button', { name: /add_to_order/ })).toBeInTheDocument();
  });
});

describe('the fixes the first review found', () => {
  const DRINKS = [{ id: 'cola', name: 'Cola', price: 3.5 }];
  const NO_BEVERAGES = { ...COMPLEX, id: 'p5', suggestedSideItems: [] };

  /**
   * The drinks step is a *content* step, so before this it fed the `≥2 content steps ⇒ guided`
   * rule and turned every one-decision dish in the catalogue into a wizard — the exact opposite of
   * the decision the whole redesign turns on.
   */
  it('never lets the drinks step be the thing that CREATES a guided flow', async () => {
    await openSheet(SIMPLE, upsell(DRINKS));

    expect(screen.queryByRole('navigation', { name: 'step_progress' })).not.toBeInTheDocument();
    expect(screen.queryByText('step_drinks_hint')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add_to_order/ })).toBeInTheDocument();
  });

  /**
   * The beverage list arrives on a network round trip. Letting it change the step list mid-view
   * slid a new step in underneath the guest: the panel they were reading swapped content and the
   * priced Add they were about to press became Continue.
   */
  it('freezes the step list at open — a late drinks list does not move the guest', async () => {
    const { rerender } = await openSheetWith(NO_BEVERAGES, upsell([]));

    for (let step = 0; step < 3; step += 1) advance();
    expect(screen.getByRole('button', { name: /add_to_order/ })).toBeInTheDocument();

    // The fetch lands while the guest is on the review.
    rerender(<Harness drinks={upsell(DRINKS)} />);
    expect(screen.getByRole('button', { name: /add_to_order/ })).toBeInTheDocument();
    expect(screen.queryByText('step_drinks_hint')).not.toBeInTheDocument();
  });

  /**
   * A blocked item is still an item to READ — and `openForProductId` forces the sheet open for one
   * precisely so the guest can inspect it and switch channel. §9.10 refuses the ADD, not the
   * reading.
   */
  it('keeps a blocked item navigable, and still refuses the add on the last step', async () => {
    mockedNotice.mockReturnValue(BLOCKED_NOTICE);
    await openSheet({ ...COMPLEX, availability: { canOrder: false } });

    // Step one: the reason, the way out, AND a way to read the rest of the dish.
    expect(screen.getByText('Takeaway only')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'step_continue' }));
    expect(screen.getByRole('checkbox', { name: /Onion/ })).toBeInTheDocument();

    // …and the last step offers no Add at all.
    for (let step = 0; step < 3; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'step_continue' }));
    }
    expect(screen.queryByRole('button', { name: /add_to_order/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'step_continue' })).not.toBeInTheDocument();
    expect(screen.getByText('Takeaway only')).toBeInTheDocument();
  });

  /**
   * Reachable only from the review: the guest satisfies the gate, walks on, comes back via Change,
   * un-satisfies it, then returns to the review through the progress bar (every segment is enabled
   * once reached). Add used to be a dead control there — no message, no navigation, no request.
   */
  it('sends Add to the unsatisfied step instead of doing nothing', async () => {
    await openSheet({ ...COMPLEX, id: 'p6', sauceMin: 1 });

    advance();
    advance();
    fireEvent.click(screen.getByRole('checkbox', { name: /Garlic sauce/ }));
    advance();
    advance();
    expect(screen.getByRole('button', { name: /add_to_order/ })).toBeInTheDocument();

    // Un-satisfy the gate from the review, then come back to the review.
    fireEvent.click(screen.getAllByRole('button', { name: /step_change_named:sauces/ })[0]);
    fireEvent.click(screen.getByRole('checkbox', { name: /Garlic sauce/ }));
    const segments = screen.getAllByRole('button', { name: /^step_n_of_m:/ });
    fireEvent.click(segments[segments.length - 1]);

    fireEvent.click(screen.getByRole('button', { name: /add_to_order/ }));
    expect(mockAddItem).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: /Garlic sauce/ })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('step_blocked_sauces');
  });
});
