import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import EditorShell, { type EditorSection } from './EditorShell';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

/**
 * jsdom implements neither `IntersectionObserver` nor `scrollIntoView`, and the section nav is
 * built on both. The stub here is drivable — `fireIntersections` replays what the browser would
 * report — so "the nav marks the section you are looking at" is an assertion and not a guess.
 */
interface IntersectionReport {
  readonly target: Element;
  readonly isIntersecting: boolean;
}

let observed: Element[] = [];
let fireIntersections: (reports: IntersectionReport[]) => void = () => {};

class MockIntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];

  constructor(callback: IntersectionObserverCallback) {
    fireIntersections = (reports) =>
      callback(reports as unknown as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }

  observe(element: Element) {
    observed.push(element);
  }
  unobserve() {}
  disconnect() {
    observed = [];
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeAll(() => {
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver;
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  observed = [];
  (Element.prototype.scrollIntoView as jest.Mock).mockClear();
});

const TAB_ITEM = 'item';
const TAB_TRANSLATIONS = 'translations';
const FORM_ID = 'editor-form';
const SAVE = 'editor-save';
const MEDIA = 'Media';
const BASICS = 'Basics';
const PRICING = 'Pricing';
const ITEM_PANEL = '#editor-form-panel-item';
const TRANSLATIONS_PANEL = '#editor-form-panel-translations';
const BASICS_SELECTOR = '#sec-basics';
const PRICING_SELECTOR = '#sec-pricing';

const ADVANCED = 'Advanced';

const sections: EditorSection[] = [
  { id: 'sec-media', label: MEDIA, node: <p>gallery body</p> },
  {
    id: 'sec-basics',
    label: BASICS,
    showHeading: true,
    description: 'Core item identity and descriptions',
    node: <input aria-label="Name" />,
  },
  { id: 'sec-pricing', label: PRICING, node: <input aria-label="Price" /> },
  {
    id: 'sec-advanced',
    label: ADVANCED,
    collapsible: true,
    defaultCollapsed: true,
    node: <input aria-label="Display order" />,
  },
];

const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());

const onDelete = jest.fn();
const onBack = jest.fn();
const menuActions = [{ id: 'delete', label: 'Delete product', onSelect: onDelete, destructive: true }];

const renderShell = (activeTabId = TAB_ITEM) => {
  const onTabChange = jest.fn();
  const view = render(
    <EditorShell
      title="Margherita Pizza"
      headerBadges={<span>badge</span>}
      headerMenuActions={menuActions}
      headerMenuLabel="More actions"
      backLabel="Menu"
      backAriaLabel="Back to the menu list"
      onBack={onBack}
      tabs={[
        { id: TAB_ITEM, label: 'Item' },
        { id: TAB_TRANSLATIONS, label: 'Translations' },
      ]}
      tabsLabel="Item editor"
      activeTabId={activeTabId}
      onTabChange={onTabChange}
      sections={sections}
      sectionsLabel="Sections"
      formId={FORM_ID}
      onSubmit={onSubmit}
      formError={<p>root error</p>}
      translations={<input aria-label="French name" />}
      rail={<p>at a glance</p>}
      saveBar={
        <button type="submit" form={FORM_ID} data-testid={SAVE}>
          Save
        </button>
      }
    />,
  );
  return { ...view, onTabChange };
};

beforeEach(() => {
  onDelete.mockClear();
  onBack.mockClear();
});

describe('EditorShell — the two tabs (decision D2)', () => {
  it('exposes exactly two tabs and marks the active one', () => {
    renderShell();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Item', 'Translations']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    // Roving tabindex: the tablist is one tab stop, arrows move within it (WAI-ARIA APG).
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
  });

  it('switches tab on click, and each tab controls its own panel', () => {
    const { onTabChange, rerender } = renderShell();

    fireEvent.click(screen.getByRole('tab', { name: 'Translations' }));
    expect(onTabChange).toHaveBeenCalledWith(TAB_TRANSLATIONS);

    rerender(<div />);
    renderShell(TAB_TRANSLATIONS);
    expect(screen.getByLabelText('French name')).toBeVisible();
  });

  it('moves between tabs with the arrow keys', () => {
    const { onTabChange } = renderShell();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Item' }), { key: 'ArrowRight' });
    expect(onTabChange).toHaveBeenCalledWith(TAB_TRANSLATIONS);

    onTabChange.mockClear();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Item' }), { key: 'ArrowLeft' });
    expect(onTabChange).toHaveBeenCalledWith(TAB_TRANSLATIONS);
  });

  /**
   * The reason D1 refused tabs for the SECTIONS is that a submit-time validation error behind an
   * inactive tab is invisible. The two tabs we do ship answer that by never unmounting: the hidden
   * panel keeps its inputs in the DOM, so react-hook-form loses nothing and S7's
   * scroll-to-first-error can still reach a field the admin cannot currently see.
   */
  it('keeps the inactive panel mounted rather than unmounting it', () => {
    const { container } = renderShell(TAB_TRANSLATIONS);

    const itemPanel = container.querySelector(ITEM_PANEL) as HTMLElement;
    expect(itemPanel).toHaveAttribute('hidden');
    expect(itemPanel.querySelector('input[aria-label="Price"]')).not.toBeNull();
  });

  // The nav goes (there are no sections to navigate on that tab); the rail only HIDES. Since S2 it
  // carries the item's status flags, and a registered field that unmounts is one the PUT can clear.
  it('drops the section nav on the translations tab, and hides the rail without unmounting it', () => {
    const { container } = renderShell(TAB_TRANSLATIONS);

    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument();
    const rail = container.querySelector('aside') as HTMLElement;
    expect(rail).toHaveAttribute('hidden');
    expect(rail.textContent).toContain('at a glance');
  });
});

describe('EditorShell — the sticky section nav (decision D1)', () => {
  it('lists every section as a same-page jump, not as a tab', () => {
    renderShell();

    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((button) => button.textContent),
      // A collapsed section is still LISTED: folding it is not hiding it, and the nav is the map.
    ).toEqual([MEDIA, BASICS, PRICING, ADVANCED]);
    // A nav of buttons, never a second tablist — every section stays rendered and scrollable.
    expect(within(nav).queryAllByRole('tab')).toHaveLength(0);
  });

  it('scrolls to the clicked section, marks it current, and moves focus into it', () => {
    const { container } = renderShell();

    fireEvent.click(screen.getByRole('button', { name: PRICING }));

    const pricing = container.querySelector(PRICING_SELECTOR) as HTMLElement;
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect((Element.prototype.scrollIntoView as jest.Mock).mock.instances[0]).toBe(pricing);
    expect(screen.getByRole('button', { name: PRICING })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: MEDIA })).not.toHaveAttribute('aria-current');
    // tabIndex={-1} on the section is what makes this possible without adding a tab stop.
    expect(document.activeElement).toBe(pricing);
  });

  it('observes every section and follows the topmost one on screen', () => {
    const { container } = renderShell();

    expect(observed.map((node) => node.id)).toEqual(['sec-media', 'sec-basics', 'sec-pricing', 'sec-advanced']);

    act(() =>
      fireIntersections([
        { target: container.querySelector(BASICS_SELECTOR) as Element, isIntersecting: true },
        { target: container.querySelector(PRICING_SELECTOR) as Element, isIntersecting: true },
      ]),
    );

    // Both are on screen; the nav follows section ORDER, so the first one wins.
    expect(screen.getByRole('button', { name: BASICS })).toHaveAttribute('aria-current', 'true');

    act(() =>
      fireIntersections([{ target: container.querySelector(BASICS_SELECTOR) as Element, isIntersecting: false }]),
    );
    expect(screen.getByRole('button', { name: PRICING })).toHaveAttribute('aria-current', 'true');
  });
});

describe('EditorShell — one Save, and the form it commits (decision D4)', () => {
  it('renders exactly one submit button, outside the form, wired by the form attribute', () => {
    const { container } = renderShell();

    const submits = container.querySelectorAll('button[type="submit"]');
    expect(submits).toHaveLength(1);

    const form = container.querySelector('form') as HTMLFormElement;
    const save = screen.getByTestId(SAVE);
    expect(form.contains(save)).toBe(false);
    expect(save.getAttribute('form')).toBe(form.id);
  });

  it('keeps the save bar outside both tab panels, so it never hides with one', () => {
    const { container } = renderShell(TAB_TRANSLATIONS);

    const save = screen.getByTestId(SAVE);
    expect(container.querySelector(ITEM_PANEL)?.contains(save)).toBe(false);
    expect(container.querySelector(TRANSLATIONS_PANEL)?.contains(save)).toBe(false);
    expect(save).toBeVisible();
  });

  // S1 kept the image gallery OUT of the form because `ConfirmationModal`'s buttons defaulted to
  // `type="submit"`. S2 typed those buttons, so the exception is gone and every section can sit in
  // the form in §4's own order — which is the only way Media can be section 2 rather than the
  // first thing on the page.
  it('renders every section inside the form, in the order it was given them', () => {
    const { container } = renderShell();

    const form = container.querySelector('form') as HTMLFormElement;
    expect(Array.from(form.querySelectorAll('section')).map((node) => node.id)).toEqual([
      'sec-media',
      'sec-basics',
      'sec-pricing',
      'sec-advanced',
    ]);
    expect(form.textContent).toContain('root error');
  });
});

describe('EditorShell — the one section that folds (decision D1)', () => {
  beforeEach(() => window.localStorage.clear());

  it('gives a collapsible section a heading button wired to its own body', () => {
    const { container } = renderShell();

    // Scoped to the section: the nav lists an entry by the same name, and that is the point of the
    // nav — the fold is a control ON the section, not a second way to navigate to it.
    const toggle = within(container.querySelector('#sec-advanced') as HTMLElement).getByRole('button');
    const body = container.querySelector('#sec-advanced-body') as HTMLElement;
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle.getAttribute('aria-controls')).toBe(body.id);
    expect(body).toHaveAttribute('hidden');
    // Hidden, never unmounted: the field is still registered and still submitted (plan §6).
    expect(body.querySelector('input[aria-label="Display order"]')).not.toBeNull();
  });

  it('leaves every other section open, and without a toggle', () => {
    const { container } = renderShell();

    expect(container.querySelector('#sec-basics-body')).not.toHaveAttribute('hidden');
    expect(container.querySelector('#sec-basics h2 button')).toBeNull();
  });

  it('folds and unfolds on click', () => {
    const { container } = renderShell();
    const toggle = within(container.querySelector('#sec-advanced') as HTMLElement).getByRole('button');

    fireEvent.click(toggle);
    expect(container.querySelector('#sec-advanced-body')).not.toHaveAttribute('hidden');

    fireEvent.click(toggle);
    expect(container.querySelector('#sec-advanced-body')).toHaveAttribute('hidden');
  });
});

/*
  The tablet reflow (frontend #572, gap G7 of the conformance review).

  Two halves, because the regression had two halves. The DOM order is asserted against the rendered
  tree; the breakpoints themselves are asserted against the stylesheet, since jsdom computes no
  layout and identity-obj-proxy means a class name is all a render can ever show. A CSS-contract
  assertion is the house pattern for exactly this (`design-system/modalChrome.test.ts`).
*/
describe('EditorShell — the 1024/820 reflow (frontend #572)', () => {
  const SHELL_CSS = readFileSync(join(__dirname, 'EditorShell.module.css'), 'utf8');
  const NAV_CSS = readFileSync(join(__dirname, 'EditorSectionNav.module.css'), 'utf8');

  /** The declaration block of `selector` inside the `max-width: <px>` media query, or null. */
  const ruleIn = (css: string, px: number, selector: string): string | null => {
    const query = new RegExp(`@media\\s*\\(max-width:\\s*${px}px\\)\\s*\\{`, 'g');
    const opened = query.exec(css);
    if (!opened) return null;
    // Walk braces from the media query's own `{` to find where the block ends.
    let depth = 1;
    let end = query.lastIndex;
    while (end < css.length && depth > 0) {
      if (css[end] === '{') depth += 1;
      if (css[end] === '}') depth -= 1;
      end += 1;
    }
    const block = css.slice(query.lastIndex, end - 1);
    const rule = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(block);
    return rule ? rule[1] : null;
  };

  it('renders the rail BEFORE the main column, so no breakpoint can bury the status flags', () => {
    const { container } = renderShell();

    const rail = container.querySelector('aside') as HTMLElement;
    const main = container.querySelector('form') as HTMLElement;
    expect(rail).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING: `main` comes after `rail`. The regression was the reverse — the
    // rail (which holds Active / Available today / Special of the day since S2) landed after ~150
    // controls the moment the grid collapsed.
    expect(rail.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeFalsy();
  });

  it('keeps two columns at 1024px and puts the rail on the row ABOVE the form', () => {
    expect(ruleIn(SHELL_CSS, 1024, '.layout')).toMatch(/grid-template-columns:\s*200px\s+minmax\(0,\s*1fr\)/);
    expect(ruleIn(SHELL_CSS, 1024, '.rail')).toMatch(/grid-row:\s*1/);
    expect(ruleIn(SHELL_CSS, 1024, '.main')).toMatch(/grid-row:\s*2/);
    expect(ruleIn(SHELL_CSS, 1024, '.navColumn')).toMatch(/grid-row:\s*2/);
  });

  it('leaves the section nav a vertical column at 1024px and only strips it at 820px', () => {
    expect(ruleIn(NAV_CSS, 1024, '.list')).toBeNull();
    expect(ruleIn(NAV_CSS, 820, '.list')).toMatch(/flex-direction:\s*row/);
  });

  it('collapses to one column only at 820px, still with the rail first', () => {
    expect(ruleIn(SHELL_CSS, 820, '.layout')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(ruleIn(SHELL_CSS, 820, '.rail')).toMatch(/grid-row:\s*1/);
    expect(ruleIn(SHELL_CSS, 820, '.main')).toMatch(/grid-row:\s*3/);
  });
});

/*
  The section CARD (frontend #573, gap G2). Every approved section screen draws a bordered surface
  with a title AND a one-line description; S1/S2 shipped a hairline and no description at all.
*/
describe('EditorShell — sections are cards with a description line (frontend #573)', () => {
  const CARD_CSS = readFileSync(join(__dirname, 'EditorSectionCard.module.css'), 'utf8');

  it('renders the description under the section title', () => {
    const { container } = renderShell();
    const basics = container.querySelector(BASICS_SELECTOR) as HTMLElement;

    const heading = within(basics).getByRole('heading', { name: BASICS });
    const description = within(basics).getByText('Core item identity and descriptions');
    expect(description.tagName).toBe('P');
    // Under the title, not before it, and not inside it — a description inside the heading would
    // join the heading's text and read as one long title.
    expect(heading.contains(description)).toBe(false);
    expect(heading.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('omits the line — and the whole head — for a section that has neither', () => {
    const { container } = renderShell();
    const media = container.querySelector('#sec-media') as HTMLElement;

    // `Media` passes no `showHeading` and no `description`: the dropped-in content brings its own
    // heading, so an empty head block would be a stray gap above it.
    expect(within(media).queryByRole('heading')).toBeNull();
    expect(media.querySelectorAll('p')).toHaveLength(1); // the body's own <p>, not a description
  });

  it('describes the fold toggle with the collapsed section own description', () => {
    const { container } = render(
      <EditorShell
        title="t"
        headerBadges={null}
        headerMenuActions={[]}
        headerMenuLabel="More actions"
        backLabel="Menu"
        backAriaLabel="Back to the menu list"
        onBack={onBack}
        tabs={[
          { id: TAB_ITEM, label: 'Item' },
          { id: TAB_TRANSLATIONS, label: 'Translations' },
        ]}
        tabsLabel="Item editor"
        activeTabId={TAB_ITEM}
        onTabChange={jest.fn()}
        sections={[
          {
            id: 'sec-advanced',
            label: ADVANCED,
            collapsible: true,
            defaultCollapsed: true,
            description: 'Settings you rarely need to change',
            node: <input aria-label="Display order" />,
          },
        ]}
        sectionsLabel="Sections"
        formId={FORM_ID}
        onSubmit={onSubmit}
        translations={null}
        saveBar={null}
      />,
    );

    const toggle = within(container.querySelector('#sec-advanced') as HTMLElement).getByRole('button');
    expect(toggle).toHaveAccessibleDescription('Settings you rarely need to change');
  });

  // CSS contract, for the reason the reflow test gives: jsdom computes no layout and
  // identity-obj-proxy leaves a render nothing but class names.
  it('draws the section as a bordered card on the card surface, not as a hairline rule', () => {
    expect(CARD_CSS).toMatch(/\.card\s*\{[^}]*border:\s*1px solid var\(--border-light\)/);
    expect(CARD_CSS).toMatch(/\.card\s*\{[^}]*background:\s*var\(--surface-card\)/);
    expect(CARD_CSS).toMatch(/\.card\s*\{[^}]*border-radius:/);
    // The shipped skin was a `border-top` hairline between plain blocks. It must be gone.
    expect(CARD_CSS).not.toMatch(/border-top:/);
    expect(readFileSync(join(__dirname, 'EditorShell.module.css'), 'utf8')).not.toContain('.section');
  });
});

/*
  Header chrome (frontend #574, gap G1): `← Menu`, the live badge, and `Delete` behind the `⋯`
  instead of exposed beside `Save`.
*/
describe('EditorShell — header chrome (frontend #574)', () => {
  it('offers a back link above the title, with a name that says what it does', () => {
    const { container } = renderShell();

    const back = screen.getByRole('button', { name: 'Back to the menu list' });
    const title = screen.getByRole('heading', { level: 1, name: 'Margherita Pizza' });
    expect(back.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.textContent).toContain('Menu');

    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders the badges beside the title', () => {
    renderShell();

    expect(screen.getByText('badge')).toBeInTheDocument();
  });

  it('keeps Delete OUT of the header row and inside the overflow menu', () => {
    renderShell();

    // Closed: the destructive action is not on the page at all, so it cannot be mis-clicked.
    expect(screen.queryByRole('button', { name: 'Delete product' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    const item = screen.getByRole('menuitem', { name: 'Delete product' });
    expect(item).toBeInTheDocument();

    fireEvent.click(item);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
