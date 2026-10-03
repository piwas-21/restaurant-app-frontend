'use client';

import { useTranslation } from 'react-i18next';
import styles from './TableGuestAccount.module.css';

interface TableGuestSafeDepartureProps {
  readonly confirmed: boolean;
  readonly onConfirmedChange: (confirmed: boolean) => void;
  readonly onLeave: () => void;
  readonly pending: boolean;
}

export default function TableGuestSafeDeparture({
  confirmed,
  onConfirmedChange,
  onLeave,
  pending,
}: TableGuestSafeDepartureProps) {
  const { t } = useTranslation();
  return (
    <section className={styles.actions} aria-label={t('table_guest_safe_departure')}>
      <label className={styles.confirmation}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => onConfirmedChange(event.currentTarget.checked)}
        />
        <span>{t('table_guest_left_table_confirmation')}</span>
      </label>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonPrimary}`}
        onClick={onLeave}
        disabled={!confirmed || pending}
      >
        {t(pending ? 'table_guest_resolve_round_first' : 'table_guest_leave_action')}
      </button>
    </section>
  );
}
