'use client';

import React from 'react';
import styles from './EditorSectionCard.module.css';

export interface EditorSection {
  /** DOM id — the nav scrolls to it, so it must be unique on the page. */
  readonly id: string;
  /** Nav entry text, and the section's accessible name. */
  readonly label: string;
  /**
   * The one-line explanation every approved screen draws under the card title — "Core item identity
   * and descriptions", "Photos and gallery assets". Optional only because the bundle's `Details`
   * card is a different shape; an item section without one is a conformance gap (frontend #573).
   */
  readonly description?: string;
  /** Render a visible `<h2>`. Omitted where the dropped-in content already brings its own. */
  readonly showHeading?: boolean;
  /**
   * Give the section a heading BUTTON that folds its body away. `Advanced` is the only one (D1):
   * every other section stays open, because a collapsed accordion is the exact complaint the
   * redesign is answering. The choice is remembered per user.
   */
  readonly collapsible?: boolean;
  /** Collapsed on a first visit, before any remembered choice exists. */
  readonly defaultCollapsed?: boolean;
  /**
   * Nav-only markers (S7 / conformance gap G3). The card itself draws nothing for them: the
   * approved screen puts the `!` in the NAV, beside the section name, and `EditorSectionNav`
   * renders what it is told. `editorValidation.ts` decides which section earns one.
   */
  readonly hasError?: boolean;
  readonly errorLabel?: string;
  readonly node: React.ReactNode;
}

interface EditorSectionCardProps {
  // readonly: S6759 — component props are never mutated.
  readonly section: EditorSection;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}

/**
 * One section of the item editor, drawn as the bordered CARD every approved screen shows
 * (`basics_media_details_margherita_pizza` and the three other section screens): a surface with a
 * title, a one-line description under it, and its controls inside.
 *
 * S1/S2 shipped the sections as plain blocks separated by a `border-top` hairline and with no
 * description line at all, which reads as one long form — the *"9 flat sections on one scroll"* look
 * the redesign exists to replace (conformance review G2, frontend #573).
 *
 * Split out of `EditorShell` rather than grown inside it: the shell was already at the 200-LOC CSS
 * gate, and a section's skin is not the shell's business.
 *
 * The body is HIDDEN when collapsed, never unmounted — a registered field that leaves the DOM is a
 * value the PUT can clear (plan §6). Same rule as the inactive tab panel and the rail.
 */
export default function EditorSectionCard({ section, collapsed, onToggle }: EditorSectionCardProps) {
  const bodyId = `${section.id}-body`;
  const descriptionId = `${section.id}-description`;
  const description = section.description && (
    <p id={descriptionId} className={styles.description}>
      {section.description}
    </p>
  );

  return (
    <section
      id={section.id}
      // -1 so the nav can move focus into the section it just scrolled to, without adding a tab stop.
      tabIndex={-1}
      aria-label={section.label}
      className={styles.card}
    >
      {section.collapsible ? (
        <div className={styles.head}>
          <h2 className={styles.heading}>
            <button
              type="button"
              className={styles.collapseToggle}
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              // The description explains the section, so it describes the control that reveals it.
              aria-describedby={section.description ? descriptionId : undefined}
              onClick={onToggle}
            >
              {section.label}
              <span aria-hidden="true" className={collapsed ? styles.chevron : styles.chevronOpen}>
                ⌄
              </span>
            </button>
          </h2>
          {description}
        </div>
      ) : (
        (section.showHeading || section.description) && (
          <div className={styles.head}>
            {section.showHeading && <h2 className={styles.heading}>{section.label}</h2>}
            {description}
          </div>
        )
      )}
      <div id={bodyId} hidden={collapsed} className={styles.body}>
        {section.node}
      </div>
    </section>
  );
}
