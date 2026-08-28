'use client';

import React from 'react';
import styles from './EditorSectionNav.module.css';

export interface EditorNavEntry {
  readonly id: string;
  readonly label: string;
  /** Mark this entry as holding at least one validation error (G3's red `!`, slice S7). */
  readonly hasError?: boolean;
  /** Translated sentence a screen reader hears in place of the marker glyph. */
  readonly errorLabel?: string;
}

interface EditorSectionNavProps {
  // readonly: S6759 — component props are never mutated.
  readonly entries: readonly EditorNavEntry[];
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
  /** Accessible name for the landmark — several navs can exist on one admin screen. */
  readonly label: string;
}

/**
 * The sticky section nav of the redesigned item editor (plan S1, decision D1).
 *
 * It is a list of links to same-page regions, so it is a `nav` landmark of buttons rather than a
 * `tablist`: every section stays rendered and reachable by scrolling, which is the whole point of
 * D1 (tabs would hide a validation error behind an inactive tab). `aria-current` marks the section
 * in view — not `aria-selected`, which would claim a tab relationship that does not exist.
 *
 * Since S7 an entry can also carry an ERROR marker (conformance gap G3, issue #579): a nav that
 * cannot answer "where is the problem?" is doing half its job on a form this long. The glyph is
 * `aria-hidden` and paired with a visually-hidden sentence, because a screen reader announcing
 * "exclamation mark" says nothing. The amber INCOMPLETE dot the same screen draws is S10's, and
 * this component is deliberately agnostic about which one it is showing: it renders what it is
 * told, and `editorValidation.ts` decides.
 */
export default function EditorSectionNav({ entries, activeId, onSelect, label }: EditorSectionNavProps) {
  return (
    <nav className={styles.nav} aria-label={label}>
      <ul className={styles.list}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className={`${styles.item} ${entry.id === activeId ? styles.itemActive : ''}`}
              aria-current={entry.id === activeId ? 'true' : undefined}
              onClick={() => onSelect(entry.id)}
            >
              {entry.label}
              {entry.hasError && (
                <>
                  <span aria-hidden="true" className={styles.errorMarker}>
                    !
                  </span>
                  <span className={styles.srOnly}>{entry.errorLabel}</span>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
