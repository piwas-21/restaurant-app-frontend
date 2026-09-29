'use client';

import React, { useRef } from 'react';
import EditorHeader from './EditorHeader';
import EditorSectionCard, { type EditorSection } from './EditorSectionCard';
import EditorSectionNav from './EditorSectionNav';
import type { EditorOverflowAction } from './EditorOverflowMenu';
import styles from './EditorShell.module.css';
import adminStyles from '@/app/styles/AdminPage.module.css';

/* The section shape lives with the component that draws it (#573); re-exported because every
   `*EditorSections.tsx` builder imports it from here. */
export type { EditorSection };

export interface EditorTab {
  readonly id: string;
  readonly label: string;
}

interface EditorShellProps {
  // readonly: S6759 — component props are never mutated.
  readonly title: string;
  /** Badges beside the title — the type badge, then the live/`Active` one (#574). */
  readonly headerBadges?: React.ReactNode;
  /** Contents of the header's `⋯` overflow. `Delete` lives here, never beside `Save` (#574). */
  readonly headerMenuActions: readonly EditorOverflowAction[];
  readonly headerMenuLabel: string;
  /** `← Menu`. The host owns the unsaved-changes guard, so this is a callback, not an href. */
  readonly backLabel: string;
  readonly backAriaLabel: string;
  readonly onBack: () => void;
  /** Exactly two (D2): the first owns {@link sections}, the second {@link translations}. */
  readonly tabs: readonly [EditorTab, EditorTab];
  readonly tabsLabel: string;
  readonly activeTabId: string;
  readonly onTabChange: (id: string) => void;
  readonly sections: readonly EditorSection[];
  readonly sectionsLabel: string;
  readonly activeSectionId: string;
  readonly onSectionChange: (id: string) => void;
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
 * Layout only: header + `Item | Translations` tabs + section tabs + main column + side rail
 * + one sticky save bar. This file must
 * stay a frame and know nothing about product fields — what the seven sections CONTAIN is
 * `itemEditorSections.tsx`'s business.
 *
 * Three shapes here are load-bearing and easy to "simplify" wrongly:
 *
 * 1. **Every tab panel stays mounted**, the inactive one hidden with the `hidden` attribute.
 *    Submit-time validation opens the tab and section with the first error, so the error is visible
 *    and react-hook-form retains every value while the admin moves between focused panels.
 * 2. **The save bar sits outside the `<form>`** and submits it through the `form` attribute. That
 *    is what lets the bar be a sibling of the whole grid — sticky across nav, main and rail.
 * 3. **The translations panel is outside the form element too**, because a form cannot be in two
 *    tab panels at once. That is safe and not sloppy: react-hook-form reads its own store, not the
 *    DOM, so `register`ed inputs there are submitted exactly as before. Only native Enter-to-submit
 *    from a translation input is given up, and the one Save is two clicks away at all times.
 */
export default function EditorShell({
  title,
  headerBadges,
  headerMenuActions,
  headerMenuLabel,
  backLabel,
  backAriaLabel,
  onBack,
  tabs,
  tabsLabel,
  activeTabId,
  onTabChange,
  sections,
  sectionsLabel,
  activeSectionId,
  onSectionChange,
  formId,
  onSubmit,
  formError,
  translations,
  rail,
  saveBar,
}: EditorShellProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isFirstTab = activeTabId === tabs[0].id;
  const showAside = isFirstTab && sections.length > 0;
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

  const panelId = (id: string) => `${formId}-panel-${id}`;
  const tabDomId = (id: string) => `${formId}-tab-${id}`;

  return (
    <div className={adminStyles.adminContainer}>
      <EditorHeader
        title={title}
        backLabel={backLabel}
        backAriaLabel={backAriaLabel}
        onBack={onBack}
        badges={headerBadges}
        menuActions={headerMenuActions}
        menuLabel={headerMenuLabel}
      />

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
            <EditorSectionNav
              entries={sections}
              activeId={activeSectionId}
              onSelect={onSectionChange}
              label={sectionsLabel}
              idPrefix={formId}
            />
          </div>
        )}

        {/* Before the main column in the DOM so status and set controls precede the form in
            keyboard order. On small screens, the section nav comes first, then the compact rail
            disclosure, then the form — the visual and reading orders agree. At 821–1024px the
            rail remains a full-width strip above the nav and form. */}
        {rail && (
          <aside className={styles.rail} hidden={!showAside}>
            {rail}
          </aside>
        )}

        <div className={styles.main}>
          <div
            role="tabpanel"
            id={panelId(tabs[0].id)}
            aria-labelledby={tabDomId(tabs[0].id)}
            hidden={!isFirstTab}
            className={styles.panel}
          >
            {/* Every section is inside the form, in §4's order (S2). S1 had to keep the image
                gallery out of it because `ConfirmationModal`'s buttons defaulted to
                `type="submit"` — "delete this image → Yes" would have saved the product. Those
                buttons are typed now, so ordering the page no longer costs an exception. */}
            <form id={formId} onSubmit={onSubmit} className={adminStyles.adminContent}>
              {formError}
              {/* Each focused section remains mounted inside the shared form. */}
              {sections.map((section) => (
                <div
                  key={section.id}
                  role="tabpanel"
                  id={`${formId}-section-panel-${section.id}`}
                  aria-labelledby={`${formId}-section-tab-${section.id}`}
                  hidden={section.id !== activeSectionId}
                  tabIndex={0}
                  className={styles.sectionPanel}
                >
                  <EditorSectionCard section={section} />
                </div>
              ))}
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
      </div>

      {saveBar}
    </div>
  );
}
