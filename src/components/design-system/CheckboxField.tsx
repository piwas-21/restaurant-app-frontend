'use client';

import { useCallback, useId } from 'react';
import defaultStyles from './CheckboxField.module.css';

export interface CheckboxFieldProps {
  /** Visible label, rendered beside the box. Always required — see `srOnlyLabel`. */
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /**
   * Hide the label visually while keeping it in the accessible name. For a checkbox in a table
   * cell, where the column header carries the meaning on screen but a screen reader landing on the
   * control still needs to know what it toggles.
   *
   * NOT the same as the `aria-label` both order-type surfaces used before this component existed:
   * a real `<label>` is clickable, which roughly triples the hit target of a 13px box.
   */
  srOnlyLabel?: boolean;
  /** Error message; renders below the label, sets `aria-invalid` and wires `aria-describedby`. */
  error?: string;
  /**
   * Mark the box invalid WITHOUT giving it a message of its own. For a group whose failure belongs
   * to the set rather than to any one box ("pick at least one"), where the message is rendered once
   * beside the group but every control still has to report itself invalid to a screen reader.
   */
  invalid?: boolean;
  /** Extra explanation under the label — e.g. why a box is disabled. */
  description?: string;
  /**
   * Ids of text OUTSIDE this component that describes the box — a group-level error, typically.
   * Merged with this component's own description/error ids.
   *
   * It exists because putting the id on the wrapping element does not work: a `<div>` is
   * `role="generic"` and is not exposed in the accessibility tree at all, so an
   * `aria-describedby` there describes nothing. The description has to reach the INPUT.
   */
  describedBy?: string;
  /**
   * Host stylesheet, for a surface that needs a different skin. Must define `field`, `control`,
   * `input`, `label`, `srOnly`, `disabled`, `description` and `error`. Omit it for the
   * design-system look.
   *
   * The `MenuCardAvailability` recipe: one markup + behaviour, the host supplies the CSS module, so
   * two surfaces can look nothing alike without a second DOM to keep in step.
   */
  styles?: Readonly<Record<string, string>>;
  /**
   * The THIRD state: some but not all of what this box governs is selected.
   *
   * It is a DOM property and not an attribute — there is no `indeterminate=""` in HTML — so React
   * cannot set it declaratively and it is applied through a ref. `aria-checked="mixed"` is set
   * beside it because the visual dash and the announced state are two different channels, and a
   * screen reader reads the ARIA one.
   *
   * `checked` still means what it says. An indeterminate box whose `checked` is false is what a
   * partly-picked group looks like, and clicking it fires `onChange(true)` — select the rest —
   * which is what the dash affords.
   */
  indeterminate?: boolean;
  /** Test hook, forwarded to the input. */
  'data-testid'?: string;
}

/**
 * A labelled checkbox — the design system's fourth primitive, and the one that was missing.
 *
 * `FormField` handles label-above-input; a checkbox is label-BESIDE-input and cannot use it without
 * the label ending up in the wrong place. So every checkbox in the app was a raw `<input>`, which
 * is why the two order-type surfaces (BUGS-IMPROVEMENTS-PLAN E2) had nothing consistent to be:
 * `src/components/design-system/` held exactly four components and none of them was this.
 *
 * The `<label>` wraps the input and NOTHING ELSE but the visible label text. That boundary is
 * load-bearing, not tidiness: HTML-AAM's label-content rule makes every text node inside the label
 * part of the accessible NAME, so a description and an error rendered in there turn the name from
 * "Delivery" into "Delivery Inherited from the category Pick at least one" — announced once as the
 * name and again as the description. Measured, not assumed; pinned by a test below.
 *
 * Nesting the input still means the association needs no id; the generated ids exist only for
 * `aria-describedby`.
 */
export default function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
  srOnlyLabel,
  error,
  invalid,
  description,
  describedBy,
  indeterminate,
  styles = defaultStyles,
  'data-testid': testId,
}: Readonly<CheckboxFieldProps>) {
  const uid = useId();

  /**
   * `indeterminate` exists ONLY as a DOM property — there is no `indeterminate=""` in HTML — so it
   * cannot be passed as a prop and has to be written to the node.
   *
   * A CALLBACK REF rather than `useRef` + `useEffect`, for two reasons. It writes the property in
   * the same commit that creates the node, so there is no frame in which a mixed box renders empty;
   * and React invokes it with `null` on unmount, so the null branch is REAL and reachable rather
   * than a guard that can never be false — which is what a 100% branch threshold is asking about.
   *
   * The value is written on both branches, including `false`: setting it only when true would leave
   * a box that had once been mixed showing a dash for the rest of its life.
   */
  const applyIndeterminate = useCallback(
    (node: HTMLInputElement | null) => {
      if (node) {
        node.indeterminate = indeterminate === true;
      }
    },
    [indeterminate],
  );
  const errorId = `${uid}-error`;
  const descriptionId = `${uid}-description`;
  // Ordered so a screen reader hears the host's context, then this box's explanation, then its
  // failure — the order they are read on screen.
  const allDescribedBy = [describedBy, description ? descriptionId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={disabled ? `${styles.field} ${styles.disabled}` : styles.field}>
      <label className={styles.control}>
        <input
          ref={applyIndeterminate}
          type="checkbox"
          className={styles.input}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          aria-checked={indeterminate ? 'mixed' : undefined}
          aria-invalid={error || invalid ? true : undefined}
          aria-describedby={allDescribedBy || undefined}
          data-testid={testId}
        />
        <span className={srOnlyLabel ? styles.srOnly : styles.label}>{label}</span>
      </label>
      {description && (
        <span id={descriptionId} className={styles.description}>
          {description}
        </span>
      )}
      {error && (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
