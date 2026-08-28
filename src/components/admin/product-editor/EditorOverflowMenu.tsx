'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './EditorOverflowMenu.module.css';

export interface EditorOverflowAction {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  /** Draw it as destructive. `Delete` is the only one today, and the reason this menu exists. */
  readonly destructive?: boolean;
}

interface EditorOverflowMenuProps {
  // readonly: S6759 — component props are never mutated.
  readonly actions: readonly EditorOverflowAction[];
  /** Accessible name of the `⋯` trigger — a bare ellipsis names nothing. */
  readonly label: string;
}

/**
 * The `⋯` overflow the two approved editor screens draw at the end of the header row, and the only
 * thing in it today is **Delete** (conformance review G1, frontend #574).
 *
 * That placement is the point rather than tidiness: a destructive action rendered as a red button
 * beside `Save` is one mis-click from deleting the product the admin came to edit, and it is the one
 * place where the shipped chrome was riskier than the approved one.
 *
 * Renders nothing when it has no actions — a create route has nothing to delete, and an empty `⋯`
 * that opens an empty menu is worse than no `⋯`.
 *
 * Keyboard contract (APG menu button): `Escape` closes and returns focus to the trigger, `ArrowDown`
 * / `ArrowUp` move between items and wrap, `Tab` out closes. The items are `role="menuitem"`
 * buttons, so Enter and Space activate them natively.
 */
export default function EditorOverflowMenu({ actions, label }: EditorOverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  if (actions.length === 0) return null;

  const close = (returnFocus: boolean) => {
    setIsOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const open = (focusIndex: number) => {
    setIsOpen(true);
    // After paint: the items do not exist until the menu has rendered.
    requestAnimationFrame(() => itemRefs.current[focusIndex]?.focus());
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      open(0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      open(actions.length - 1);
    }
  };

  const onItemKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step) {
      event.preventDefault();
      itemRefs.current[(index + step + actions.length) % actions.length]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={label}
        onClick={() => (isOpen ? close(true) : setIsOpen(true))}
        onKeyDown={onTriggerKeyDown}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {isOpen && (
        <div className={styles.menu} role="menu" aria-label={label}>
          {actions.map((action, index) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              className={`${styles.item} ${action.destructive ? styles.destructive : ''}`}
              onClick={() => {
                close(true);
                action.onSelect();
              }}
              onKeyDown={(event) => onItemKeyDown(event, index)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
