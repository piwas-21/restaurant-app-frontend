'use client';

import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import { formatTableMoney, tableSessionEligibleOutstanding } from '@/lib/cashierTableSession';
import type { TableServiceSessionDto } from '@/types/order';
import styles from './CashierReleasedTableVisits.module.css';

interface Props {
  readonly sessions: readonly TableServiceSessionDto[];
  readonly disabled: boolean;
  readonly onSelect: (serviceSessionId: string) => void;
}

export default function CashierReleasedTableVisits({ sessions, disabled, onSelect }: Props) {
  const { t } = useTranslation();
  if (sessions.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="released-table-visits-title">
      <h2 id="released-table-visits-title">{t('cashier.tables.released_visits')}</h2>
      <p>{t('cashier.tables.released_visits_detail')}</p>
      <ul className={styles.list}>
        {sessions.map((session) => {
          const table = session.tableLabel || session.tableNumber?.toString() || t('cashier.tables.table');
          const due =
            formatTableMoney(tableSessionEligibleOutstanding(session), session) ?? t('cashier.tables.currency_unknown');
          return (
            <li key={session.serviceSessionId}>
              <StaffButton disabled={disabled} onClick={() => onSelect(session.serviceSessionId)}>
                <span>{table}</span>
                <span>{t('cashier.tables.released_due', { amount: due })}</span>
              </StaffButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
