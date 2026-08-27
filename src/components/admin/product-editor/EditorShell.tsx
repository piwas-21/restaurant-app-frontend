'use client';

import React, { useRef } from 'react';
import PageHeader from '@/components/admin/PageHeader';
import EditorSectionNav from './EditorSectionNav';
import { useEditorSectionNav } from '@/hooks/admin/useEditorSectionNav';
import styles from './EditorShell.module.css';
import adminStyles from '@/app/styles/AdminPage.module.css';

export interface EditorSection {
  /** DOM id — the nav scrolls to it, so it must be unique on the page. */
  readonly id: string;
  /** Nav entry text, and the section's accessible name. */
  readonly label: string;
  /** Render a visible `<h2>`. Omitted where the dropped-in content already brings its own. */
  readonly showHeading?: boolean;
  /**
   * Render OUTSIDE the `<form>`. Only the image gallery uses it: its delete confirmation is a
   * `ConfirmationModal`, whose buttons default to `type="submit"`, so nesting it would make
   * "delete this image → Yes" save the product.
   */
  readonly outsideForm?: boolean;
  readonly node: React.ReactNode;
}

export interface EditorTab {
  readonly id: string;
  readonly label: string;
}

interface EditorShellProps {
  // readonly: S6759 — component props are never mutated.
  readonly title: string;
  readonly headerActions?: React.ReactNode;
  /** Exactly two (D2): the first owns {@link sections}, the second {@link translations}. */
  readonly tabs: readonly [EditorTab, EditorTab];
  readonly tabsLabel: string;
  readonly activeTabId: string;
  readonly onTabChange: (id: string) => void;
  readonly sections: readonly EditorSection[];
  readonly sectionsLabel: string;
  readonly formId: string;
  readonly onSubmit: React.FormEventHandler<HTMLFormElement>;
  readonly formError?: React.ReactNode;
  readonly translations: React.ReactNode;
  readonly rail?: React.ReactNode;
  /** The ONE commit point (D4). Rendered outside the form; its Save uses `form={formId}`. */
  readonly saveBar: React.ReactNode;
}

/**
 * The redesigned admin item editor's shell (MENU-ITEM-EDITOR-REDESIGN-PLAN §4, slice S1).
 *
 * Layout only: header + `Item | Translations` tabs + sticky section nav + main column + side rail
 * + one sticky save bar. S1 drops today's sections in unchanged — re-grouping them into §4's seven
 * is S2 — so this file must stay a frame and know nothing about product fields.
 *
 * Three shapes here are load-bearing and easy to "simplify" wrongly:
 *
 * 1. **Both tab panels stay mounted**, the inactive one hidden with the `hidden` attribute. D1
 *    rejected tabs for the sections precisely because a submit-time validation error behind an
 *    inactive tab is invisible; the same argument applies to the two tabs we DO ship, and this is
 *    the answer to it. The error stays in the DOM, scroll-to-first-error (S7) can reach it, and no
 *    react-hook-form field unmounts when the admin switches tab.
 * 2. **The save bar sits outside the `<form>`** and submits it through the `form` attribute. That
 *    is what lets the bar be a sibling of the whole grid — sticky across nav, main and rail —
 *    while the gallery stays outside the form for the reason in {@link EditorSection.outsideForm}.
 * 3. **The translations panel is outside the form element too**, because a form cannot be in two
 *    tab panels at once. That is safe and not sloppy: react-hook-form reads its own store, not the
 *    DOM, so `register`ed inputs there are submitted exactly as before. Only native Enter-to-submit
 *    from a translation input is given up, and the one Save is two clicks away at all times.
 */
export default function EditorShell({
  title,
  headerActions,
  tabs,
  tabsLabel,
  activeTabId,
  onTabChange,
  sections,
  sectionsLabel,
  formId,
  onSubmit,
  formError,
  translations,
  rail,
  saveBar,
}: EditorShellProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const sectionIds = sections.map((section) => section.id);
  const isFirstTab = activeTabId === tabs[0].id;
  const showAside = isFirstTab && sections.length > 0;
  const { activeId, goTo } = useEditorSectionNav(sectionIds, isFirstTab);

  // APG tab pattern: the tablist is ONE tab stop, arrows move between tabs.
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === activeTabId);
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onTabChange(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const renderSection = (section: EditorSection) => (
    <section
      key={section.id}
      id={section.id}
      // -1 so `goTo` can move focus into the section it just scrolled to, without adding a tab stop.
      tabIndex={-1}
      aria-label={section.label}
      className={styles.section}
    >
      {section.showHeading && <h2 className={styles.sectionHeading}>{section.label}</h2>}
      {section.node}
    </section>
  );

  const panelId = (id: string) => `${formId}-panel-${id}`;
  const tabDomId = (id: string) => `${formId}-tab-${id}`;

  return (
    <div className={adminStyles.adminContainer}>
      <PageHeader title={title}>{headerActions}</PageHeader>

      <div className={styles.tabs} role="tablist" aria-label={tabsLabel}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabDomId(tab.id)}
            ref={(node) => {
              tabRefs.current[tab.id] = node;
            }}
            aria-selected={tab.id === activeTabId}
            aria-controls={panelId(tab.id)}
            tabIndex={tab.id === activeTabId ? 0 : -1}
            className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''}`}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={onTabKeyDown}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={`${styles.layout} ${showAside ? '' : styles.layoutPlain}`}>
        {/* The nav and the rail are wrapped in STRETCHED grid items on purpose: a `position: sticky`
            element is positioned inside its PARENT's box, so making the nav itself the grid item
            would size that box to the nav's own height and leave the sticky nothing to travel over. */}
        {showAside && (
          <div className={styles.navColumn}>
            <EditorSectionNav entries={sections} activeId={activeId} onSelect={goTo} label={sectionsLabel} />
          </div>
        )}

        <div className={styles.main}>
          <div
            role="tabpanel"
            id={panelId(tabs[0].id)}
            aria-labelledby={tabDomId(tabs[0].id)}
            hidden={!isFirstTab}
            className={styles.panel}
          >
            {sections.filter((section) => section.outsideForm).map(renderSection)}
            <form id={formId} onSubmit={onSubmit} className={adminStyles.adminContent}>
              {formError}
              {sections.filter((section) => !section.outsideForm).map(renderSection)}
            </form>
          </div>

          <div
            role="tabpanel"
            id={panelId(tabs[1].id)}
            aria-labelledby={tabDomId(tabs[1].id)}
            hidden={isFirstTab}
            className={styles.panel}
          >
            {translations}
          </div>
        </div>

        {showAside && rail && <aside className={styles.rail}>{rail}</aside>}
      </div>

      {saveBar}
    </div>
  );
}
