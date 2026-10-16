import type { ReactNode } from 'react';
import Link from '@/components/TenantLink';
import StatusBadge, { type StatusBadgeTone } from '@/components/design-system/StatusBadge';
import styles from './StaffTableCard.module.css';

interface Props {
  readonly label: string;
  readonly status: string;
  readonly tone: StatusBadgeTone;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly actionLabel: string;
  readonly accessibleLabel?: string;
  readonly href?: string;
  readonly onSelect?: () => void;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
}

/** Shared touch target and visual hierarchy; each role supplies its authoritative state/actions. */
export default function StaffTableCard({
  label,
  status,
  tone,
  selected = false,
  disabled = false,
  actionLabel,
  accessibleLabel,
  href,
  onSelect,
  children,
  actions,
}: Props) {
  const content = (
    <>
      <span className={styles.header}>
        <strong className={styles.label} dir="auto">
          {label}
        </strong>
        <StatusBadge tone={tone}>{status}</StatusBadge>
      </span>
      <span className={styles.metrics}>{children}</span>
      <span className={styles.action}>{actionLabel}</span>
    </>
  );
  return (
    <article className={styles.card} data-selected={selected}>
      {href && !disabled ? (
        <Link className={styles.target} href={href} aria-label={accessibleLabel} onClick={onSelect}>
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className={styles.target}
          aria-label={accessibleLabel}
          aria-pressed={selected}
          disabled={disabled}
          onClick={onSelect}
        >
          {content}
        </button>
      )}
      {actions && <div className={styles.actions}>{actions}</div>}
    </article>
  );
}
