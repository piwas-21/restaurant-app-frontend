import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useForm, type FieldValues } from 'react-hook-form';
import ProductRecipeGroups from './ProductRecipeGroups';
import { getGlobalIngredients } from '@/services/globalIngredientService';
import type { ProductIngredient } from '@/types/menu';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('@/services/globalIngredientService', () => ({
  getGlobalIngredients: jest.fn(),
  searchGlobalIngredients: jest.fn(async () => ({ success: true, data: [] })),
  createGlobalIngredient: jest.fn(),
}));

const mockLibrary = getGlobalIngredients as jest.MockedFunction<typeof getGlobalIngredients>;

const bbq = {
  id: 'g-bbq',
  defaultName: 'BBQ',
  isActive: true,
  translations: [{ languageCode: 'fr', name: 'Barbecue' }],
};

/** A row with NO `kind` — every ingredient on production is one of these, and it is an INGREDIENT. */
const olives: ProductIngredient = {
  id: 'ing-olives',
  name: 'Olives',
  isOptional: false,
  maxQuantity: 1,
  price: 0,
  isActive: true,
  displayOrder: 0,
};
const ketchup: ProductIngredient = { ...olives, id: 'ing-ketchup', name: 'Ketchup', kind: 'sauce', price: 1.25 };

const onChange = jest.fn();

/** Mounts the two groups against a real react-hook-form, which is what the sauce rules register on. */
function Harness({ ingredients, defaults }: Readonly<{ ingredients: ProductIngredient[]; defaults?: object }>) {
  const form = useForm<FieldValues>({
    defaultValues: { sauceMin: 0, sauceMax: null, sauceIncludedFree: 0, ...defaults },
  });
  return (
    <ProductRecipeGroups
      ingredients={ingredients}
      onChange={onChange}
      productBasePrice={12}
      register={form.register}
      control={form.control}
      errors={form.formState.errors}
    />
  );
}

const mount = (ingredients: ProductIngredient[] = [olives, ketchup], defaults?: object) =>
  render(<Harness ingredients={ingredients} defaults={defaults} />);

const groupOf = (name: 'ingredients' | 'sauces') => screen.getByRole('region', { name });

beforeEach(() => {
  jest.clearAllMocks();
  mockLibrary.mockResolvedValue({ success: true, data: [bbq] } as never);
});

describe('Recipe & dietary splits into Ingredients and Sauces', () => {
  it('renders both groups with the right rows — a row with NO kind is an ingredient', () => {
    mount();

    expect(within(groupOf('ingredients')).getByDisplayValue('Olives')).toBeInTheDocument();
    expect(within(groupOf('ingredients')).queryByDisplayValue('Ketchup')).not.toBeInTheDocument();
    expect(within(groupOf('sauces')).getByDisplayValue('Ketchup')).toBeInTheDocument();
    expect(within(groupOf('sauces')).queryByDisplayValue('Olives')).not.toBeInTheDocument();
  });

  it('shows the sauce rules inside the Sauces group and nowhere else', () => {
    mount();

    expect(within(groupOf('sauces')).getByLabelText('sauce_max_label')).toBeInTheDocument();
    expect(within(groupOf('ingredients')).queryByLabelText('sauce_max_label')).not.toBeInTheDocument();
  });

  it("a row added manually in Sauces lands with kind 'sauce', and in Ingredients with 'ingredient'", () => {
    mount();

    fireEvent.click(within(groupOf('sauces')).getByRole('button', { name: 'add_manually' }));
    const afterSauce = onChange.mock.calls[0][0] as ProductIngredient[];
    expect(afterSauce).toHaveLength(3);
    expect(afterSauce[2].kind).toBe('sauce');

    onChange.mockClear();
    fireEvent.click(within(groupOf('ingredients')).getByRole('button', { name: 'add_manually' }));
    const afterIngredient = onChange.mock.calls[0][0] as ProductIngredient[];
    expect(afterIngredient[2].kind).toBe('ingredient');
  });

  it('a row picked from the library in Sauces lands in Sauces', async () => {
    mount();

    fireEvent.click(within(groupOf('sauces')).getByRole('button', { name: 'add_from_library' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /BBQ/ }));
    fireEvent.click(screen.getByRole('button', { name: /add_selected/ }));

    const next = onChange.mock.calls[0][0] as ProductIngredient[];
    expect(next.map((row) => row.name)).toEqual(['Olives', 'Ketchup', 'BBQ']);
    expect(next[2].kind).toBe('sauce');
    // Still the whole point of the picker: the catalog's translations come with it.
    expect(next[2].content?.fr?.name).toBe('Barbecue');
  });

  it('a row picked from the library in Ingredients lands in Ingredients', async () => {
    mount();

    fireEvent.click(within(groupOf('ingredients')).getByRole('button', { name: 'add_from_library' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /BBQ/ }));
    fireEvent.click(screen.getByRole('button', { name: /add_selected/ }));

    expect((onChange.mock.calls[0][0] as ProductIngredient[])[2].kind).toBe('ingredient');
  });

  /**
   * The merge-back rule, seen from the screen: the two groups are one array, so an edit in one must
   * not move or rewrite a row in the other. `ingredientKind.test.ts` pins the same rule on the pure
   * function; this pins that the group really goes through it.
   */
  it('editing a sauce leaves the ingredient rows untouched, in order', () => {
    mount();

    fireEvent.change(within(groupOf('sauces')).getByDisplayValue('Ketchup'), { target: { value: 'Ketchup hot' } });

    const next = onChange.mock.calls[0][0] as ProductIngredient[];
    expect(next[0]).toEqual(olives);
    expect(next[1]).toEqual({ ...ketchup, name: 'Ketchup hot' });
  });

  it('removing an ingredient leaves the sauce alone', () => {
    mount();

    fireEvent.click(within(groupOf('ingredients')).getByRole('button', { name: 'remove_ingredient' }));

    expect(onChange.mock.calls[0][0]).toEqual([ketchup]);
  });

  it('states the group rule in words, derived from the numbers and never from a tenant default', () => {
    mount([ketchup]);

    // Nothing is seeded: no cap, nothing free (owner answer, plan §7 Q3).
    expect(screen.getByText(/sauce_rules_hint_any/)).toBeInTheDocument();
    expect(screen.getByText(/sauce_rules_hint_paid/)).toBeInTheDocument();
  });

  it('reads a stored cap and free allowance back into the sentence', () => {
    mount([ketchup], { sauceMax: 3, sauceIncludedFree: 1, sauceMin: 1 });

    expect(screen.getByText(/sauce_rules_hint_limit/)).toBeInTheDocument();
    expect(screen.getByText(/sauce_rules_hint_min/)).toBeInTheDocument();
    expect(screen.getByText(/sauce_rules_hint_free/)).toBeInTheDocument();
  });
});
