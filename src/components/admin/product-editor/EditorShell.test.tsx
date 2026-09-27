import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import EditorShell, { type EditorSection } from './EditorShell';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
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
    showHeading: true,
    node: <input aria-label="Display order" />,
  },
];

const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());

const onDelete = jest.fn();
const onBack = jest.fn();
const menuActions = [{ id: 'delete', label: 'Delete product', onSelect: onDelete, destructive: true }];

const renderShell = (activeTabId = TAB_ITEM, activeSectionId = 'sec-media') => {
  const onTabChange = jest.fn();
  const onSectionChange = jest.fn();
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
      activeSectionId={activeSectionId}
      onSectionChange={onSectionChange}
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
  return { ...view, onTabChange, onSectionChange };
};

beforeEach(() => {
  onDelete.mockClear();
  onBack.mockClear();
});

describe('EditorShell — the two tabs (decision D2)', () => {
  it('exposes exactly two tabs and marks the active one', () => {
    renderShell();

    const tabs = within(screen.getByRole('tablist', { name: 'Item editor' })).getAllByRole('tab');
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

  /** Inactive panels retain registered values while validation switches to the failing panel. */
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

    expect(screen.queryByRole('tablist', { name: 'Sections' })).not.toBeInTheDocument();
    const rail = container.querySelector('aside') as HTMLElement;
    expect(rail).toHaveAttribute('hidden');
    expect(rail.textContent).toContain('at a glance');
  });
});

describe('EditorShell — focused section tabs', () => {
  it('lists every section as a tab and exposes one selected panel', () => {
    const { container } = renderShell();

    const nav = screen.getByRole('tablist', { name: 'Sections' });
    expect(nav.querySelectorAll(':scope > [role="tab"]').length).toBe(4);
    expect(
      within(nav)
        .getAllByRole('tab')
        .map((button) => button.textContent),
    ).toEqual([MEDIA, BASICS, PRICING, ADVANCED]);
    const tabs = within(nav).getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
    const basicsPanel = container.querySelector('#editor-form-section-panel-sec-basics') as HTMLElement;
    expect(basicsPanel).toHaveAttribute('hidden');
    expect(basicsPanel.getAttribute('aria-labelledby')).toBe('editor-form-section-tab-sec-basics');
  });

  it('selects the clicked section and uses orientation-aware keyboard navigation', () => {
    const { onSectionChange } = renderShell();

    fireEvent.click(screen.getByRole('tab', { name: PRICING }));
    expect(onSectionChange).toHaveBeenCalledWith('sec-pricing');

    fireEvent.keyDown(screen.getByRole('tab', { name: MEDIA }), { key: 'ArrowDown' });
    expect(onSectionChange).toHaveBeenLastCalledWith('sec-basics');
    fireEvent.keyDown(screen.getByRole('tab', { name: MEDIA }), { key: 'End' });
    expect(onSectionChange).toHaveBeenLastCalledWith('sec-advanced');
  });

  it('keeps hidden section controls mounted and switches the visible panel', () => {
    const { container, rerender } = renderShell(TAB_ITEM, 'sec-basics');
    const basicsPanel = container.querySelector('#editor-form-section-panel-sec-basics') as HTMLElement;
    const nameInput = basicsPanel.querySelector('input[aria-label="Name"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Updated item' } });
    expect(basicsPanel).not.toHaveAttribute('hidden');

    rerender(
      <EditorShell
        title="Margherita Pizza"
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
        activeTabId={TAB_ITEM}
        onTabChange={jest.fn()}
        sections={sections}
        sectionsLabel="Sections"
        activeSectionId="sec-pricing"
        onSectionChange={jest.fn()}
        formId={FORM_ID}
        onSubmit={onSubmit}
        translations={<input aria-label="French name" />}
        saveBar={
          <button type="submit" form={FORM_ID}>
            Save
          </button>
        }
      />,
    );
    expect(basicsPanel).toHaveAttribute('hidden');
    expect(nameInput.value).toBe('Updated item');

    rerender(
      <EditorShell
        title="Margherita Pizza"
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
        activeTabId={TAB_ITEM}
        onTabChange={jest.fn()}
        sections={sections}
        sectionsLabel="Sections"
        activeSectionId="sec-basics"
        onSectionChange={jest.fn()}
        formId={FORM_ID}
        onSubmit={onSubmit}
        translations={<input aria-label="French name" />}
        saveBar={
          <button type="submit" form={FORM_ID}>
            Save
          </button>
        }
      />,
    );
    expect(basicsPanel).not.toHaveAttribute('hidden');
    expect(nameInput.value).toBe('Updated item');
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

describe('EditorShell — focused section panels', () => {
  it('keeps every section body mounted while the inactive panel is hidden', () => {
    const { container } = renderShell();

    const advancedPanel = container.querySelector('#editor-form-section-panel-sec-advanced') as HTMLElement;
    const advancedBody = container.querySelector('#sec-advanced-body') as HTMLElement;
    expect(advancedPanel).toHaveAttribute('hidden');
    expect(advancedBody).not.toHaveAttribute('hidden');
    expect(advancedBody.querySelector('input[aria-label="Display order"]')).not.toBeNull();
  });

  it('renders the section title as a heading rather than a second navigation control', () => {
    const { container } = renderShell();
    const advanced = container.querySelector('#sec-advanced') as HTMLElement;

    expect(within(advanced).getByRole('heading', { name: ADVANCED, hidden: true })).toBeInTheDocument();
    expect(advanced.querySelector('h2 button')).toBeNull();
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
    // DOCUMENT_POSITION_FOLLOWING: `main` comes after `rail`. The status summary remains first in
    // document order on tablet reflow as well as desktop.
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
    expect(ruleIn(NAV_CSS, 1024, '.nav')).toBeNull();
    expect(ruleIn(NAV_CSS, 820, '.nav')).toMatch(/flex-direction:\s*row/);
  });

  // frontend #581 item (b). `.card { flex: 1 1 16rem }` lived in EditorSideRail.module.css, but the
  // Status card's `.card` comes from ProductStatusFields.module.css and never received it — so the
  // strip came out asymmetric, one flexible card beside one sized to its content.
  it('sizes EVERY card in the tablet strip, whichever stylesheet drew it', () => {
    expect(ruleIn(SHELL_CSS, 1024, '.rail')).toMatch(/grid-column:\s*1 \/ -1/);

    const railCss = readFileSync(join(__dirname, 'EditorSideRail.module.css'), 'utf8');
    const strip = ruleIn(railCss, 1024, '.stack > section');
    expect(strip).toMatch(/flex:\s*1 1 16rem/);
    // The old module-local rule must be GONE, not merely joined: leaving it would size this
    // module's card twice and still miss the other one.
    expect(ruleIn(railCss, 1024, '.card')).toBeNull();
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

    const heading = within(basics).getByRole('heading', { name: BASICS, hidden: true });
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

  // CSS contract, for the reason the reflow test gives: jsdom computes no layout and
  // identity-obj-proxy leaves a render nothing but class names.
  it('draws the section as a bordered card on the card surface, not as a hairline rule', () => {
    expect(CARD_CSS).toMatch(/\.card\s*\{[^}]*border:\s*1px solid var\(--border-light\)/);
    expect(CARD_CSS).toMatch(/\.card\s*\{[^}]*background:\s*var\(--surface-card\)/);
    expect(CARD_CSS).toMatch(/\.card\s*\{[^}]*border-radius:/);
    // The shipped skin was a `border-top` hairline between plain blocks. It must be gone.
    expect(CARD_CSS).not.toMatch(/border-top:/);
    expect(readFileSync(join(__dirname, 'EditorShell.module.css'), 'utf8')).not.toMatch(/\.section\s*\{/);
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
