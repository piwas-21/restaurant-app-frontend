import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ItemCustomizationSheet from './ItemCustomizationSheet';
import { useBundleCustomizationSheet } from '@/hooks/menu/useBundleCustomizationSheet';
import type { DetailedIngredient, MenuBundleItem, MenuSection } from '@/types/menu';

/**
 * The per-option customization SCREEN end to end (the 2026-09 owner decision superseding #175's
 * inline drill-in): tapping Customize on a selected bundle option navigates the sheet to a guided
 * flow of the option's own — the SAME step machinery the product flow runs (ingredients, then
 * sauces as their own step, special request last) — and back again with the selection intact and
 * the bundle total priced live.
 *
 * Driven through the REAL controller and the REAL screen, like `bundleIntro.test.tsx` drives its
 * controller: the navigation, the state survival and the pricing are exactly the things a
 * hand-built controller would agree with by construction.
 */

jest.mock('@/components/cart/CartContext', () => ({
  useCart: () => ({ addItem: jest.fn().mockResolvedValue(undefined) }),
}));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));
jest.mock('@/hooks/menu/useItemAvailabilityNotice', () => ({
  useItemAvailabilityNotice: jest.fn(() => null),
}));

const _mockAddItem = jest.requireMock('@/components/cart/CartContext').useCart().addItem as jest.Mock;

const ingredient = (id: string, extra: Partial<DetailedIngredient> = {}): DetailedIngredient => ({
  id,
  name: id,
  price: 0,
  isOptional: true,
  isIncludedInBasePrice: false,
  isActive: true,
  displayOrder: 1,
  maxQuantity: 1,
  ...extra,
});

/** A paid sauce and a paid extra, so every money assertion has something real to read. */
const BURGER_INGREDIENTS: DetailedIngredient[] = [
  ingredient('onion', { isOptional: false, isIncludedInBasePrice: true }),
  ingredient('salsa', { kind: 'sauce', price: 1.5, displayOrder: 1 }),
  ingredient('mayo', { kind: 'sauce', price: 1.5, displayOrder: 2 }),
  ingredient('bacon', { price: 3, displayOrder: 3 }),
];

const mainSection: MenuSection = {
  id: 'main',
  name: 'Main',
  displayOrder: 1,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  items: [
    {
      id: 'si-burger',
      productId: 'burger',
      productName: 'Burger',
      additionalPrice: 4,
      displayOrder: 1,
      isDefault: true,
      detailedIngredients: BURGER_INGREDIENTS,
      sauceMin: 0,
      sauceMax: 2,
      sauceIncludedFree: 0,
    },
    {
      id: 'si-wrap',
      productId: 'wrap',
      productName: 'Wrap',
      additionalPrice: 0,
      displayOrder: 2,
      isDefault: false,
    },
  ],
};

const drinkSection: MenuSection = {
  id: 'drink',
  name: 'Drink',
  displayOrder: 2,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  items: [
    { id: 'si-coke', productId: 'coke', productName: 'Coke', additionalPrice: 0, displayOrder: 1, isDefault: false },
    { id: 'si-water', productId: 'water', productName: 'Water', additionalPrice: 1, displayOrder: 2, isDefault: false },
  ],
};

const BUNDLE: MenuBundleItem = {
  id: 'combo',
  name: 'Lunch Combo',
  content: { en: { name: 'Lunch Combo', description: '' } },
  basePrice: 20,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  displayOrder: 1,
  menuDefinition: {
    id: 'md',
    isAlwaysAvailable: true,
    availableMonday: true,
    availableTuesday: true,
    availableWednesday: true,
    availableThursday: true,
    availableFriday: true,
    availableSaturday: true,
    availableSunday: true,
    sections: [mainSection, drinkSection],
  },
};

function Harness({ bundle }: Readonly<{ bundle: MenuBundleItem }>) {
  const controller = useBundleCustomizationSheet({ onAdded: jest.fn(), onLineAdded: jest.fn() });
  (Harness as unknown as { open: () => void }).open = () => controller.openForBundle(bundle);
  return <ItemCustomizationSheet controller={controller} />;
}

async function openSheet(bundle: MenuBundleItem = BUNDLE) {
  const rendered = render(<Harness bundle={bundle} />);
  await act(async () => {
    (Harness as unknown as { open: () => void }).open();
  });
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  return rendered;
}

/** Tap Customize on the selected burger; the sheet navigates to the option's guided screen. */
async function openOptionScreen() {
  fireEvent.click(screen.getByRole('button', { name: 'customize' }));
  await waitFor(() => expect(screen.getByText('customize_ingredients')).toBeInTheDocument());
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Customize navigates to the option’s guided screen', () => {
  it('shows the option’s steps — ingredients, sauces, special request — one at a time', async () => {
    await openSheet();
    await openOptionScreen();

    // Ingredients first, sauces as their OWN step, the special request LAST.
    expect(screen.getByText('customize_ingredients')).toBeInTheDocument();
    expect(screen.queryByText('sauces')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'step_skip_ingredients' }));
    expect(screen.getByText('sauces')).toBeInTheDocument();
    expect(screen.queryByText('customize_ingredients')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'sauce_none' }));
    expect(screen.getAllByText('product_special_requests').length).toBeGreaterThan(0);
  });

  it('leaves the Customize affordance on the row and offers it only for a selected option', async () => {
    await openSheet();

    // The burger is selected and carries ingredients; the Wrap is not picked at all; the drinks
    // are on the NEXT step of the bundle flow, not on screen yet.
    expect(screen.getByRole('button', { name: 'customize' })).toBeInTheDocument();
  });

  it('gives an option with nothing to customize no affordance at all', async () => {
    await openSheet();

    // The Wrap has no ingredients and is not selected; even selected it would offer nothing.
    fireEvent.click(screen.getByRole('radio', { name: /Wrap/ }));
    expect(screen.queryByRole('button', { name: 'customize' })).not.toBeInTheDocument();
  });
});

describe('the way back keeps every selection', () => {
  it('returns to the bundle sheet with the ticked sauce intact, and re-opens onto it', async () => {
    await openSheet();
    await openOptionScreen();

    fireEvent.click(screen.getByRole('button', { name: 'step_skip_ingredients' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /salsa/ }));

    // Back to the bundle sheet — the line is still open, the sauce is stored in it.
    fireEvent.click(screen.getByRole('button', { name: /^back/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'customize' })).toBeInTheDocument());
    expect(screen.queryByText('sauces')).not.toBeInTheDocument();

    // Re-open: the guided screen resumes, the sauce is still ticked.
    await openOptionScreen();
    fireEvent.click(screen.getByRole('button', { name: 'step_skip_ingredients' }));
    expect(screen.getByRole('checkbox', { name: /salsa/ })).toBeChecked();
  });

  it('walks back a step on the progress rail without losing the step before it', async () => {
    await openSheet();
    await openOptionScreen();

    fireEvent.click(screen.getByRole('checkbox', { name: /bacon/ }));
    fireEvent.click(screen.getByRole('button', { name: 'step_continue' }));
    expect(screen.getByText('sauces')).toBeInTheDocument();

    // Back one step — the bacon tick survives the walk.
    fireEvent.click(screen.getByRole('button', { name: 'step_back' }));
    expect(screen.getByText('customize_ingredients')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /bacon/ })).toBeChecked();
  });
});

describe('live pricing is carried on every step', () => {
  it('shows the bundle’s advertised total, and ticks a paid sauce straight into it', async () => {
    await openSheet();
    // The seeded line: 20 base + 4 burger surcharge, delta 0 — the advertised price.
    expect(screen.getAllByText(/24[.,]00/).length).toBeGreaterThan(0);

    await openOptionScreen();
    fireEvent.click(screen.getByRole('button', { name: 'step_skip_ingredients' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /salsa/ }));

    // The option screen's footer prices the bundle line live: +1.50 for the sauce.
    expect(screen.getAllByText(/25[.,]50/).length).toBeGreaterThan(0);
  });

  it('returns to the bundle flow with the price intact, and the payload carries the sauce', async () => {
    await openSheet();
    await openOptionScreen();
    fireEvent.click(screen.getByRole('button', { name: 'step_skip_ingredients' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /salsa/ }));
    fireEvent.click(screen.getByRole('button', { name: 'step_continue' }));

    // Done commits back into the line — the bundle total keeps the +1.50.
    fireEvent.click(screen.getByRole('button', { name: 'done' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'customize' })).toBeInTheDocument());
    expect(screen.getAllByText(/25[.,]50/).length).toBeGreaterThan(0);
  });
});

describe('the no-sauce answer on the option screen', () => {
  it('leads the sauce list and clears the choice through it', async () => {
    await openSheet();
    await openOptionScreen();
    fireEvent.click(screen.getByRole('button', { name: 'step_skip_ingredients' }));

    const options = screen.getAllByRole('checkbox');
    expect(options[0]).toHaveAccessibleName('sauce_none');

    fireEvent.click(screen.getByRole('checkbox', { name: /salsa/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'sauce_none' }));
    expect(screen.getByRole('checkbox', { name: /salsa/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'sauce_none' })).toBeChecked();
  });
});

/**
 * The guided walk (partner feedback 2026-09): the primary path into an option's screens is the
 * PICK — no Customize tap. A single-choice section opens the screens the moment the row is
 * chosen; a multi-select section walks its picked options when the guest Continues. Customize
 * stays only as the way BACK into a visited option.
 */
// Factories, not repeated literals: Sonar's duplication gate reads the PR delta, and several
// near-identical bundle builders in this file crossed its threshold on the first cut.
const bundleWithSections = (sections: MenuSection[]): MenuBundleItem => ({
  ...BUNDLE,
  menuDefinition: { ...BUNDLE.menuDefinition, sections },
});
const pickableBurgerSection = (): MenuSection => ({
  ...mainSection,
  items: [{ ...mainSection.items[0], isDefault: false }, mainSection.items[1]],
});
/** ONE required item named Plat — the exact shape `isFixedPlatSection` collapses (P3). */
const fixedPlatSection = (): MenuSection => ({
  ...mainSection,
  name: 'Plat',
  items: [{ ...mainSection.items[0], isDefault: false }],
});

describe('the guided walk — selection opens the screens by itself', () => {
  /** The burger is NOT the section default, so picking it is a real guest action. */
  const OPEN_BUNDLE = bundleWithSections([pickableBurgerSection(), drinkSection]);

  it('a single-choice pick advances straight into the option\u2019s screens — no Customize tap', async () => {
    await openSheet(OPEN_BUNDLE);

    expect(screen.queryByText('customize_ingredients')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Burger/ }));

    await waitFor(() => expect(screen.getByText('customize_ingredients')).toBeInTheDocument());
    // The navigation replaced the section rows — the Customize affordance is not on this screen.
    expect(screen.queryByRole('button', { name: 'customize' })).not.toBeInTheDocument();
  });

  it('Done at the end of the walk advances the SECTION flow past the answered section', async () => {
    await openSheet(OPEN_BUNDLE);
    fireEvent.click(screen.getByRole('radio', { name: /Burger/ }));
    await waitFor(() => expect(screen.getByText('customize_ingredients')).toBeInTheDocument());

    // Walk the option's own steps: ingredients → sauces → special request, then Done.
    fireEvent.click(screen.getByRole('button', { name: 'step_skip_ingredients' }));
    fireEvent.click(screen.getByRole('button', { name: 'sauce_none' }));
    await waitFor(() => expect(screen.getAllByText('product_special_requests').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'done' }));

    // The pick answered the section — the flow is on the NEXT section, not back on Main.
    await waitFor(() => expect(screen.getByText('Drink')).toBeInTheDocument());
    expect(screen.queryByText('customize_ingredients')).not.toBeInTheDocument();
  });

  it('Back out of a walked screen returns to the section with the pick intact', async () => {
    await openSheet(OPEN_BUNDLE);
    fireEvent.click(screen.getByRole('radio', { name: /Burger/ }));
    await waitFor(() => expect(screen.getByText('customize_ingredients')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^back/ }));
    await waitFor(() => expect(screen.getByRole('radio', { name: /Burger/ })).toBeChecked());
    // From here Customize is the way back in — the review path.
    expect(screen.getByRole('button', { name: 'customize' })).toBeInTheDocument();
  });

  it('a multi-select section walks its picked options in section order, starting at Continue', async () => {
    const walkItem = (productId: string, productName: string, displayOrder: number) => ({
      id: `si-${productId}`,
      productId,
      productName,
      additionalPrice: 0,
      displayOrder,
      isDefault: false,
      detailedIngredients: [BURGER_INGREDIENTS[0]],
    });
    const sidesSection: MenuSection = {
      id: 'sides',
      name: 'Sides',
      displayOrder: 2,
      isRequired: true,
      minSelection: 1,
      maxSelection: 2,
      items: [walkItem('fries', 'Fries', 1), walkItem('salad', 'Salad', 2)],
    };
    await openSheet(bundleWithSections([sidesSection, drinkSection]));

    // Finish selecting FIRST — ticking must not drag the guest off the rows.
    fireEvent.click(screen.getByRole('checkbox', { name: /Fries/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Salad/ }));
    expect(screen.queryByText('customize_ingredients')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'step_continue' }));
    await waitFor(() => expect(screen.getByText('customize_ingredients')).toBeInTheDocument());
    expect(screen.getByText('Fries')).toBeInTheDocument();

    // Walk the first option's own steps, then Done…
    fireEvent.click(screen.getByRole('button', { name: 'step_continue' }));
    await waitFor(() => expect(screen.getAllByText('product_special_requests').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'done' }));
    // …which opens the NEXT picked option's screens.
    await waitFor(() => expect(screen.getByText('Salad')).toBeInTheDocument());

    // …and the last Done advances past the section.
    fireEvent.click(screen.getByRole('button', { name: 'step_continue' }));
    await waitFor(() => expect(screen.getAllByText('product_special_requests').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'done' }));
    await waitFor(() => expect(screen.getByText('Drink')).toBeInTheDocument());
  });

  it('a fixed Plat\u2019s screens open when the guest Continues past its step', async () => {
    await openSheet(bundleWithSections([fixedPlatSection(), drinkSection]));

    expect(screen.queryByText('customize_ingredients')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'step_continue' }));
    await waitFor(() => expect(screen.getByText('customize_ingredients')).toBeInTheDocument());
  });
});

/** A recipe with nothing optional: every row is required, fully selected, nothing to choose. */
const NO_CHOICE_INGREDIENTS: DetailedIngredient[] = [
  ingredient('bread', { isOptional: false, isIncludedInBasePrice: true }),
  ingredient('meat', { isOptional: false, isIncludedInBasePrice: true }),
];

describe('the Continue-vs-\u201cNo extras\u201d rule on the option screen', () => {
  it('says Continue when the step\u2019s ingredients are all required — there is nothing to decline', async () => {
    const noChoiceSection: MenuSection = {
      ...mainSection,
      items: [
        { ...pickableBurgerSection().items[0], detailedIngredients: NO_CHOICE_INGREDIENTS, sauceMax: 0 },
        pickableBurgerSection().items[1],
      ],
    };
    await openSheet(bundleWithSections([noChoiceSection, drinkSection]));

    fireEvent.click(screen.getByRole('radio', { name: /Burger/ }));
    await waitFor(() => expect(screen.getByText('customize_ingredients')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'step_continue' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'step_skip_ingredients' })).not.toBeInTheDocument();
  });

  it('keeps "No extras" for a step whose optional extras the guest declines', async () => {
    await openSheet();
    await openOptionScreen();

    // The seeded step has optional extras in scope (bacon, sauces) — walking past unticked is a
    // real decline, and the verb names it.
    expect(screen.getByRole('button', { name: 'step_skip_ingredients' })).toBeInTheDocument();
  });
});

describe('fixed one-option Plat', () => {
  it('navigates to the guided screen where the redundant picker used to be', async () => {
    await openSheet(bundleWithSections([fixedPlatSection(), drinkSection]));

    expect(screen.queryByRole('radio', { name: /Burger/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'customize' }));
    await waitFor(() => expect(screen.getByText('customize_ingredients')).toBeInTheDocument());
  });
});
