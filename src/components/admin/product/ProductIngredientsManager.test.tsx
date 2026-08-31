import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ProductIngredientsManager } from './ProductIngredientsManager';
import { getGlobalIngredients, searchGlobalIngredients } from '@/services/globalIngredientService';
import { INGREDIENT_SUGGESTION_DEBOUNCE_MS } from '@/hooks/admin/useGlobalIngredientSuggestions';
import type { ProductIngredient } from '@/types/menu';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('@/services/globalIngredientService', () => ({
  getGlobalIngredients: jest.fn(),
  searchGlobalIngredients: jest.fn(),
  createGlobalIngredient: jest.fn(),
}));

const mockGetLibrary = getGlobalIngredients as jest.MockedFunction<typeof getGlobalIngredients>;
const mockSearch = searchGlobalIngredients as jest.MockedFunction<typeof searchGlobalIngredients>;

const mozzarella = {
  id: 'g-mozza',
  defaultName: 'Mozzarella',
  isActive: true,
  translations: [
    { languageCode: 'fr', name: 'Mozzarelle' },
    { languageCode: 'tr', name: 'Mozzarella peyniri' },
  ],
};

const existing: ProductIngredient = {
  id: 'ing-1',
  name: 'Olives',
  isOptional: false,
  price: 0,
  isActive: true,
  displayOrder: 0,
};

const onChange = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockGetLibrary.mockResolvedValue({ success: true, data: [mozzarella] } as never);
  mockSearch.mockResolvedValue({ success: true, data: [mozzarella] } as never);
});

const mount = (ingredients: ProductIngredient[] = [existing]) =>
  render(<ProductIngredientsManager ingredients={ingredients} onChange={onChange} productBasePrice={12} />);

describe('the library picker is reachable from the ingredients section', () => {
  // The single integration point of the whole slice: `editor.changeIngredients(next)`. Ingredients
  // are plain useState, not react-hook-form, so a whole-array replace is the contract.
  it('a picked row reaches onChange, appended to what the product already had', async () => {
    mount();

    fireEvent.click(screen.getByRole('button', { name: 'add_from_library' }));
    await screen.findByRole('checkbox', { name: /Mozzarella/ });

    fireEvent.click(screen.getByRole('checkbox', { name: /Mozzarella/ }));
    fireEvent.click(screen.getByRole('button', { name: /add_selected/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ProductIngredient[];
    expect(next.map((row) => row.name)).toEqual(['Olives', 'Mozzarella']);
    expect(next[1].globalIngredientId).toBe('g-mozza');
    expect(next[1].content?.fr?.name).toBe('Mozzarelle');
  });

  it('does not offer an ingredient the product already carries', async () => {
    mount([{ ...existing, name: 'Mozzarella' }]);

    fireEvent.click(screen.getByRole('button', { name: 'add_from_library' }));

    expect(await screen.findByRole('checkbox', { name: /Mozzarella/ })).toBeDisabled();
  });
});

describe('narrow-screen table labels', () => {
  it('puts a translated label on every mobile card field', () => {
    const { container } = mount();

    expect(Array.from(container.querySelectorAll('td[data-label]'), (cell) => cell.getAttribute('data-label'))).toEqual(
      ['reorder', 'name', 'ingredient_optional', 'max_quantity', 'additional_price', 'ingredient_included', 'actions'],
    );
  });
});

describe('the per-row type-ahead', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  // It used to `fetch()` `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113'` directly —
  // a hardcoded default port that is not even the one apiClient uses (5221), with no auth header
  // and no shared 401 refresh. This asserts the call now goes through the service.
  it('searches through the apiClient service, never a bare fetch', async () => {
    // jsdom ships no `fetch`, so there is nothing to spy on — installing one is also the only way
    // this assertion can fail: if the raw call came back, it would find this mock and call it.
    const bareFetch = jest.fn();
    Object.defineProperty(global, 'fetch', { value: bareFetch, configurable: true, writable: true });
    mount();

    fireEvent.change(screen.getByDisplayValue('Olives'), { target: { value: 'mozz' } });
    await act(async () => {
      jest.advanceTimersByTime(INGREDIENT_SUGGESTION_DEBOUNCE_MS);
    });

    expect(mockSearch).toHaveBeenCalledWith('mozz', 5);
    expect(bareFetch).not.toHaveBeenCalled();
  });

  it('copies the library row over the ingredient, provenance included', async () => {
    mount();

    fireEvent.change(screen.getByDisplayValue('Olives'), { target: { value: 'mozz' } });
    await act(async () => {
      jest.advanceTimersByTime(INGREDIENT_SUGGESTION_DEBOUNCE_MS);
    });
    onChange.mockClear();
    fireEvent.click(screen.getByText('Mozzarella'));

    const next = onChange.mock.calls[0][0] as ProductIngredient[];
    expect(next[0].name).toBe('Mozzarella');
    expect(next[0].globalIngredientId).toBe('g-mozza');
    expect(next[0].content?.tr?.name).toBe('Mozzarella peyniri');
    // Per-product facts are the product's, not the catalog's.
    expect(next[0].id).toBe('ing-1');
    expect(next[0].displayOrder).toBe(0);
  });
});

describe('a new ingredient still arrives with no seeded locales', () => {
  /**
   * A REGRESSION GUARD, not this slice's fix. The audit (§4.5) recorded that `handleAddIngredient`
   * seeded a blank `content` entry for SEVEN of the ten locales — `nl`, `ru` and `zh` were missing
   * from a hand-written literal that never consulted `LANGUAGE_CODES`, so the list drifted the day
   * a locale was added and stayed drifted. Looking for that literal to delete it, S4 found #588 had
   * already deleted it while splitting this component into groups. Nothing here changed; the
   * assertion is written down so the eleventh locale cannot re-arm the trap silently.
   *
   * It fails in both directions: the old code produced seven keys where this expects none, and a
   * "fix" that merely re-typed the literal as ten would fail it too.
   */
  it('carries no seeded translations at all, rather than seven of ten', () => {
    mount([]);

    fireEvent.click(screen.getByRole('button', { name: 'add_manually' }));

    const next = onChange.mock.calls[0][0] as ProductIngredient[];
    expect(next).toHaveLength(1);
    expect(next[0].content).toEqual({});
  });

  it('still mints a temporary id and the next display order', () => {
    mount();

    fireEvent.click(screen.getByRole('button', { name: 'add_manually' }));

    const next = onChange.mock.calls[0][0] as ProductIngredient[];
    expect(next[1].id).toMatch(/^temp-/);
    expect(next[1].displayOrder).toBe(1);
  });
});

describe('the per-row translation grid is gone (D2 / S4)', () => {
  const openRowDetail = () => {
    mount([{ ...existing, content: { fr: { name: 'Olives noires' } } }]);
    fireEvent.click(screen.getByRole('button', { name: 'ingredient_row_details' }));
  };

  /**
   * The last of the three rival translation UIs the workbench replaces. Assert the ABSENCE of the
   * inputs with the panel OPEN — a grid that is merely collapsed is still a second place to edit
   * the same string, and asserting on the closed row would pass against the old code.
   */
  it('opens the row detail on a text no locale input renders', () => {
    openRowDetail();

    // The panel really IS open — without this the three absence checks below pass on a closed row.
    expect(screen.getByRole('switch', { name: 'ingredient_is_active' })).toBeVisible();
    expect(screen.queryByDisplayValue('Olives noires')).toBeNull();
    expect(screen.queryByLabelText('language_fr')).toBeNull();
    expect(screen.queryByText('multilingual_names')).toBeNull();
  });

  /**
   * And the half of that panel that must SURVIVE. `isActive` has no control anywhere else on the
   * screen, so removing the panel wholesale would have made it unsettable — the editor's standing
   * trap, a shipped field the next save cannot change.
   */
  it('keeps the visibility switch the panel exists for', () => {
    openRowDetail();

    expect(screen.getByRole('switch', { name: 'ingredient_is_active' })).toBeChecked();
  });
});

describe('choice-group guard', () => {
  const openDetails = () => fireEvent.click(screen.getByRole('button', { name: 'ingredient_row_details' }));

  it('explains why a required ingredient cannot receive a choice group', () => {
    mount();
    openDetails();

    expect(screen.getByRole('textbox', { name: 'ingredient_choice_group' })).toBeDisabled();
    expect(screen.getByText('ingredient_choice_group_optional_required')).toBeInTheDocument();
  });

  it('enables the group field after Optional is turned on', () => {
    mount([{ ...existing, isOptional: true }]);
    openDetails();

    expect(screen.getByRole('textbox', { name: 'ingredient_choice_group' })).toBeEnabled();
    expect(screen.getByText('ingredient_choice_group_hint')).toBeInTheDocument();
  });

  it('clears a choice group when Optional is turned off, before save can reach the server', () => {
    mount([{ ...existing, isOptional: true, exclusionGroup: 'doneness' }]);

    fireEvent.click(screen.getByRole('switch', { name: 'ingredient_is_optional' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'ing-1', isOptional: false, exclusionGroup: null }),
    ]);
  });
});
