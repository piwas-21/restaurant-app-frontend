import React from 'react';
import { TriangleAlert } from 'lucide-react';
import styles from './EditorErrorSummary.module.css';

interface EditorErrorSummaryProps {
  // readonly: S6759 — component props are never mutated.
  /** How many fields are failing. Nothing renders at 0. */
  readonly count: number;
  /** Already-interpolated sentence — the caller owns the copy and the count placeholder. */
  readonly label: string;
  /** Take the admin to the first failing field. */
  readonly onJump: () => void;
}

/**
 * The save bar's error chip (MENU-ITEM-EDITOR-REDESIGN-PLAN D13 / slice S7; conformance gap G4).
 *
 * A form this long can refuse to save for a reason that is three screens away, and until now the
 * only signal was a Save that did nothing. The chip answers both halves at once — how many fields
 * are wrong, and where the first one is — and it is a BUTTON, because "jump to first" is an action
 * and the approved screen draws it as one thing you press.
 *
 * `role="status"` on the wrapper rather than on the button: the count changes as the admin fixes
 * fields, and that change is worth announcing, but wrapping an interactive element in a live region
 * is the standard way to do it without the button itself claiming a status role.
 */
export default function EditorErrorSummary({ count, label, onJump }: EditorErrorSummaryProps) {
  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      {count > 0 && (
        <button type="button" className={styles.chip} onClick={onJump} data-testid="editor-error-summary">
          <TriangleAlert size={16} aria-hidden="true" />
          {label}
        </button>
      )}
    </div>
  );
}
