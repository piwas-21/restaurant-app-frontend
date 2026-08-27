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
