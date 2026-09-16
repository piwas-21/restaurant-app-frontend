import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './StaffWorkspaceControls.module.css';

export interface StickyActionBarProps {
  primaryAction: ReactNode;
  total?: ReactNode;
  context?: ReactNode;
  secondaryAction?: ReactNode;
  ariaLabel?: string;
  className?: string;
}

export default function StickyActionBar({
  primaryAction,
  total,
  context,
  secondaryAction,
  ariaLabel,
  className,
}: Readonly<StickyActionBarProps>) {
  const { t } = useTranslation();
  return (
    <aside
      className={[styles.bar, className].filter(Boolean).join(' ')}
      aria-label={ariaLabel ?? t('server.actions', 'Actions')}
    >
      <div>
        {context}
        {total && <div className={styles.barTotal}>{total}</div>}
      </div>
      <div className={styles.barActions}>
        {secondaryAction}
        {primaryAction}
      </div>
    </aside>
  );
}
