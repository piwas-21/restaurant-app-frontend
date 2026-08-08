import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import FloatingCartButton from './FloatingCartButton';

/**
 * S9's ONLY automated evidence. Per MENU-DESIGN-CONFORMANCE-PLAN §5 the screenshot run
 * (customer-routes.screen.ts) never adds an item to the basket and the component returns
 * null on an empty one, so neither the visual baselines nor the axe pass ever render this
 * button — there is no second gate behind this file.
 *
 * The first draft of it was vacuous: jest maps CSS Modules to `identity-obj-proxy`, so a
 * rendering test cannot observe a single declaration, and reverting the whole stylesheet to
 * origin/develop left it green. The style half is therefore asserted at SOURCE level, the
 * way categoryNavStickyOffset.test.ts and adminPriceEditorContrast.test.ts do it.
 */

/** The CSS files quote the old values in prose, so a gate reading raw text fails on the
 *  documentation of the very thing it checks. Same trap as categoryNavStickyOffset.test.ts. */
const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '');

const FAB_CSS = withoutComments(readFileSync(join(__dirname, 'FloatingCartButton.module.css'), 'utf8'));
const CRAFT_TOKENS = withoutComments(readFileSync(join(__dirname, '../../templates/craft/tokens.css'), 'utf8'));

const rule = (selector: string) => new RegExp(`\\${selector}[^{]*\\{[^}]*\\}`).exec(FAB_CSS)?.[0] ?? '';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

beforeEach(() => mockPush.mockClear());

describe('FloatingCartButton — behaviour', () => {
  it('renders nothing while the basket is empty', () => {
    const { container } = render(<FloatingCartButton itemCount={0} totalPrice={0} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('adds the visible class after the entrance delay', () => {
    // The base rule is `opacity: 0; transform: translateY(100px)` — WITHOUT this class the
    // button is on the page, hit-testable and completely invisible. Nothing else can catch
    // that: jsdom applies no CSS, and no screenshot ever renders this component.
    jest.useFakeTimers();
    try {
      render(<FloatingCartButton itemCount={2} totalPrice={19.9} />);
      expect(screen.getByRole('button')).not.toHaveClass('visible');

      act(() => void jest.advanceTimersByTime(300));

      expect(screen.getByRole('button')).toHaveClass('visible');
    } finally {
      jest.useRealTimers();
    }
  });

  it('renders the count, the total and the total label', () => {
    render(<FloatingCartButton itemCount={3} totalPrice={42.5} />);

    const button = screen.getByRole('button');
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    // Locale-agnostic: the de-CH/CHF group separator is not what is under test.
    expect(button).toHaveTextContent(/42[.,]50/);
  });

  it('names the button and the badge for assistive tech', () => {
    const { container } = render(<FloatingCartButton itemCount={7} totalPrice={12} />);

    expect(screen.getByRole('button')).toHaveAccessibleName(expect.stringContaining('7') as unknown as string);
    // A labelled <span>: assert the attribute, not the AX name — a span has no nameable role.
    expect(container.querySelector('[class*="badge"]')).toHaveAttribute('aria-label', '7 items');
  });

  it('keeps the price label and the price in the price container', () => {
    const { container } = render(<FloatingCartButton itemCount={1} totalPrice={8} />);

    const priceContainer = container.querySelector('[class*="priceContainer"]');
    expect(priceContainer).toBeInTheDocument();
    expect(priceContainer).toHaveTextContent('Total');
  });

  it('navigates to /cart when no click override is supplied', () => {
    render(<FloatingCartButton itemCount={1} totalPrice={8} />);

    fireEvent.click(screen.getByRole('button'));

    expect(mockPush).toHaveBeenCalledWith('/cart');
  });

  it('calls the override instead of navigating when one is supplied', () => {
    // /menu passes this to open the mobile bottom-sheet; routing away instead would be silent.
    const onClick = jest.fn();
    render(<FloatingCartButton itemCount={1} totalPrice={8} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('FloatingCartButton — stylesheet (S9)', () => {
  it('carries no gradient and no red-tinted shadow', () => {
    expect(FAB_CSS).not.toContain('linear-gradient');
    // The two red glows, light and dark. Neutral rgba(0,0,0,…) shadows are the fix.
    expect(FAB_CSS).not.toMatch(/rgba\(\s*192\s*,\s*0\s*,\s*0/);
    expect(FAB_CSS).not.toMatch(/rgba\(\s*224\s*,\s*102\s*,\s*102/);
  });

  it('keeps a real elevation — it is a floating control, not a card', () => {
    // Finding 2: DESIGN.md:141's single 0 1px 3px shadow is scoped to cards. Applying it here
    // left a position:fixed pill with no separation from the content scrolling under it.
    const base = rule('.floatingButton');
    expect(base).toMatch(/box-shadow:\s*var\(--fab-shadow,/);
    expect(base).toMatch(/0 10px 15px -3px/);
  });

  it('paints the pill with tokens that flip, so no dark-mode block is needed', () => {
    const base = rule('.floatingButton');
    expect(base).toContain('var(--fab-bg, var(--brand-primary))');
    // --text-on-accent is white in BOTH themes; on the dark brand that is 3.35:1.
    expect(base).toContain('var(--fab-fg, var(--text-on-primary))');
    expect(base).not.toContain('--text-on-accent');
    expect(FAB_CSS).not.toContain("data-theme='dark'");
  });

  it('shifts the surface on hover and on press', () => {
    // Finding 6 / DESIGN.md:142 — "the shadow does not grow; instead, the surface color
    // shifts". A phone never hovers, so :active has to carry it too.
    const shift = /\.floatingButton:hover,\s*\.floatingButton:active\s*\{[^}]*\}/.exec(FAB_CSS)?.[0] ?? '';
    expect(shift).toContain('var(--fab-press-bg, var(--brand-primary-hover))');
  });

  it('inverts the badge to paper-with-brand-digits and drops the ring', () => {
    const badge = rule('.badge');
    expect(badge).toContain('var(--fab-badge-bg, var(--surface-card))');
    expect(badge).toContain('var(--fab-badge-fg, var(--brand-primary-elevated))');
    // Finding 3: the ring separated a RED badge from a RED pill. 1.05:1 light, 15.3:1 dark.
    expect(badge).toContain('border: var(--fab-badge-border, none)');
    // --feedback-danger has no dark override at all, which is why it could not stay.
    expect(FAB_CSS).not.toContain('--feedback-danger');
  });

  it('does not rely on env(safe-area-inset-*), which is inert without viewport-fit=cover', () => {
    // Finding 5: src/app/layout.tsx's viewport export sets no viewportFit, and nothing in the
    // repo does, so env() resolves to 0. Re-adding it here would be decoration, not clearance.
    expect(FAB_CSS).not.toContain('env(safe-area-inset');
  });

  it('pins every craft hook it introduces, so classic changes cannot move craft', () => {
    // Finding 1: the mobile block had no template gating and craft has no geometry hook, so
    // craft's FAB silently went 343px -> 139px at 375px. This is the general gate for that
    // whole class of bug — any --fab-* the module reads must have a craft pin.
    const used = [...new Set([...FAB_CSS.matchAll(/var\(\s*(--fab-[a-z-]+)/g)].map((m) => m[1]))];
    expect(used.length).toBeGreaterThan(10);

    const unpinned = used.filter((name) => !new RegExp(`${name}\\s*:`).test(CRAFT_TOKENS));
    expect(unpinned).toEqual([]);
  });
});
