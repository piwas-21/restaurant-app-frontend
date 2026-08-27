'use client';

import React from 'react';
import styles from './EditorSectionNav.module.css';

export interface EditorNavEntry {
  readonly id: string;
  readonly label: string;
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
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
