import React from 'react';
import { render, screen, within } from '@testing-library/react';
import EditorSideRail from './EditorSideRail';
import { getProductCompleteness } from '@/lib/productCompleteness';

/**
 * `t` INTERPOLATES here: the meter's progress line is one key carrying two numbers, and a key-only
 * stub would render the same string for "0 of 2" and "2 of 2" — the one thing the line exists to
 * distinguish.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: unknown) =>
      vars && typeof vars === 'object'
        ? `${key}[${Object.entries(vars as Record<string, unknown>)
            .map(([name, value]) => `${name}=${String(value)}`)
            .join(',')}]`
        : key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/utils/currency', () => ({ formatCurrency: (value: number) => `CHF ${value.toFixed(2)}` }));

const baseProps = {
  basePrice: 12,
  categoryName: 'Pizzas',
  inheritsOrderTypes: true,
  photoCount: 1,
  showCategory: true,
  showPhotos: true,
};

const meter = () => screen.getByRole('heading', { name: 'editor_completeness' }).closest('section') as HTMLElement;

/**
 * The side rail's completeness meter (MENU-ITEM-EDITOR-REDESIGN-PLAN, S10).
 *
 * The rules themselves are tested without a render in `src/lib/productCompleteness.test.ts`. What is
 * tested here is what the ADMIN is told: the count, the per-row state IN WORDS, and the sentence
 * that says allergens are outside the score — which is the whole reason the meter can be trusted.
 */
describe('EditorSideRail — the completeness meter', () => {
  it('draws no meter at all when it is given no score', () => {
    // A bundle and the create route pass nothing. The component must not invent a zero: "0 of 2"
    // on a form the admin has just opened scolds them for not having finished it.
    render(<EditorSideRail {...baseProps} />);
    expect(screen.queryByRole('heading', { name: 'editor_completeness' })).not.toBeInTheDocument();
    expect(screen.queryByText('editor_completeness_allergens_note')).not.toBeInTheDocument();
  });

  it('counts what is filled in', () => {
    render(
      <EditorSideRail {...baseProps} completeness={getProductCompleteness({ photoCount: 1, description: 'x' })} />,
    );
    expect(within(meter()).getByText('editor_completeness_progress[done=2,total=2]')).toBeInTheDocument();
  });

  it('names each field and says, in words, whether it is there', () => {
    render(
      <EditorSideRail {...baseProps} completeness={getProductCompleteness({ photoCount: 0, description: 'x' })} />,
    );
    const rows = meter();

    expect(within(rows).getByText('editor_completeness_progress[done=1,total=2]')).toBeInTheDocument();
    // The state is TEXT beside each label, not only a tick: the glyph is decoration and a screen
    // reader must never be asked to interpret it.
    // The description row reuses the shipped `description` key rather than minting a second one.
    expect(within(rows).getByText('editor_completeness_photo')).toBeInTheDocument();
    expect(within(rows).getByText('description')).toBeInTheDocument();
    const stateCells = within(rows).getAllByText(/editor_completeness_field_/);
    expect(stateCells.map((cell) => cell.textContent)).toEqual([
      'editor_completeness_field_missing',
      'editor_completeness_field_done',
    ]);
  });

  it('hides the tick and the ring from the accessibility tree', () => {
    const { container } = render(
      <EditorSideRail {...baseProps} completeness={getProductCompleteness({ photoCount: 0, description: '' })} />,
    );
    const glyphs = container.querySelectorAll('[aria-hidden="true"]');
    expect(glyphs).toHaveLength(2);
    expect(Array.from(glyphs).map((g) => g.textContent)).toEqual(['○', '○']);
  });

  /**
   * The §14 half. The note is the difference between "allergens are fine" and "allergens are not
   * what this number is about", and silence says the first.
   */
  describe('the allergen sentence', () => {
    it('renders whenever the meter does', () => {
      render(
        <EditorSideRail {...baseProps} completeness={getProductCompleteness({ photoCount: 2, description: 'x' })} />,
      );
      // Present even at a FULL score — that is the case where a missing sentence would be read as
      // "everything about this item, allergens included, is done".
      expect(within(meter()).getByText('editor_completeness_progress[done=2,total=2]')).toBeInTheDocument();
      expect(within(meter()).getByText('editor_completeness_allergens_note')).toBeInTheDocument();
    });

    it('is explanatory copy, not an alert and not a live region', () => {
      // §15.2, one card over: nothing has gone wrong, and the text never changes. `role="status"`
      // would announce nothing at all while telling every future reader that it does, and
      // `role="alert"` would compete with the real validation errors on the same screen.
      render(
        <EditorSideRail {...baseProps} completeness={getProductCompleteness({ photoCount: 0, description: '' })} />,
      );
      const note = within(meter()).getByText('editor_completeness_allergens_note');
      expect(note).not.toHaveAttribute('role');
      expect(note).not.toHaveAttribute('aria-live');
    });
  });
});

describe('EditorSideRail — "At a glance" is unchanged by S10', () => {
  it('still shows the derived rows above the meter', () => {
    render(
      <EditorSideRail {...baseProps} completeness={getProductCompleteness({ photoCount: 1, description: 'x' })} />,
    );
    const glance = screen.getByRole('heading', { name: 'editor_at_a_glance' }).closest('section') as HTMLElement;
    expect(within(glance).getByText('CHF 12.00')).toBeInTheDocument();
    expect(within(glance).getByText('Pizzas')).toBeInTheDocument();
    // The meter is a SEPARATE card: a rail row and a meter row must never be confused for each other.
    expect(within(glance).queryByText('editor_completeness_allergens_note')).not.toBeInTheDocument();
  });
});
