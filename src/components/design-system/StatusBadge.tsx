import type { ReactNode } from 'react';
import styles from './StatusBadge.module.css';

export type StatusBadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';
export type StatusBadgeSize = 'sm' | 'md' | 'lg';

export interface StatusBadgeProps {
  readonly tone?: StatusBadgeTone;
  readonly size?: StatusBadgeSize;
  readonly children: ReactNode;
  readonly className?: string;
  /** Optional explicit accessible name when the visible content is abbreviated. */
  readonly ariaLabel?: string;
}

/**
 * Standard status pill (CLAUDE.md frontend §5 rule 4). Tone maps to a
 * design-token background + foreground pair.
 *
 * Usage: `<StatusBadge tone="success">WhatsApp</StatusBadge>`.
 */
export default function StatusBadge({
  tone = 'neutral',
  size = 'md',
  children,
  className,
  ariaLabel,
}: Readonly<StatusBadgeProps>) {
  const badgeClassName = [styles.badge, styles[tone], styles[size], className].filter(Boolean).join(' ');
  if (ariaLabel) {
    return (
      <output className={badgeClassName} aria-label={ariaLabel}>
        {children}
      </output>
    );
  }
  return <span className={badgeClassName}>{children}</span>;
}
