import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import AllergenDisplay from './AllergenDisplay';

/**
 * `t` handles BOTH call shapes this component uses: `t(key, 'fallback')` and the interpolating
 * `t(key, { defaultValue, ...vars })`. The second is spelled out rather than left to `?? key`
 * because the options object silently stringifies to `[object Object]` otherwise — which is what
 * the counter's title became when it was localized, and what these tests caught.
 *
 * It is a `jest.fn` (the `mock` prefix is jest's hoisting rule, not style) so the counter's assertions can read the CALL. A mock whose default return IS
 * the English default cannot tell a translated string from a hardcoded one: asserting the rendered
 * text passes identically either way, so it would not notice `t()` being removed again.
 */
const mockTranslate = jest.fn((key: string, options?: string | Record<string, unknown>) => {
  if (typeof options === 'string') return options;
  if (options && typeof options === 'object') {
    const template = String(options.defaultValue ?? key);
    return template.replace(/\{\{(\w+)\}\}/g, (_m, name) => String(options[name] ?? ''));
  }
  return key;
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | Record<string, unknown>) => mockTranslate(key, options),
  }),
}));

beforeEach(() => mockTranslate.mockClear());

/** The chip element itself, from the word inside it. */
const chipFor = (word: string) => screen.getByText(word).closest('.allergenTag') as HTMLElement;

describe('AllergenDisplay', () => {
  // The regression this file exists for. `full` used to answer an empty allergen list with a
  // `visibility: hidden` label plus a placeholder chip, which reserved ~80px of blank card on every
  // item that carries no allergens — taller than a populated band, and the gap the card's details
  // affordance was left floating in. Nothing asserted it, so nothing would have caught its return.
  it.each(['full', 'compact', 'admin'] as const)('renders nothing for %s when there are no allergens', (variant) => {
    const { container } = render(<AllergenDisplay allergens={[]} variant={variant} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for full when allergens is undefined', () => {
    const { container } = render(<AllergenDisplay variant="full" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('still renders the chips when there ARE allergens', () => {
    render(<AllergenDisplay allergens={['vegan', 'gluten']} variant="full" />);

    const group = screen.getByRole('group', { name: 'Allergens' });
    expect(group).toBeInTheDocument();
    expect(screen.getByText('vegan')).toBeInTheDocument();
    expect(screen.getByText('gluten')).toBeInTheDocument();
  });

  /**
   * Every caller in the tree names its variant, so the default was never exercised by anything —
   * app or test. It still decides what a new caller gets, and `full` is the card treatment (a
   * labelled group), not the bare chip row `compact` renders.
   */
  it('defaults to the full variant when no variant is named', () => {
    render(<AllergenDisplay allergens={['vegan']} />);
    expect(screen.getByRole('group', { name: 'Allergens' })).toBeInTheDocument();
  });

  it('caps the chips at maxVisible and counts the rest', () => {
    render(<AllergenDisplay allergens={['vegan', 'gluten', 'milk', 'nuts']} variant="full" maxVisible={2} />);

    expect(screen.getByText('vegan')).toBeInTheDocument();
    expect(screen.getByText('gluten')).toBeInTheDocument();
    expect(screen.queryByText('milk')).not.toBeInTheDocument();
    // The counter's title is the only place the hidden allergens are named at all — and it must be
    // ASKED for through i18n, not assembled in English. Asserting the call is what makes that
    // falsifiable; the rendered text alone would read the same if the sentence went back inline.
    expect(mockTranslate).toHaveBeenCalledWith('allergens_more_title', {
      count: 2,
      list: 'milk, nuts',
      defaultValue: '+{{count}} more allergens: {{list}}',
    });
    expect(screen.getByText('+2')).toHaveAttribute('title', '+2 more allergens: milk, nuts');
  });

  it('caps the compact variant the same way — one implementation, three variants', () => {
    render(<AllergenDisplay allergens={['vegan', 'gluten', 'milk']} variant="compact" maxVisible={1} />);

    expect(screen.getByText('vegan')).toBeInTheDocument();
    expect(mockTranslate).toHaveBeenCalledWith(
      'allergens_more_title',
      expect.objectContaining({ list: 'gluten, milk' }),
    );
    expect(screen.getByText('+2')).toHaveAttribute('title', '+2 more allergens: gluten, milk');
  });

  it('lists EVERY allergen in the admin editor, with no counter', () => {
    render(<AllergenDisplay allergens={['vegan', 'gluten', 'milk', 'nuts']} variant="admin" maxVisible={2} />);

    expect(screen.getByText('Allergens')).toBeInTheDocument();
    expect(screen.getByText('nuts')).toBeInTheDocument();
    expect(screen.queryByText('+2')).not.toBeInTheDocument();
  });

  it('drops the admin heading when showLabel is false', () => {
    render(<AllergenDisplay allergens={['vegan']} variant="admin" showLabel={false} />);
    expect(screen.queryByText('Allergens')).not.toBeInTheDocument();
  });

  /**
   * Every allergen gets its OWN glyph, and no two of them get the same one.
   *
   * This supersedes D9, which collapsed all fourteen substances onto a single `AlertTriangle` and
   * left dietary claims bare. That was right about EMOJI — zero of the 28 classic screens carry one
   * — and wrong about icons: one triangle repeated four times on a card tells a guest there are
   * four warnings without saying what any of them is, which is the opposite of what an allergen
   * line is for.
   *
   * Asserted on the rendered chip rather than on the lookup table, because the distinction only
   * matters if the component acts on it: a table returning per-entry icons and a component drawing
   * one fixed glyph would look identical to a passing unit test on the table.
   */
  it('gives each allergen its own glyph, distinct from its neighbours', () => {
    render(<AllergenDisplay allergens={['vegan', 'gluten', 'milk', 'fish']} variant="full" maxVisible={4} />);

    const iconOf = (word: string) => chipFor(word).querySelector('svg')?.getAttribute('class') ?? '';
    for (const word of ['vegan', 'gluten', 'milk', 'fish']) expect(iconOf(word)).toContain('lucide-');
    expect(new Set(['vegan', 'gluten', 'milk', 'fish'].map(iconOf)).size).toBe(4);
  });

  /**
   * A spelling the vocabulary aliases draws the SAME mark as the entry it resolves to. This is the
   * half a per-entry icon table gets wrong by omission: `dairy` and `milk` are one substance, and a
   * card showing them as two different glyphs is a card that has invented a distinction.
   */
  it('draws an aliased spelling with its canonical entry’s glyph', () => {
    render(<AllergenDisplay allergens={['dairy', 'wheat']} variant="full" />);
    const dairy = chipFor('dairy').querySelector('svg')?.getAttribute('class');

    render(<AllergenDisplay allergens={['milk']} variant="full" />);
    expect(chipFor('milk').querySelector('svg')?.getAttribute('class')).toBe(dairy);
  });

  /**
   * An icon-only chip is the card's title-row band. It must lose the WORD from the layout without
   * losing it from the accessible name — otherwise a guest using a screen reader is handed a row of
   * unlabelled boxes.
   */
  it('keeps the word in the accessible name when the chip shows only a glyph', () => {
    render(<AllergenDisplay allergens={['gluten']} variant="icons" />);

    const chip = chipFor('gluten');
    expect(chip.querySelector('svg')).toBeInTheDocument();
    expect(chip).toHaveAttribute('title', 'gluten');
    // The word is present and hidden, not absent.
    expect(screen.getByText('gluten')).toHaveClass('sr-only');
  });

  /**
   * The "+N" counter is the one chip with no glyph of its own, so it is the one that has to carry
   * the overflowed WORDS in its `title` — in icon mode there is no visible text anywhere on the
   * band, and without this a guest hovering "+2" learns only that two things are hidden.
   */
  it('names the allergens it hid behind the counter, in icon mode too', () => {
    render(<AllergenDisplay allergens={['gluten', 'milk', 'fish', 'eggs', 'nuts']} variant="icons" maxVisible={2} />);

    const counter = screen.getByText('+3');
    expect(mockTranslate).toHaveBeenCalledWith('allergens_more_title', expect.objectContaining({ count: 3 }));
    expect(counter).toHaveAttribute('title', '+3 more allergens: fish, eggs, nuts');
    // It takes the icon-chip box like its neighbours rather than staying a wide labelled pill.
    expect(counter.className).toContain('iconChip');
  });

  /**
   * Zero of the 28 classic `code.html` design screens contain an emoji, and this component shipped
   * 25 of them. The glyph is an inline SVG inheriting `currentColor`, so it is one ink with the
   * word beside it instead of a second, louder palette — which is what a colour emoji is.
   */
  it('renders no emoji at all', () => {
    const { container } = render(
      <AllergenDisplay allergens={['vegan', 'gluten', 'halal', 'sesame']} variant="full" maxVisible={4} />,
    );

    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  /**
   * The glyph is decoration: the word beside it already names the substance. Announced, it would
   * read as a second and vaguer copy of the same fact on every warning chip.
   */
  it('hides the glyph from assistive technology', () => {
    render(<AllergenDisplay allergens={['gluten']} variant="full" />);
    expect(chipFor('gluten').querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
