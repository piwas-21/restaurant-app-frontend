'use client';

import { useId, type ButtonHTMLAttributes } from 'react';
import styles from './StaffButton.module.css';

export type StaffButtonVariant = 'primary' | 'secondary' | 'danger';

export interface StaffButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: StaffButtonVariant;
  readonly disabledReason?: string;
}

/** Shared touch-sized button for staff workspaces. Uses the app's existing button variants. */
export default function StaffButton({
  variant = 'secondary',
  className,
  type = 'button',
  disabled,
  disabledReason,
  ...props
}: StaffButtonProps) {
  const reasonId = useId();
  const classes = ['btn', `btn-${variant}`, styles.touch, className].filter(Boolean).join(' ');
  const describedBy =
    [props['aria-describedby'], disabledReason ? reasonId : undefined].filter(Boolean).join(' ') || undefined;
  const button = (
    <button
      {...props}
      type={type}
      className={classes}
      disabled={disabled || Boolean(disabledReason)}
      aria-describedby={describedBy}
    />
  );
  if (!disabledReason) return button;
  return (
    <span className={styles.disabledExplanation} title={disabledReason}>
      {button}
      <span id={reasonId} className={styles.reason}>
        {disabledReason}
      </span>
    </span>
  );
}
