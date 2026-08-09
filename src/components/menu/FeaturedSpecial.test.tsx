import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import FeaturedSpecial from './FeaturedSpecial';
import type { FeaturedSpecial as FeaturedSpecialType } from '@/types/menu';
import { OrderType } from '@/types/order';
import { useItemAvailabilityNotice, type AvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import { useTrackItemBlocked } from '@/hooks/menu/useTrackItemBlocked';
import { useIsAdmin } from '@/hooks/menu/useIsAdmin';

jest.mock('react-i18next', () => ({
  // `i18n` is needed now that the hero resolves its localized name/description from `content`, as
  // every catalog card already did — the classic hero used to print the base (English) value in
  // every locale.
  // Interpolating form, matching `MenuCard.test.tsx` and `CraftMenuCard.test.tsx`: a string second
  // argument is a fallback, an object is interpolation values and renders as `key(v1,v2)`. The hero
  // needs it now that its add control names the DISH ("Add Chef Special to order") rather than
  // saying a generic "Add to Order" — the same accessible name every catalog card gives, so a
  // screen-reader user listing the page's buttons gets N distinct entries instead of N identical.
  useTranslation: () => ({
    t: (key: string, second?: string | Record<string, unknown>) =>
      typeof second === 'string' ? second : second ? `${key}(${Object.values(second).join(',')})` : key,
    i18n: { language: 'en' },
  }),
}));

// The admin controls render nothing for a guest, which is the state every existing case below
// assumes. Cases that need an admin re-mock this.
jest.mock('@/hooks/menu/useIsAdmin', () => ({ useIsAdmin: jest.fn(() => false) }));

jest.mock('@/hooks/menu/useTrackItemBlocked', () => ({ useTrackItemBlocked: jest.fn() }));
jest.mock('@/hooks/menu/useItemAvailabilityNotice', () => ({
  useItemAvailabilityNotice: jest.fn(() => null),
  // The predicate is deliberately NOT stubbed. It is the thing under test here — the three item
  // surfaces diverged precisely because each derived "blocked" for itself, and a mock would let
  // that happen again invisibly.
  isItemBlocked: jest.requireActual('@/hooks/menu/useItemAvailabilityNotice').isItemBlocked,
}));

const mockedNotice = useItemAvailabilityNotice as jest.Mock;

const AVAILABILITY = {
  canOrder: true,
  reason: 'Available',
  allowedOrderTypes: [OrderType.Takeaway, OrderType.Delivery],
} as const;

const special = {
  id: 'p1',
  name: 'Chef Special',
  basePrice: 24,
  availability: AVAILABILITY,
  featuredDate: '2026-07-27',
  preparationTimeMinutes: 0,
  variations: [],
  suggestedSideItems: [],
  detailedIngredients: [],
} as unknown as FeaturedSpecialType;

/**
 * The description branch. It was COMMENTED OUT rather than deleted until 2026-08-02, which is why
 * the hero read as a photo, a name and a price — tall because of the image and empty because its
 * copy was switched off. Both sides are covered because restoring it introduced a branch, and the
 * per-file coverage pin caught that before CI would have let it through.
 */
describe('the restored description', () => {
  it('renders it when the special has one', () => {
    render(
      <FeaturedSpecial
        special={{ ...special, description: 'Slow-braised lamb with pomegranate' } as FeaturedSpecialType}
        onAddToCart={jest.fn()}
        onViewDetails={jest.fn()}
      />,
    );
    expect(screen.getByText('Slow-braised lamb with pomegranate')).toBeInTheDocument();
  });

  it('renders nothing in its place when the special has none', () => {
    const { container } = render(
      <FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />,
    );
    // Not an empty <p>: an element with no text is still a gap in the layout.
    expect(container.querySelector('[class*="featuredSpecialDescription"]')).toBeNull();
  });
});

const BLOCKED: AvailabilityNotice = {
  tone: 'blocked',
  message: 'Takeaway and Delivery only',
  switchTo: OrderType.Takeaway,
  switchLabel: 'Switch to Takeaway',
  hint: null,
};

const INFO: AvailabilityNotice = { ...BLOCKED, tone: 'info', switchTo: null, switchLabel: '' };

afterEach(() => mockedNotice.mockReturnValue(null));

describe('FeaturedSpecial — per-order-type guard (G7)', () => {
  it('offers Add when the server reports no restriction', () => {
    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'add_item_to_order(Chef Special)' })).toBeInTheDocument();
    expect(screen.queryByText('Takeaway and Delivery only')).not.toBeInTheDocument();
  });

  it('info tone: names the restriction but keeps the hero fully orderable', () => {
    mockedNotice.mockReturnValue(INFO);

    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(screen.getByText('Takeaway and Delivery only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'add_item_to_order(Chef Special)' })).toBeInTheDocument();
  });

  it('blocked tone: REMOVES Add, keeps the dish name as the way into the sheet, offers the switch', () => {
    // Removed rather than disabled — the S4 rule: nothing focusable-but-dead, and the switch is the
    // way out. The route to the sheet survives because it is now the HEADING, and a heading is not
    // something the blocked state takes away. That is the whole reason S2 could drop the second
    // button rather than simply deleting it: reachability had to move somewhere first.
    mockedNotice.mockReturnValue(BLOCKED);
    const onSwitchOrderType = jest.fn();
    const onViewDetails = jest.fn();

    render(
      <FeaturedSpecial
        special={special}
        onAddToCart={jest.fn()}
        onViewDetails={onViewDetails}
        onSwitchOrderType={onSwitchOrderType}
      />,
    );

    expect(screen.queryByRole('button', { name: 'add_item_to_order(Chef Special)' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Chef Special' }));
    expect(onViewDetails).toHaveBeenCalledWith({ forceSheet: true, availability: AVAILABILITY });

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Takeaway' }));
    expect(onSwitchOrderType).toHaveBeenCalledWith(OrderType.Takeaway);
  });

  it('Details opens the sheet to VIEW the item, and keeps doing so while blocked', () => {
    // The hero's own Details, not the dish name. It hands over the same verdict the name does —
    // `forceSheet` plus the server's availability — so the sheet refuses an add the hero refused
    // (§9.10). And unlike Add it is NOT removed while blocked: reading an item is always allowed,
    // and the sheet is the only place its ingredients and allergens are listed in full.
    mockedNotice.mockReturnValue(BLOCKED);
    const onViewDetails = jest.fn();

    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={onViewDetails} />);

    fireEvent.click(screen.getByRole('button', { name: 'menu_item_details_aria(Chef Special)' }));
    expect(onViewDetails).toHaveBeenCalledWith({ forceSheet: true, availability: AVAILABILITY });
  });

  it('offers the name, Details and Add — and nothing else', () => {
    // Counting, not spot-checking: a `queryByRole('button', {name: 'X'})` that returns null passes
    // just as happily against a fourth button nobody meant to add.
    //
    // Details is back, deliberately. S2 removed it when the only other control was Add and the
    // generated screens drew one action — but that left the dish NAME as the sole route into the
    // sheet, a target a guest has no reason to expect is clickable, and every catalog card beside
    // the hero offers a Details of its own.
    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Chef Special',
      'menu_item_details_aria(Chef Special)',
      'add_item_to_order(Chef Special)',
    ]);
  });

  it('folds the reason into the section’s accessible name while blocked', () => {
    mockedNotice.mockReturnValue(BLOCKED);

    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(screen.getByRole('region', { name: /Chef Special Takeaway and Delivery only/ })).toBeInTheDocument();
  });

  it('reports the blocked hero under its OWN source, so it cannot swallow the card’s event', () => {
    mockedNotice.mockReturnValue(BLOCKED);

    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(useTrackItemBlocked).toHaveBeenCalledWith('p1', BLOCKED, 'featured_special');
  });

  it('feeds the SERVER verdict into the guard — the one link this whole feature hangs on', () => {
    // Without this, mocking the hook lets the banner stop reading `special.availability` entirely
    // and every other test here still passes.
    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(useItemAvailabilityNotice).toHaveBeenCalledWith(AVAILABILITY);
  });

  it('refuses an UNAVAILABLE special even though there is no notice to show for it', () => {
    // `useItemAvailabilityNotice` returns null for `reason: 'Unavailable'`, and unlike a card this
    // hero is not filtered out upstream — the featured query filters on IsActive, never
    // IsAvailable. Gating on the notice alone would offer Add on an item the server refuses.
    mockedNotice.mockReturnValue(null);
    const unavailable = {
      ...special,
      availability: { canOrder: false, reason: 'Unavailable', allowedOrderTypes: [] },
    } as unknown as FeaturedSpecialType;

    render(<FeaturedSpecial special={unavailable} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'add_item_to_order(Chef Special)' })).not.toBeInTheDocument();
  });

  it('hands the verdict to BOTH routes — the §9.10 hand-over lives in the banner, not the page', () => {
    const onAddToCart = jest.fn();
    const onViewDetails = jest.fn();

    render(<FeaturedSpecial special={special} onAddToCart={onAddToCart} onViewDetails={onViewDetails} />);

    fireEvent.click(screen.getByRole('button', { name: 'add_item_to_order(Chef Special)' }));
    expect(onAddToCart).toHaveBeenCalledWith({ availability: AVAILABILITY });

    fireEvent.click(screen.getByRole('button', { name: 'Chef Special' }));
    // The name forces the sheet — it must SHOW the item, never quick-add it.
    expect(onViewDetails).toHaveBeenCalledWith({ forceSheet: true, availability: AVAILABILITY });
  });

  it('keeps the <h2> a heading, so the section still announces itself with its reason', () => {
    // The card's title takes `role="button"`, which would have cost this strip its only heading AND
    // rewritten the accessible name `aria-labelledby` reads off it. A nested <button> is why the
    // localized-name and blocked-region assertions in this file still hold.
    mockedNotice.mockReturnValue(BLOCKED);

    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Chef Special' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Chef Special Takeaway and Delivery only/ })).toBeInTheDocument();
  });

  it('renders the name as plain text when no sheet handler is wired', () => {
    // The `onViewDetails` arm's other side. Without it the pinned 100% branch floor on this file
    // fails, and — more to the point — a template that omits the handler would render a button
    // wired to nothing.
    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Chef Special' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chef Special' })).not.toBeInTheDocument();
  });
});

/**
 * E4 sub-issue 2. `MenuCard` and `CraftMenuCard` both render `AdminMenuCardControls` +
 * `AdminPriceEditor`; the hero rendered neither — so an admin could edit the price of every item on
 * the page except the one the page is promoting.
 */
describe('admin controls on the hero', () => {
  const asAdmin = (yes: boolean) => (useIsAdmin as jest.Mock).mockReturnValue(yes);
  afterEach(() => asAdmin(false));

  it('renders nothing extra for a guest — the controls are not merely hidden by CSS', () => {
    asAdmin(false);
    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} />);

    expect(screen.queryByTestId('admin-edit-item')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-edit-price')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-edit-price-locked')).not.toBeInTheDocument();
  });

  it('gives an admin the deep link into the item editor', () => {
    asAdmin(true);
    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} />);

    expect(screen.getByTestId('admin-edit-item')).toHaveAttribute('href', '/admin/menu-management/p1');
  });

  it('offers the inline price edit when the special is a plain product', () => {
    asAdmin(true);
    render(<FeaturedSpecial special={{ ...special, type: 'mainItem' }} onAddToCart={jest.fn()} />);

    expect(screen.getByTestId('admin-edit-price')).toBeInTheDocument();
  });

  it('refuses WITH A REASON for a featured combo instead of rendering nothing', () => {
    // Rendering nothing is what made this look like a bug in the first place (E3): an absence with
    // no explanation is indistinguishable from a defect.
    asAdmin(true);
    render(<FeaturedSpecial special={{ ...special, type: 'menu' }} onAddToCart={jest.fn()} />);

    expect(screen.queryByTestId('admin-edit-price')).not.toBeInTheDocument();
    expect(screen.getByTestId('admin-edit-price-locked')).toBeInTheDocument();
  });

  it('refuses when the backend sent no type — the additive-field ordering case', () => {
    asAdmin(true);
    render(<FeaturedSpecial special={{ ...special, type: undefined }} onAddToCart={jest.fn()} />);

    expect(screen.getByTestId('admin-edit-price-locked')).toHaveTextContent('Open the item to edit its price');
  });

  /**
   * S14: the hero marks itself while its price is open, exactly as a catalog card does.
   *
   * Pinned separately from the card's copy rather than assumed to follow from it. The two hosts
   * wire the same callback into different elements, so nothing about the card's test constrains
   * this one — deleting the hero's wiring outright left the card's test, this file and the contrast
   * gate all green when it was tried.
   *
   * The class goes on the CONTAINER, not the `<section>`: the container is the box that carries the
   * strip's border, radius and surface, so an outline on the section would trace a rectangle nobody
   * drew. Asserted by walking down from the section for that reason — a `querySelector` for the
   * class would pass wherever it landed.
   */
  it('rings the hero while its price is being edited, and stops when the edit ends', () => {
    asAdmin(true);
    const { container } = render(
      <FeaturedSpecial special={{ ...special, type: 'mainItem' }} onAddToCart={jest.fn()} />,
    );
    const box = container.querySelector('section > div');

    expect(box).not.toHaveClass('hostEditing');

    fireEvent.click(screen.getByTestId('admin-edit-price'));
    expect(box).toHaveClass('hostEditing');

    fireEvent.click(screen.getByLabelText('Cancel'));
    expect(box).not.toHaveClass('hostEditing');
  });

  it('never rings the hero for a guest', () => {
    asAdmin(false);
    const { container } = render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} />);

    expect(container.querySelector('section > div')).not.toHaveClass('hostEditing');
  });
});

describe('localized content', () => {
  it('prefers the active locale over the base name — the hero used to print English in every locale', () => {
    render(
      <FeaturedSpecial
        special={{ ...special, content: { en: { name: 'Chef Special', description: 'Base' } } }}
        onAddToCart={jest.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Chef Special' })).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
  });
});

describe('the optional blocks', () => {
  it('renders the photo, the prep time and the allergen list when the special has them', () => {
    render(
      <FeaturedSpecial
        special={
          {
            ...special,
            imageUrl: '/uploads/kebab.jpg',
            preparationTimeMinutes: 22,
            allergens: ['gluten'],
          } as FeaturedSpecialType
        }
        onAddToCart={jest.fn()}
      />,
    );

    expect(screen.getByRole('img', { name: 'Chef Special' })).toBeInTheDocument();
    expect(screen.getByText(/22/)).toBeInTheDocument();
    expect(screen.getByText(/gluten/i)).toBeInTheDocument();
  });

  it('renders none of them when it has none — an empty frame is worse than no frame', () => {
    const { container } = render(
      <FeaturedSpecial special={{ ...special, allergens: [] } as FeaturedSpecialType} onAddToCart={jest.fn()} />,
    );

    // The PHOTO is no longer optional: it falls back to the same placeholder every catalog card
    // uses, so the promoted dish stopped being the one item on the page with no image while the
    // identical dish two cells away showed one.
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('placeholder'));
    expect(container.querySelector('[class*="featuredSpecialTime"]')).toBeNull();
  });
});

/**
 * The photoless branch. Omitting the <Image> was never the problem — the component has always done
 * that, and RUMI's live special has no photo. Nothing in the CSS reacted, so the strip went on
 * holding a photo's worth of height, and the badge (absolute over a photo that is not there) landed
 * on the dish name: measured on staging at 375px, badge bottom 143.8 against title top 135.8.
 *
 * The modifier CLASS is the assertion, not `:has(img)`: a selector the review gate and older Safari
 * treat unevenly, to express a boolean the component already holds.
 */
describe('the photoless collapse', () => {
  const noPhotoClass = (c: HTMLElement) => c.querySelector('[class*="featuredSpecialNoPhoto"]');

  it('marks the strip when the special carries no image', () => {
    const { container } = render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} />);

    // Still MARKED as photoless — the badge's in-flow fallback keys off that class — but it renders
    // the shared placeholder rather than nothing.
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('placeholder'));
    expect(noPhotoClass(container)).not.toBeNull();
  });

  it('does NOT mark it when there is a photo to lay the badge over', () => {
    const { container } = render(
      <FeaturedSpecial
        special={{ ...special, imageUrl: '/uploads/kebab.jpg' } as FeaturedSpecialType}
        onAddToCart={jest.fn()}
      />,
    );

    expect(screen.getByRole('img', { name: 'Chef Special' })).toBeInTheDocument();
    expect(noPhotoClass(container)).toBeNull();
  });

  it('keeps the badge inside the text column, ahead of the name it used to strike through', () => {
    // Position, not presence: the badge rendered before this change too. What it did not do was
    // precede the heading in the flow, which is the only arrangement that cannot overlap it.
    const { container } = render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} />);

    const details = container.querySelector('[class*="featuredSpecialDetails"]');
    const badge = container.querySelector('[class*="featuredSpecialBadge"]');
    expect(details).not.toBeNull();
    expect(details).toContainElement(badge as HTMLElement);
    expect(badge?.compareDocumentPosition(screen.getByRole('heading', { level: 2 }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  /**
   * Three stylesheet facts jsdom cannot see — it computes no layout, and no screenshot baseline
   * shoots a tablet width or a photo-bearing special, so these are the only gate on them.
   */
  describe('the stylesheet', () => {
    const CSS = readFileSync(join(__dirname, 'FeaturedSpecial.module.css'), 'utf8');
    const rule = (selector: string) => {
      const at = CSS.indexOf(selector);
      expect(at).toBeGreaterThan(-1);
      return CSS.slice(at, CSS.indexOf('}', at));
    };

    it('keeps the heading button out of the global 44px tap-target rule', () => {
      // globals.css pads EVERY button to 44px below 768px. This slice is what nested a real
      // <button> in the <h2>, so without this reset the heading row measures 44px instead of
      // 23.5px on a phone — ~20px of dead space under the dish name.
      expect(rule('.featuredSpecialTitleButton {')).toContain('min-height: 0');
    });

    it('gives the dish name a visible affordance, since it is now the only route to the sheet', () => {
      expect(CSS).toContain('.featuredSpecialTitleButton:hover');
      expect(rule('.featuredSpecialTitleButton:hover')).toContain('text-decoration: underline');
    });

    it('lets the 601-768px band grow instead of clipping its availability notice', () => {
      // A photo plus an `info` notice in a column narrow enough for a long name to wrap laid the
      // notice out below the clip box — invisible. A floor cannot clip.
      //
      // The base rule is `height: 100%` now, not a definite `180px`: the hero is a CELL of the menu
      // grid spanning two columns, so it fills the row and ends level with the dish cards beside
      // it. The floor moved to that base rule as `min-height`, and the escape band widened to 900px
      // — the width below which the hero spans the whole row and has no card beside it to match.
      const base = CSS.slice(CSS.indexOf('.featuredSpecialContainer'));
      expect(base.slice(0, base.indexOf('\n}'))).toContain('min-height: 180px');
      // The escape widened to ≤900px, which is exactly where the hero stops having a card beside it
      // to match. Above that it must FILL its grid row: `height: auto` there is what made a
      // photoless special render ~248px against 400px cards — reported, and the reason the
      // `.featuredSpecialNoPhoto` override moved into this block.
      const band = CSS.slice(CSS.indexOf('@media (max-width: 900px)'));
      expect(band).toContain('height: auto');
      expect(band).toContain('.featuredSpecialNoPhoto');
      const noPhotoBase = CSS.slice(CSS.indexOf('.featuredSpecialNoPhoto'), CSS.indexOf('@media'));
      expect(noPhotoBase).not.toContain('height: auto');
    });
  });
});
