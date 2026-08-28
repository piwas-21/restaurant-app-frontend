import '@testing-library/jest-dom';
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

  it('offers the exclusive "No sauce" answer LAST, and clears the choice through it', () => {
    const { onSelectionChange, onQuantityChange } = renderGroup({ selectedIngredients: ['salsa'] });
    expand();

    const options = screen.getAllByRole('checkbox');
    expect(options[options.length - 1]).toHaveAccessibleName('No sauce');

    fireEvent.click(screen.getByRole('checkbox', { name: 'No sauce' }));
    expect(onSelectionChange).toHaveBeenCalledWith([]);
    // Quantity 0, not 1 — the kitchen ticket's "NO x" convention (issue #150).
    expect(onQuantityChange).toHaveBeenCalledWith('salsa', 0);
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
