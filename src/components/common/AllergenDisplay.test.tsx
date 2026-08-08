import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import AllergenDisplay from './AllergenDisplay';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

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
    // The counter's title is the only place the hidden allergens are named at all.
    expect(screen.getByText('+2')).toHaveAttribute('title', '+2 more allergens: milk, nuts');
  });

  it('caps the compact variant the same way — one implementation, three variants', () => {
    render(<AllergenDisplay allergens={['vegan', 'gluten', 'milk']} variant="compact" maxVisible={1} />);

    expect(screen.getByText('vegan')).toBeInTheDocument();
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
   * D9 (MENU-DESIGN-CONFORMANCE-PLAN §4). A substance *warning* earns one monochrome glyph; a
   * dietary *claim* earns none. Asserted on the rendered chip rather than on `getAllergenInfo`,
   * because the split only matters if the component acts on it — the table used to hand back a
   * per-entry emoji and the component rendered whatever arrived, so a claim losing its glyph and
   * the component still drawing one would look identical to a passing unit test on the table.
   */
  it('marks a substance warning with a glyph and leaves a dietary claim bare', () => {
    render(<AllergenDisplay allergens={['vegan', 'gluten']} variant="full" />);

    expect(chipFor('gluten').querySelector('svg')).toBeInTheDocument();
    expect(chipFor('vegan').querySelector('svg')).toBeNull();
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
