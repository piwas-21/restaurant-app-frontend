'use client';

import { useTranslation } from 'react-i18next';
import styles from './StaffWorkspaceControls.module.css';

export interface DraftRecoveryBannerProps {
  scopeLabel: string;
  onResume: () => void;
  onDiscard: () => void;
  isBusy?: boolean;
  className?: string;
}

export default function DraftRecoveryBanner({
  scopeLabel,
  onResume,
  onDiscard,
  isBusy = false,
  className,
}: Readonly<DraftRecoveryBannerProps>) {
  const { t } = useTranslation();

  return (
    <section
      className={[styles.draft, className].filter(Boolean).join(' ')}
      aria-label={t('staff.draft_recovery', 'Draft recovery')}
      aria-live="polite"
    >
      <span dir="auto">{scopeLabel}</span>
      <div className={styles.noticeActions}>
        <button type="button" className={styles.actionButton} onClick={onDiscard} disabled={isBusy}>
          {t('staff.discard_draft', 'Discard draft')}
        </button>
        <button
          type="button"
          className={`${styles.actionButton} ${styles.primary}`}
          onClick={onResume}
          disabled={isBusy}
        >
          {t('staff.resume_draft', 'Resume draft')}
        </button>
      </div>
    </section>
  );
}
