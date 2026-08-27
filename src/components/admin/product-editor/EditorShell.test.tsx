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

const sections: EditorSection[] = [
  { id: 'sec-media', label: MEDIA, outsideForm: true, node: <p>gallery body</p> },
  { id: 'sec-basics', label: BASICS, showHeading: true, node: <input aria-label="Name" /> },
  { id: 'sec-pricing', label: PRICING, node: <input aria-label="Price" /> },
];

const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());

const renderShell = (activeTabId = TAB_ITEM) => {
  const onTabChange = jest.fn();
  const view = render(
    <EditorShell
      title="Margherita Pizza"
      headerActions={<span>badge</span>}
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

  it('drops the section nav and the side rail on the translations tab', () => {
    renderShell(TAB_TRANSLATIONS);

    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument();
    expect(screen.queryByText('at a glance')).not.toBeInTheDocument();
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
    ).toEqual([MEDIA, BASICS, PRICING]);
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

    expect(observed.map((node) => node.id)).toEqual(['sec-media', 'sec-basics', 'sec-pricing']);

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

  it('renders an outsideForm section before the form, and the rest inside it', () => {
    const { container } = renderShell();

    const form = container.querySelector('form') as HTMLFormElement;
    const media = container.querySelector('#sec-media') as HTMLElement;
    expect(form.contains(media)).toBe(false);
    expect(form.compareDocumentPosition(media) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(form.contains(container.querySelector(BASICS_SELECTOR))).toBe(true);
    expect(form.textContent).toContain('root error');
  });
});
