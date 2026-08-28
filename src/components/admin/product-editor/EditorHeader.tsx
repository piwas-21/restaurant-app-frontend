'use client';

import React from 'react';
import EditorOverflowMenu, { type EditorOverflowAction } from './EditorOverflowMenu';
import styles from './EditorHeader.module.css';

interface EditorHeaderProps {
  // readonly: S6759 — component props are never mutated.
  readonly title: string;
  /** Visible text of the back link — `Menu` on both approved screens. */
  readonly backLabel: string;
  /** Its accessible name. `← Menu` alone announces "Menu", which names a destination, not an action. */
  readonly backAriaLabel: string;
  readonly onBack: () => void;
  /** The badges that sit beside the title: the type badge, then the live/`Active` one. */
  readonly badges?: React.ReactNode;
  readonly menuActions: readonly EditorOverflowAction[];
  readonly menuLabel: string;
}

/**
 * The editor's own header (conformance review G1, frontend #574).
 *
 * `admin_menu_item_editor_margherita_pizza` and `admin_bundle_editor_pizza_menu` both draw the same
 * three things the shared `PageHeader` cannot express, and §4's own ASCII diagram draws them too:
 * a `← Menu` back link ABOVE the title, the title followed by TWO badges (`Item` and `Active`), and
 * a `⋯` overflow at the end of the row holding `Delete`.
 *
 * `PageHeader` stays exactly as it is and keeps serving every other admin page — this surface simply
 * has chrome of its own, and bending the shared component into it would have made every other page
 * pay for the editor's shape.
 *
 * The back link is a BUTTON, not a `<Link>`: leaving with pending edits has to be confirmed, and the
 * host owns that guard (`ProductEditorPage.handleBack`).
 */
export default function EditorHeader({
  title,
  backLabel,
  backAriaLabel,
  onBack,
  badges,
  menuActions,
  menuLabel,
}: EditorHeaderProps) {
  return (
    <div className={styles.header}>
      <button type="button" className={styles.back} onClick={onBack} aria-label={backAriaLabel}>
        <span aria-hidden="true">←</span> {backLabel}
      </button>
      <div className={styles.titleRow}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>{title}</h1>
          {badges}
        </div>
        <EditorOverflowMenu actions={menuActions} label={menuLabel} />
      </div>
    </div>
  );
}
