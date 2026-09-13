import type { ButtonHTMLAttributes } from 'react';
import styles from './StaffButton.module.css';

export type StaffButtonVariant = 'primary' | 'secondary' | 'danger';

export interface StaffButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: StaffButtonVariant;
}

/** Shared touch-sized button for staff workspaces. Uses the app's existing button variants. */
export default function StaffButton({ variant = 'secondary', className, type = 'button', ...props }: StaffButtonProps) {
  const classes = ['btn', `btn-${variant}`, styles.touch, className].filter(Boolean).join(' ');
  return <button {...props} type={type} className={classes} />;
}
