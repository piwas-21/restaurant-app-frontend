'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './SheetStepPanel.module.css';

interface SheetStepPanelProps {
  /** Remount key — a step change replays the entry animation with no timers of our own. */
  stepId: string;
  /** Which way the guest moved. Drives the side the panel enters from. */
  direction: 'forward' | 'back';
  title: string;
  /** A required step marks its heading, so the `*` is not carried by the footer alone. */
  isRequired?: boolean;
  requiredLabel?: string;
  hint?: string;
  /**
   * Hold a minimum height so the footer does not jump up the screen between steps. Only the guided
   * flow wants it: a single-step sheet has nothing to be steady against, and the floor would just
   * open a gap under its one control.
   */
  steady?: boolean;
  children: ReactNode;
}

/**
 * One step's content, animated in (MENU-CUSTOMIZATION-FLOW-PLAN §3.2).
 *
 * The animation is pure CSS keyed off `stepId`: React remounts the subtree, the entry animation
 * replays, and there is no JS timer that can leave a half-transitioned panel behind if the guest
 * taps faster than the animation. Direction comes from `--dir` inside the keyframes (globals.css),
 * so ltr and rtl are one declaration rather than two animation names that can drift.
 *
 * Focus moves to the heading on every step change EXCEPT the first render, where `BaseModal` has
 * just placed focus on the dialog and stealing it would skip the item's own title.
 */
export default function SheetStepPanel({
  stepId,
  direction,
  title,
  isRequired,
  requiredLabel,
  hint,
  steady = false,
  children,
}: Readonly<SheetStepPanelProps>) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRef = useRef(true);

  useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [stepId]);

  return (
    // The key is on this INNER element on purpose, and the parent must not put one on the component
    // itself: remounting the component would reset `isFirstRef` on every step and focus would never
    // move. Keyed here, React replaces the subtree — the entry animation replays — while the refs
    // above survive.
    <div
      key={stepId}
      className={[
        styles.panel,
        direction === 'back' ? styles.enterFromStart : styles.enterFromEnd,
        steady ? styles.steady : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h3 ref={headingRef} tabIndex={-1} className={styles.heading}>
        {/* `auto` because a bundle section's name is tenant-authored (DESIGN-SYSTEM.md §8.2). Inert
            for the platform-key titles, which resolve to the UI's own direction either way. */}
        <span dir="auto">{title}</span>
        {isRequired && (
          <span className={styles.required} aria-label={requiredLabel}>
            *
          </span>
        )}
      </h3>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.content}>{children}</div>
    </div>
  );
}
