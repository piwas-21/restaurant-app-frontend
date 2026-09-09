import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import IngredientTranslationsGrid from './IngredientTranslationsGrid';
import type { IngredientEntry } from '@/utils/ingredientTranslationEntries';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts && 'count' in opts ? `${key}:${opts.count}` : key),
  }),
}));

const entry = (overrides: Partial<IngredientEntry> = {}): IngredientEntry => ({
  key: 'id:g1',
  globalIngredientId: 'g1',
  defaultName: 'Sans Sauces',
  isSauce: true,
  copies: [
    { productId: 'p1', productName: 'Chicken Burger', ingredientId: 'i1' },
    { productId: 'p2', productName: 'Tower Burger', ingredientId: 'i2' },
  ],
  cells: {
    en: { value: 'No sauce', disagreements: 0, missing: 0 },
    fr: { value: '', disagreements: 0, missing: 2 },
  },
  ...overrides,
});

/** The grid only renders the locales the entries carry cells for; the component reads LANGUAGE_CODES. */
jest.mock('@/config/languageConfig', () => {
  const actual = jest.requireActual('@/config/languageConfig');
  return { ...actual, LANGUAGE_CODES: ['en', 'fr'] };
});

function renderGrid(entries: IngredientEntry[], dirtyKeys = new Set<string>()) {
  const onEdit = jest.fn();
  const view = render(
    <IngredientTranslationsGrid entries={entries} edits={{}} dirtyKeys={dirtyKeys} onEdit={onEdit} />,
  );
  return { onEdit, view };
}

describe('IngredientTranslationsGrid', () => {
  it('renders one row per entry with the locale inputs, the usage count and the kind badge', () => {
    renderGrid([entry()]);

    expect(screen.getByText('Sans Sauces')).toBeInTheDocument();
    expect(screen.getByLabelText('English · editor_translations_field_ingredient_name')).toHaveValue('No sauce');
    expect(screen.getByLabelText('Français · editor_translations_field_ingredient_name')).toHaveValue('');
    expect(screen.getByText('2')).toBeInTheDocument(); // products carrying it — data, not a sentence
    expect(screen.getByText('sauces')).toBeInTheDocument();
  });

  it('marks a conflict cell, a missing cell, and an unlinked entry', () => {
    const conflicted = entry({
      key: 'name:x',
      globalIngredientId: undefined,
      cells: {
        en: { value: 'Ketchup', disagreements: 1, missing: 0 },
        fr: { value: '', disagreements: 0, missing: 1 },
      },
    });
    renderGrid([conflicted]);

    expect(screen.getByLabelText('English · editor_translations_field_ingredient_name')).toHaveClass('conflict');
    expect(screen.getByLabelText('Français · editor_translations_field_ingredient_name')).toHaveClass('missing');
    expect(screen.getByText('ingredient_translations_conflict')).toBeInTheDocument();
    expect(screen.getByText('ingredient_translations_incomplete')).toBeInTheDocument();
    expect(screen.getByText('ingredient_translations_unlinked')).toBeInTheDocument();
  });

  it('tints a dirty row and never renders a per-row save button (partner feedback: it hid past the last locale column)', () => {
    renderGrid([entry()], new Set(['id:g1']));

    const row = screen.getByText('Sans Sauces').closest('tr');
    expect(row).toHaveClass('dirtyRow');
    // Saving is the page's sticky batch bar — the grid carries no save affordance of its own.
    expect(screen.queryByRole('button', { name: 'save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ingredient_translations_save_all' })).not.toBeInTheDocument();
  });

  it('routes an input change through onEdit with the entry key and locale', () => {
    const { onEdit } = renderGrid([entry()]);

    fireEvent.change(screen.getByLabelText('Français · editor_translations_field_ingredient_name'), {
      target: { value: 'Sans sauces' },
    });
    expect(onEdit).toHaveBeenCalledWith('id:g1', 'fr', 'Sans sauces');
  });
});
