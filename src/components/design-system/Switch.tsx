'use client';

import React, { forwardRef, useId } from 'react';
import styles from './Switch.module.css';

export interface SwitchProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'role' | 'children' | 'size'
> {
  /** Visible label. A switch without one is never right here — every caller labels a named flag. */
  readonly label: string;
  /** Extra line under the label, e.g. what the flag actually does. */
  readonly description?: string;
  /** Host stylesheet, for a surface that needs a different skin. See {@link SwitchProps.styles}. */
  readonly className?: string;
}

/**
 * The design system's switch — an on/off flag that takes effect on its own, as opposed to a
 * checkbox, which selects a value the surrounding form will later submit.
 *
 * It exists because three approved screens draw one (`admin_menu_item_editor_margherita_pizza`,
 * `responsive_reflow_admin_editor_1024px_820px`, and the dark-mode reference sheet's own
 * *"Switches: On, Off"* row) and `design-system/` held no such component, so the item's `Active` /
 * `Available today` / `Special of the day` flags shipped as checkbox chips (conformance review G6,
 * frontend #575).
 *
 * ### Why it is a native checkbox underneath
 *
 * `role="switch"` is defined by ARIA as *"a checkbox with on/off rather than checked/unchecked"* and
 * inherits every one of the checkbox's states and its keyboard contract. Painting a `<div>` instead
 * would mean re-implementing Space, the disabled semantics, form participation and the label
 * association — four chances to get it wrong — and it would not work with `react-hook-form`'s
 * `register()`, which needs a real form control with a `ref`, a `name` and a `checked` value. So the
 * input is a real `<input type="checkbox">` carrying `role="switch"`; the track and knob are
 * decoration painted next to it and hidden from the accessibility tree.
 *
 * The input is NOT `display: none` and NOT zero-sized: it is laid over the track at full size with
 * `opacity: 0`, so it is focusable, hit-testable and at least 24x24 CSS px on its own (WCAG 2.2
 * 2.5.8), rather than borrowing the label's hit area the way the chip it replaces did.
 *
 * ### Forwarded ref
 *
 * `register('isActive')` returns `{ name, onChange, onBlur, ref }` and spreads onto this component,
 * so the ref has to reach the input or react-hook-form never sees the field. That is the whole
 * reason for `forwardRef` here.
 */
const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, description, className, id, disabled, ...inputProps },
  ref,
) {
  const uid = useId();
  const inputId = id ?? `${uid}-switch`;
  const descriptionId = `${uid}-description`;
  // Joined, not a nested template literal: S4624 flags `${cond ? ` ${x}` : ''}` twice over.
  const fieldClass = [styles.field, disabled ? styles.disabled : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={fieldClass}>
      {/* The <label> holds the visible label text and NOTHING else. HTML-AAM's label-content rule
          makes every text node inside it part of the accessible NAME, so a `description` rendered in
          there turns the name from "Special of the day" into "Special of the day Shown first on the
          guest menu" — announced once as the name and again as the description. Measured here, not
          assumed: the first draft of this file did nest it, and `Switch.test.tsx` caught it. Same
          trap, same boundary as `CheckboxField`. */}
      <span className={styles.labelBlock}>
        <label htmlFor={inputId} className={styles.text}>
          {label}
        </label>
        {description && (
          <span id={descriptionId} className={styles.description}>
            {description}
          </span>
        )}
      </span>
      {/* The control is a POSITIONING box, not a second label: the input covers it entirely, so the
          switch has its own >=24x24 target and the track is never the thing that receives a click. */}
      <span className={styles.control}>
        <input
          {...inputProps}
          ref={ref}
          id={inputId}
          type="checkbox"
          role="switch"
          disabled={disabled}
          aria-describedby={description ? descriptionId : inputProps['aria-describedby']}
          className={styles.input}
        />
        <span aria-hidden="true" className={styles.track}>
          <span className={styles.knob} />
        </span>
      </span>
    </div>
  );
});

export default Switch;
