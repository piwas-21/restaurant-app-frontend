'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './EditorSectionNav.module.css';

export interface EditorNavEntry {
  readonly id: string;
  readonly label: string;
  readonly hasError?: boolean;
  readonly errorLabel?: string;
}

interface EditorSectionNavProps {
  readonly entries: readonly EditorNavEntry[];
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
  readonly label: string;
  readonly idPrefix: string;
}

/** Keyboard accessible section tabs; every associated panel stays mounted in the form. */
export default function EditorSectionNav({ entries, activeId, onSelect, label, idPrefix }: EditorSectionNavProps) {
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('vertical');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const update = () => setOrientation(window.innerWidth <= 820 ? 'horizontal' : 'vertical');
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const selectByKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (entries.length === 0) return;
    const step =
      orientation === 'vertical'
        ? { ArrowDown: 1, ArrowUp: -1 }[event.key]
        : { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const currentIndex = entries.findIndex((entry) => entry.id === activeId);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? entries.length - 1
          : step === undefined
            ? -1
            : (currentIndex + step + entries.length) % entries.length;
    if (nextIndex < 0 || nextIndex >= entries.length) return;

    event.preventDefault();
    const next = entries[nextIndex];
    onSelect(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const tabId = (id: string) => `${idPrefix}-section-tab-${id}`;
  const panelId = (id: string) => `${idPrefix}-section-panel-${id}`;

  return (
    <div
      className={styles.nav}
      role="tablist"
      aria-label={label}
      aria-orientation={orientation}
      data-testid="editor-section-nav"
    >
      <ul className={styles.list}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              role="tab"
              id={tabId(entry.id)}
              aria-selected={entry.id === activeId}
              aria-controls={panelId(entry.id)}
              aria-describedby={entry.hasError ? `${entry.id}-error` : undefined}
              tabIndex={entry.id === activeId ? 0 : -1}
              ref={(node) => {
                tabRefs.current[entry.id] = node;
              }}
              className={`${styles.item} ${entry.id === activeId ? styles.itemActive : ''}`}
              onClick={() => onSelect(entry.id)}
              onKeyDown={selectByKey}
            >
              {entry.label}
              {entry.hasError && (
                <>
                  <span aria-hidden="true" className={styles.errorMarker}>
                    !
                  </span>
                  <span id={`${entry.id}-error`} className={styles.srOnly}>
                    {entry.errorLabel}
                  </span>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
