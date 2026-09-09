import '@testing-library/jest-dom';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import SauceGroupSection from './SauceGroupSection';
import OptionalIngredientsSection from './OptionalIngredientsSection';
import type { ProductIngredient } from '@/types/menu';
import en from '@/locales/en.json';
import de from '@/locales/de.json';
import fr from '@/locales/fr.json';
import nl from '@/locales/nl.json';
import tr from '@/locales/tr.json';
import ar from '@/locales/ar.json';
import es from '@/locales/es.json';
// `it` would shadow jest's own `it`.
import itLocale from '@/locales/it.json';
import ru from '@/locales/ru.json';
import zh from '@/locales/zh.json';

/**
 * The guest sauces group (S6).
 *
 * What is pinned here is what a reviewer of the approved screen would check by hand: the group is
 * collapsed when the sheet opens (the sheet is full at 390px), the summary tells the guest what is
 * inside without expanding it, the widget follows the rule rather than an admin's choice, the
 * "max reached" state appears ONLY when the max is actually reached — the Stitch screen draws it at
 * 2 of 3, which is the artifact this file exists to refuse — and the money on a row is the money
 * the price mirror computed.
 */

/** A locale bundle is nested in places (`cashier`, `privacy_policy`), so the values are `unknown`. */
type LocaleBundle = Record<string, unknown>;
const bundles: Record<string, LocaleBundle> = { en, de, fr, nl, tr, ar, es, it: itLocale, ru, zh };
const copy = (bundle: LocaleBundle, key: string): string => String(bundle[key]);

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: Object.fromEntries(Object.entries(bundles).map(([lng, bundle]) => [lng, { translation: bundle }])),
    interpolation: { escapeValue: false },
  });
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

const sauce = (id: string, name: string, displayOrder: number, extra: Partial<ProductIngredient> = {}) =>
  ({
    id,
    name,
    displayOrder,
    price: 0.5,
    isOptional: true,
    isActive: true,
    kind: 'sauce',
    maxQuantity: 1,
    ...extra,
  }) satisfies ProductIngredient;

const SAUCES: ProductIngredient[] = [
  sauce('salsa', 'Tomato Salsa', 1),
  sauce('mayo', 'Garlic Mayo', 2),
  sauce('bbq', 'BBQ Sauce', 3),
];

function renderGroup(props: Partial<React.ComponentProps<typeof SauceGroupSection>> = {}) {
  const onSelectionChange = jest.fn();
  const onQuantityChange = jest.fn();
  const view = render(
    <SauceGroupSection
      ingredients={SAUCES}
      rule={{ min: 0, max: 3, includedFree: 1 }}
      selectedIngredients={[]}
      ingredientQuantities={{}}
      onSelectionChange={onSelectionChange}
      onQuantityChange={onQuantityChange}
      currentLanguage="en"
      {...props}
    />,
  );
  return { ...view, onSelectionChange, onQuantityChange };
}

/** The disclosure is the only control carrying `aria-expanded`, in any locale. */
const expand = () => fireEvent.click(screen.getByRole('button', { expanded: false }));

describe('SauceGroupSection — the collapsed state', () => {
  it('starts collapsed, and says what is inside without being opened', () => {
    renderGroup();

    const toggle = screen.getByRole('button', { name: /Sauces/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('1 included, 3 available')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Tomato Salsa/i })).not.toBeInTheDocument();
  });

  it('counts what the guest has chosen once they have chosen it', () => {
    renderGroup({ selectedIngredients: ['salsa', 'mayo'] });
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('drops the "included" half of the summary when nothing is free', () => {
    renderGroup({ rule: { min: 0, max: 3, includedFree: 0 } });
    expect(screen.getByText('3 available')).toBeInTheDocument();
  });

  it('renders NOTHING at all — no group, no summary — for a product with no sauces', () => {
    const { container } = renderGroup({
      ingredients: [{ ...sauce('x', 'Onion', 1), kind: 'ingredient' }],
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when every sauce is inactive', () => {
    const { container } = renderGroup({ ingredients: [sauce('off', 'Retired Sauce', 1, { isActive: false })] });
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SauceGroupSection — the group semantics', () => {
  it('is a fieldset whose min/max is a group HINT, not a tooltip', () => {
    renderGroup();
    expand();

    const group = screen.getByRole('group');
    expect(within(group).getByText('Choose up to 3. The first is free.')).toBeInTheDocument();
    expect(group).toHaveAccessibleDescription('Choose up to 3. The first is free.');
  });

  it('states an exact choice as one number, and an open group as a minimum', () => {
    renderGroup({ rule: { min: 2, max: 2, includedFree: 0 } });
    expand();
    expect(screen.getByText('Choose 2.')).toBeInTheDocument();

    cleanup();
    renderGroup({ rule: { min: 1, max: null, includedFree: 2 } });
    expand();
    expect(screen.getByText('Choose at least 1. The first 2 are free.')).toBeInTheDocument();
  });

  it('derives checkboxes from a multi-select rule and radios from a rule that admits one', () => {
    renderGroup();
    expand();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4); // three sauces + "No sauce"

    cleanup();
    renderGroup({ rule: { min: 1, max: 1, includedFree: 1 } });
    expand();
    expect(screen.getAllByRole('radio')).toHaveLength(3); // no "No sauce": one is required
  });

  // FIRST, not last — the 2026-09 owner override of the sort-last rule (GOV.UK), recorded in the
  // component header. The way out leads the list, on products and bundle options alike.
  it('offers the exclusive "No sauce" answer FIRST, and clears the choice through it', () => {
    const { onSelectionChange, onQuantityChange } = renderGroup({ selectedIngredients: ['salsa'] });
    expand();

    const options = screen.getAllByRole('checkbox');
    expect(options[0]).toHaveAccessibleName('No sauce');
    // …and the sauces follow in their own display order behind it.
    expect(options[1]).toHaveAccessibleName(/Tomato Salsa/);
    expect(options[3]).toHaveAccessibleName(/BBQ Sauce/);

    fireEvent.click(screen.getByRole('checkbox', { name: 'No sauce' }));
    expect(onSelectionChange).toHaveBeenCalledWith([]);
    // Quantity 0, not 1 — the kitchen ticket's "NO x" convention (issue #150).
    expect(onQuantityChange).toHaveBeenCalledWith('salsa', 0);
  });

  it('keeps the answer exclusive and always enabled — it is the way out of a full group', () => {
    const { onSelectionChange } = renderGroup({
      rule: { min: 0, max: 2, includedFree: 1 },
      selectedIngredients: ['salsa', 'mayo'],
    });
    expand();

    const none = screen.getByRole('checkbox', { name: 'No sauce' });
    // The sauces sit max-blocked; the answer does not — being blocked would dead-end the guest.
    expect(none).not.toHaveAttribute('aria-disabled');
    fireEvent.click(none);
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });
});

describe('SauceGroupSection — money and the max', () => {
  it('marks exactly the waived sauce as included, and charges the rest', () => {
    renderGroup({ selectedIngredients: ['salsa', 'mayo'] });
    expand();

    const salsa = screen.getByRole('checkbox', { name: /Tomato Salsa/ }).closest('label') as HTMLElement;
    const mayo = screen.getByRole('checkbox', { name: /Garlic Mayo/ }).closest('label') as HTMLElement;
    expect(within(salsa).getByText('Included')).toBeInTheDocument();
    expect(within(mayo).getByText('+CHF 0.50')).toBeInTheDocument();
  });

  it('does NOT say "max reached" while the guest can still choose — the screen draws it at 2 of 3', () => {
    renderGroup({ selectedIngredients: ['salsa', 'mayo'] });
    expand();

    expect(screen.queryByText(/Max 3 reached/)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /BBQ Sauce/ })).not.toHaveAttribute('aria-disabled');
  });

  it('blocks the remaining sauces with aria-disabled, never `disabled`, once the max IS reached', () => {
    const { onSelectionChange } = renderGroup({
      rule: { min: 0, max: 2, includedFree: 1 },
      selectedIngredients: ['salsa', 'mayo'],
    });
    expand();

    const bbq = screen.getByRole('checkbox', { name: /BBQ Sauce/ });
    expect(bbq).toHaveAttribute('aria-disabled', 'true');
    expect(bbq).toBeEnabled();
    expect(screen.getByText('Max 2 reached')).toBeInTheDocument();

    fireEvent.click(bbq);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('shows a refund on a sauce the base price already paid for', () => {
    renderGroup({
      ingredients: [sauce('aioli', 'Aioli', 1, { isIncludedInBasePrice: true })],
      selectedIngredients: [],
    });
    expand();
    expect(screen.getByText('-CHF 0.50')).toBeInTheDocument();
  });

  it('states a range when the rule has both a floor and a cap', () => {
    renderGroup({ rule: { min: 1, max: 3, includedFree: 0 } });
    expand();
    expect(screen.getByText('Choose between 1 and 3.')).toBeInTheDocument();
  });

  it('selects a sauce at quantity 1, leaving the other choices alone', () => {
    const { onSelectionChange, onQuantityChange } = renderGroup({ selectedIngredients: ['salsa'] });
    expand();

    fireEvent.click(screen.getByRole('checkbox', { name: /Garlic Mayo/ }));

    expect(onSelectionChange).toHaveBeenCalledWith(['salsa', 'mayo']);
    expect(onQuantityChange).toHaveBeenCalledWith('mayo', 1);
  });

  it('unticks a chosen sauce with quantity 0 — the kitchen ticket convention', () => {
    const { onSelectionChange, onQuantityChange } = renderGroup({ selectedIngredients: ['salsa'] });
    expand();

    fireEvent.click(screen.getByRole('checkbox', { name: /Tomato Salsa/ }));

    expect(onSelectionChange).toHaveBeenCalledWith([]);
    expect(onQuantityChange).toHaveBeenCalledWith('salsa', 0);
  });

  it('replaces the choice, and zeroes the one it replaced, in a radio group', () => {
    const { onSelectionChange, onQuantityChange } = renderGroup({
      rule: { min: 1, max: 1, includedFree: 1 },
      selectedIngredients: ['salsa'],
    });
    expand();

    fireEvent.click(screen.getByRole('radio', { name: /Garlic Mayo/ }));

    expect(onSelectionChange).toHaveBeenCalledWith(['mayo']);
    expect(onQuantityChange).toHaveBeenCalledWith('salsa', 0);
    expect(onQuantityChange).toHaveBeenCalledWith('mayo', 1);
  });

  it('says nothing beside a chosen sauce the base price already covers', () => {
    renderGroup({
      ingredients: [sauce('aioli', 'Aioli', 1, { isIncludedInBasePrice: true })],
      selectedIngredients: ['aioli'],
    });
    expand();

    const row = screen.getByRole('checkbox', { name: /Aioli/ }).closest('label') as HTMLElement;
    expect(within(row).queryByText(/CHF/)).not.toBeInTheDocument();
    expect(within(row).queryByText('Included')).not.toBeInTheDocument();
  });

  // The behaviour a single-choice group depends on: a chosen radio cannot be un-chosen by clicking
  // it (the browser fires no change event), so the ONLY way out of a chosen sauce is either another
  // sauce or the "no sauce" answer — which is why that answer exists exactly when none is required.
  it('cannot be emptied by re-clicking the chosen radio answer', () => {
    const { onSelectionChange } = renderGroup({
      rule: { min: 1, max: 1, includedFree: 1 },
      selectedIngredients: ['salsa'],
    });
    expand();

    fireEvent.click(screen.getByRole('radio', { name: /Tomato Salsa/ }));
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('radio', { name: 'No sauce' })).not.toBeInTheDocument();
  });

  it('shows a sauce the dish always carries as included, and refuses to untick it', () => {
    const { onSelectionChange } = renderGroup({
      ingredients: [sauce('house', 'House Sauce', 1, { isOptional: false })],
      selectedIngredients: ['house'],
    });
    expand();

    const row = screen.getByRole('checkbox', { name: /House Sauce/ });
    expect(row).toHaveAttribute('aria-disabled', 'true');
    expect(within(row.closest('label') as HTMLElement).getByText('Included')).toBeInTheDocument();

    fireEvent.click(row);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('says nothing on the right of a free sauce', () => {
    renderGroup({ ingredients: [sauce('free', 'Ketchup', 1, { price: 0 })], selectedIngredients: [] });
    expand();

    const row = screen.getByRole('checkbox', { name: /Ketchup/ }).closest('label') as HTMLElement;
    expect(within(row).queryByText(/CHF/)).not.toBeInTheDocument();
  });
});

describe('SauceGroupSection — bundles inherit it, products do not lose their ingredients', () => {
  it('renders the group from inside OptionalIngredientsSection, with sauces out of the ingredient list', () => {
    render(
      <OptionalIngredientsSection
        ingredients={[
          { id: 'cheese', name: 'Cheese', price: 1, isOptional: true, isActive: true, displayOrder: 1 },
          ...SAUCES,
        ]}
        selectedIngredients={[]}
        ingredientQuantities={{}}
        onSelectionChange={jest.fn()}
        onQuantityChange={jest.fn()}
        currentLanguage="en"
        sauceGroup={{ sauceMin: 0, sauceMax: 3, sauceIncludedFree: 1 }}
      />,
    );

    expect(screen.getByRole('checkbox', { name: /Cheese/ })).toBeInTheDocument();
    // A sauce is NOT offered a second time among the optional ingredients.
    expect(screen.queryByRole('checkbox', { name: /Garlic Mayo/ })).not.toBeInTheDocument();
    expect(screen.getByText('1 included, 3 available')).toBeInTheDocument();
  });

  it('degrades to no cap and no allowance when the option carries no rule at all', () => {
    render(
      <OptionalIngredientsSection
        ingredients={SAUCES}
        selectedIngredients={['salsa', 'mayo', 'bbq']}
        ingredientQuantities={{}}
        onSelectionChange={jest.fn()}
        onQuantityChange={jest.fn()}
        currentLanguage="en"
      />,
    );
    expand();
    expect(screen.queryByText(/Max/)).not.toBeInTheDocument();
    expect(screen.queryByText('Included')).not.toBeInTheDocument();
  });
});

describe('SauceGroupSection — every locale it ships in', () => {
  const SUMMARIES: Record<string, string> = {
    en: '1 included, 3 available',
    de: '1 inklusive, 3 verfügbar',
    fr: '1 incluse, 3 disponibles',
    nl: '1 inbegrepen, 3 beschikbaar',
    tr: '1 dahil, 3 mevcut',
    ar: '1 مشمولة، 3 متاحة',
    es: '1 incluida, 3 disponibles',
    it: '1 inclusa, 3 disponibili',
    ru: '1 включено, 3 доступно',
    zh: '1 种包含，3 种可选',
  };

  it.each(Object.keys(bundles))('renders the collapsed summary and the group hint in %s', async (lng) => {
    await i18n.changeLanguage(lng);
    renderGroup();

    expect(screen.getByText(SUMMARIES[lng])).toBeInTheDocument();
    expand();

    const bundle = bundles[lng];
    const hint = `${copy(bundle, 'sauces_hint_up_to').replace('{{max}}', '3')} ${copy(bundle, 'sauces_hint_first_free')}`;
    expect(screen.getByText(hint)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: copy(bundle, 'sauce_none') })).toBeInTheDocument();
  });
});

describe('SauceGroupSection — stored exclusive no-sauce answers', () => {
  const none = sauce('none', 'Without sauce', 4, { isNoneOption: true, price: 0 });
  const otherNone = sauce('other-none', 'Plain', 5, { isNoneOption: true, price: 0 });
  const onion = { ...sauce('onion', 'Onion', 0), kind: 'ingredient' as const };

  function InteractiveGroup({
    initialSelected,
    initialQuantities,
    ingredients = [onion, ...SAUCES, none, otherNone],
  }: {
    initialSelected: string[];
    initialQuantities: Record<string, number>;
    ingredients?: ProductIngredient[];
  }) {
    const [selected, setSelected] = useState(initialSelected);
    const [quantities, setQuantities] = useState(initialQuantities);
    return (
      <>
        <SauceGroupSection
          ingredients={ingredients}
          rule={{ min: 1, max: 3, includedFree: 0 }}
          selectedIngredients={selected}
          ingredientQuantities={quantities}
          onSelectionChange={setSelected}
          onQuantityChange={(id, quantity) => setQuantities((previous) => ({ ...previous, [id]: quantity }))}
          currentLanguage="en"
          variant="plain"
        />
        <output data-testid="selection">{JSON.stringify(selected)}</output>
        <output data-testid="quantities">{JSON.stringify(quantities)}</output>
      </>
    );
  }

  it('selects no-sauce, unticks all previous sauces and zeroes all their quantities', () => {
    render(
      <InteractiveGroup
        initialSelected={['onion', 'salsa', 'mayo']}
        initialQuantities={{ onion: 2, salsa: 3, mayo: 2 }}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Without sauce' }));
    expect(screen.getByRole('checkbox', { name: 'Without sauce' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Tomato Salsa/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Garlic Mayo/ })).not.toBeChecked();
    expect(JSON.parse(screen.getByTestId('selection').textContent!)).toEqual(['onion', 'none']);
    expect(JSON.parse(screen.getByTestId('quantities').textContent!)).toEqual({ onion: 2, salsa: 0, mayo: 0, none: 1 });
  });

  it('selects a normal sauce, unticks all no-sauce answers and zeroes their quantities', () => {
    render(
      <InteractiveGroup
        initialSelected={['onion', 'none', 'other-none']}
        initialQuantities={{ onion: 2, none: 2, 'other-none': 1 }}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Garlic Mayo/ }));
    expect(screen.getByRole('checkbox', { name: /Garlic Mayo/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Without sauce' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Plain' })).not.toBeChecked();
    expect(JSON.parse(screen.getByTestId('selection').textContent!)).toEqual(['onion', 'mayo']);
    expect(JSON.parse(screen.getByTestId('quantities').textContent!)).toEqual({
      onion: 2,
      none: 0,
      'other-none': 0,
      mayo: 1,
    });
  });

  it('keeps legacy multi-select even when an unflagged row has a no-sauce name', () => {
    render(
      <InteractiveGroup
        ingredients={[...SAUCES, { ...none, isNoneOption: undefined }]}
        initialSelected={['salsa']}
        initialQuantities={{ salsa: 2 }}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Without sauce' }));
    expect(screen.getByRole('checkbox', { name: /Tomato Salsa/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Without sauce' })).toBeChecked();
    expect(JSON.parse(screen.getByTestId('selection').textContent!)).toEqual(['salsa', 'none']);
    expect(JSON.parse(screen.getByTestId('quantities').textContent!)).toEqual({ salsa: 2, none: 1 });
  });

  it('keeps the existing max and aria-disabled guard for a flagged answer', () => {
    const { onSelectionChange, onQuantityChange } = renderGroup({
      ingredients: [...SAUCES, none],
      rule: { min: 0, max: 2, includedFree: 0 },
      selectedIngredients: ['salsa', 'mayo'],
      ingredientQuantities: { salsa: 1, mayo: 1 },
    });
    expand();
    const answer = screen.getByRole('checkbox', { name: /Without sauce/ });
    expect(answer).toHaveAttribute('aria-disabled', 'true');
    expect(answer).toBeEnabled();
    fireEvent.click(answer);
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onQuantityChange).not.toHaveBeenCalled();
  });
});

describe('SauceGroupSection — the built-in no-sauce answer is never blocked by the max', () => {
  /**
   * The built-in row is the EXCLUSIVE answer, not a member of the group: blocking it at the max
   * would strand a guest who wants to back out to zero with no way to get there (partner report,
   * mcdoner). These pin what the code already does, so a future "block everything at the max"
   * refactor cannot take the way out silently.
   */
  it('leaves the built-in row reachable at the max, and it clears EVERY selected sauce (checkbox)', () => {
    const { onSelectionChange, onQuantityChange } = renderGroup({
      rule: { min: 0, max: 2, includedFree: 1 },
      selectedIngredients: ['salsa', 'mayo'],
    });
    expand();

    // Contrast within the same render: members are blocked, the exclusive answer is not.
    expect(screen.getByRole('checkbox', { name: /BBQ Sauce/ })).toHaveAttribute('aria-disabled', 'true');
    const none = screen.getByRole('checkbox', { name: 'No sauce' });
    expect(none).not.toHaveAttribute('aria-disabled');
    expect(none).toBeEnabled();

    fireEvent.click(none);
    expect(onSelectionChange).toHaveBeenCalledWith([]);
    // Quantity 0 for EVERY selected sauce, not just the last — the kitchen ticket's "NO x".
    expect(onQuantityChange).toHaveBeenCalledWith('salsa', 0);
    expect(onQuantityChange).toHaveBeenCalledWith('mayo', 0);
  });

  it('leaves the built-in row reachable at the max, and it clears the choice (radio)', () => {
    const { onSelectionChange, onQuantityChange } = renderGroup({
      rule: { min: 0, max: 1, includedFree: 1 },
      selectedIngredients: ['salsa'],
    });
    expand();

    const none = screen.getByRole('radio', { name: 'No sauce' });
    expect(none).not.toHaveAttribute('aria-disabled');
    expect(none).toBeEnabled();

    fireEvent.click(none);
    expect(onSelectionChange).toHaveBeenCalledWith([]);
    expect(onQuantityChange).toHaveBeenCalledWith('salsa', 0);
  });

  it('empties real state through the built-in row while the group sits at its max', () => {
    function MaxedGroup() {
      const [selected, setSelected] = useState(['salsa', 'mayo']);
      const [quantities, setQuantities] = useState<Record<string, number>>({ salsa: 2, mayo: 1 });
      return (
        <>
          <SauceGroupSection
            ingredients={SAUCES}
            rule={{ min: 0, max: 2, includedFree: 0 }}
            selectedIngredients={selected}
            ingredientQuantities={quantities}
            onSelectionChange={setSelected}
            onQuantityChange={(id, quantity) => setQuantities((previous) => ({ ...previous, [id]: quantity }))}
            currentLanguage="en"
          />
          <output data-testid="selection">{JSON.stringify(selected)}</output>
          <output data-testid="quantities">{JSON.stringify(quantities)}</output>
        </>
      );
    }

    render(<MaxedGroup />);
    expand();

    fireEvent.click(screen.getByRole('checkbox', { name: 'No sauce' }));
    expect(screen.getByRole('checkbox', { name: 'No sauce' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Tomato Salsa/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Garlic Mayo/ })).not.toBeChecked();
    expect(JSON.parse(screen.getByTestId('selection').textContent!)).toEqual([]);
    expect(JSON.parse(screen.getByTestId('quantities').textContent!)).toEqual({ salsa: 0, mayo: 0 });
  });
});
