import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import MenuCardImage from './MenuCardImage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

describe('MenuCardImage', () => {
  it('renders the thumbnail closed, then opens the gallery on image click', () => {
    render(
      <MenuCardImage
        imageUrl="hero.jpg"
        alt="Adana Kebab"
        enlargeLabel="Enlarge Adana Kebab image"
        images={[
          { url: 'hero.jpg', alt: 'Adana Kebab' },
          { url: 'two.jpg', alt: 'Adana 2' },
        ]}
        imageCount={2}
        countLabel="images"
      />,
    );
    // Lightbox is closed initially.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enlarge Adana Kebab image' }));

    // Lightbox opens; multi-image → nav present.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next Image' })).toBeInTheDocument();
  });

  it('falls back to the single primary image when no gallery array is provided', () => {
    render(<MenuCardImage imageUrl="solo.jpg" alt="Hummus" enlargeLabel="Enlarge Hummus image" />);
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge Hummus image' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Single image → no navigation.
    expect(screen.queryByRole('button', { name: 'Next Image' })).not.toBeInTheDocument();
  });

  it('exposes the thumbnail as a labelled native button (keyboard-accessible) and opens the lightbox', () => {
    render(<MenuCardImage imageUrl="hero.jpg" alt="Adana Kebab" enlargeLabel="Enlarge Adana Kebab image" />);

    // A real <button> with a DISTINCT accessible name — not the dish name, which
    // is the card title's — so it is natively focusable + Enter/Space activated
    // (keyboard-accessible with no custom key handling) and unambiguous for
    // screen-reader / role-based lookups.
    const button = screen.getByRole('button', { name: 'Enlarge Adana Kebab image' });
    expect(button.tagName).toBe('BUTTON');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /**
   * The `overlay` slot must render OUTSIDE the enlarge button, and no other gate can tell.
   *
   * A `<button>` carrying an `aria-label` is children-presentational: the whole subtree is pruned
   * from the accessibility tree. The allergen chips shipped inside it for one commit, which made
   * them unreachable to a screen reader — and on a phone their word is visually clipped as well, so
   * there was no channel left at all. Nothing caught it: the chips still RENDER, so a
   * `getByText`-style assertion passes, jest-dom does not compute accessible names from
   * presentational-children rules, and axe's rules for this do not fire on a decorative overlay.
   *
   * Asserted structurally — the overlay is not a descendant of the button — because that is the
   * property that actually matters and the one a future refactor would silently undo.
   */
  it('renders the overlay slot OUTSIDE the enlarge button, where the a11y tree can reach it', () => {
    render(
      <MenuCardImage
        imageUrl="hero.jpg"
        alt="Adana Kebab"
        enlargeLabel="Enlarge Adana Kebab image"
        badge={<span data-testid="corner-mark">Special</span>}
        overlay={<span data-testid="allergen-chips">Halal</span>}
      />,
    );

    const button = screen.getByRole('button', { name: 'Enlarge Adana Kebab image' });
    const chips = screen.getByTestId('allergen-chips');

    expect(button.contains(chips)).toBe(false);
    // …but still inside the photo frame, or it would not be positioned against the picture.
    expect(button.parentElement?.contains(chips)).toBe(true);

    // The corner mark stays INSIDE on purpose: it is decorative there, and the marks that carry
    // meaning are already in the card's own `aria-labelledby`.
    expect(button.contains(screen.getByTestId('corner-mark'))).toBe(true);
  });
});
