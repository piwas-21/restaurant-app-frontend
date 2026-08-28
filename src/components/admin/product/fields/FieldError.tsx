import React from 'react';
import { CircleAlert } from 'lucide-react';
import { fieldErrorId } from './fieldAria';
import styles from './editorFields.module.css';

interface FieldErrorProps {
  // readonly: S6759 — component props are never mutated.
  /** The registered path this message belongs to — it derives the id `aria-describedby` points at. */
  readonly name: string;
  /** Nothing renders when there is no message, so callers need no conditional of their own. */
  readonly message?: string;
}

/**
 * One field's validation message (slice S7, decision D13).
 *
 * Three jobs the old bare `<p className={modalStyles.errorMessage}>` did not do: it carries the id
 * the input's `aria-describedby` points at, it is a live region so a message that appears while the
 * caret sits in the field is announced rather than silently drawn, and it renders the approved
 * screen's circled-alert icon (`admin_component_reference_sheet_dark_mode`, "Error state").
 *
 * `role="alert"` and not `aria-live="polite"`: with `onTouched` validation the message appears when
 * the user LEAVES the field, so a polite announcement would queue behind whatever the next control
 * says on focus and arrive after the user has moved on.
 */
export default function FieldError({ name, message }: FieldErrorProps) {
  if (!message) return null;

  return (
    <p id={fieldErrorId(name)} role="alert" className={styles.error}>
      <CircleAlert size={14} aria-hidden="true" className={styles.errorIcon} />
      {message}
    </p>
  );
}
