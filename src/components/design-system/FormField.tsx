'use client';

import { Children, cloneElement, isValidElement, useId } from 'react';
import type { ReactElement, ReactNode } from 'react';
import styles from './FormField.module.css';

export interface FormFieldProps {
  /** Visible label rendered above the input. */
  label: string;
  /** Optional error message; renders below the input when non-empty. */
  error?: string;
  /** Hidden visually but read by screen readers when no label is desired. */
  srOnlyLabel?: boolean;
  /** The input element (or anything that takes a label). */
  children: ReactNode;
  /** Optional id passed through to the label's `htmlFor`. */
  htmlFor?: string;
  /** Extra className on the wrapping element. */
  className?: string;
}

/**
 * The elements a `<label>` can actually name, and therefore the only ones worth annotating.
 *
 * MEASURED, not chosen for tidiness: cloning onto any single element child broke
 * `QuickAddItemModal`, whose price field is an `<input>` inside a `<span class="priceBox">` holding
 * the currency suffix. The id and the ARIA landed on the SPAN, `htmlFor` pointed at a node that is
 * not labelable, and the label-to-input association was destroyed — six tests went red on a change
 * whose entire purpose was to improve accessibility. A custom component is excluded for the same
 * reason in reverse: this component cannot know whether it forwards `id` to a real control.
 */
const LABELABLE_CONTROLS = new Set(['input', 'select', 'textarea']);

/** The props this component may hand to its child. All optional — a child may already own them. */
type AriaProps = {
  id?: string;
  'aria-invalid'?: boolean | 'true';
  'aria-describedby'?: string;
};

/**
 * Merge an `aria-describedby` rather than assigning one.
 *
 * The bug this exists to prevent, measured on a sibling slice: writing `aria-describedby={errorId}`
 * over a child that already had one REPLACES it, so a field with both a hint and an error announces
 * only the error — and the loss is invisible, because the attribute is present and points at
 * something real. Order is the reading order: the child's own context first, then the failure.
 */
const mergeDescribedBy = (existing: unknown, added: string | undefined): string | undefined => {
  const parts = [typeof existing === 'string' ? existing : undefined, added].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(' ') : undefined;
};

/**
 * Standard label + input + error grouping (CLAUDE.md frontend §5 rule 3).
 *
 * Usage:
 * ```tsx
 * <FormField label={t('email')} error={errors.email?.message}>
 *   <input type="email" {...register('email')} />
 * </FormField>
 * ```
 *
 * ### What it guarantees, and why the structure looks like this
 *
 * The editor's own fields (`product/fields/fieldAria.ts`, #589) give every input four things
 * together: an `id`, a label that points at it, `aria-invalid` while it is failing, and an
 * `aria-describedby` aimed at the sentence that says why. This component used to deliver two of the
 * four — it wrapped a `<label>` around its children and rendered a `role="alert"` error, and never
 * touched the child input at all. So the message existed on screen with **no programmatic
 * relationship to the field it describes**, which is the defect `CheckboxField` had already fixed
 * one file away. Issue #598.
 *
 * Two structural points are load-bearing:
 *
 * **The error is rendered OUTSIDE the `<label>`.** HTML-AAM's label-content rule makes every text
 * node inside a label part of the accessible NAME, so while the error lived in there the input was
 * named *"Email Required field"* — measured with `toHaveAccessibleName`, not assumed, and pinned by
 * a test below. Moving it out is what lets `aria-describedby` carry it exactly once, as a
 * DESCRIPTION. (Marking it `aria-hidden` would not have worked: a node referenced by
 * `aria-describedby` is included in the description even when hidden, so the text would still be
 * announced twice — once as name, once as description.)
 *
 * **The child is cloned, not wrapped in more markup.** ARIA state belongs on the control itself;
 * putting it on a surrounding `div` describes the box, not the field.
 *
 * ### The honest limit: exactly one element child
 *
 * Cloning applies only when there is a single React element child. With two controls the component
 * cannot know which one is the field — and a `<label>` wrapping two controls names only the FIRST,
 * so that shape is already lossy before this component sees it (`QuickAddItemModal`'s price input
 * with a currency suffix is exactly that). In that case the label association and the `role="alert"`
 * error still render, and `aria-invalid`/`aria-describedby` are simply not applied. Give the field
 * its own `id`, pass `htmlFor`, and set the ARIA on the control yourself.
 */
export default function FormField({ label, error, srOnlyLabel, children, htmlFor, className }: FormFieldProps) {
  const uid = useId();
  const errorId = `${uid}-error`;

  const onlyChild = Children.count(children) === 1 && isValidElement(children) ? (children as ReactElement) : null;
  const labelledControl =
    onlyChild && typeof onlyChild.type === 'string' && LABELABLE_CONTROLS.has(onlyChild.type) ? onlyChild : null;
  const childProps = (labelledControl?.props ?? {}) as AriaProps;
  // The child's own id wins: a caller that supplied one is already pointing something at it.
  const controlId = childProps.id ?? htmlFor ?? `${uid}-control`;

  const describedBy = mergeDescribedBy(childProps['aria-describedby'], error ? errorId : undefined);
  const control = labelledControl
    ? cloneElement(labelledControl, {
        id: controlId,
        // Never an explicit `false`: some screen readers announce it as a state worth mentioning on
        // a field nobody has touched. Same rule as `fieldAria`.
        'aria-invalid': error ? true : childProps['aria-invalid'],
        'aria-describedby': describedBy,
      } as AriaProps)
    : children;

  const fieldClassName = className ? `${styles.field} ${className}` : styles.field;

  return (
    <div className={fieldClassName}>
      {/* The label holds the visible text and the control, and NOTHING else — see the accessible-name
          note above. `htmlFor` is set even though the control is nested, so the association survives
          a caller that renders the field through a portal or a fragment. */}
      <label className={styles.labelWrap} htmlFor={labelledControl ? controlId : htmlFor}>
        <span className={srOnlyLabel ? styles.srOnly : styles.label}>{label}</span>
        {control}
      </label>
      {error && (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
