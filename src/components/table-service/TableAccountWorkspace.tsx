'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TableServiceSessionDto } from '@/types/order';
import { formatTableMoney, tableSessionEligibleOutstanding } from '@/lib/cashierTableSession';
import TableAccountActivityPanel from './TableAccountActivityPanel';
import TableAccountItemsPanel from './TableAccountItemsPanel';
import TableAccountPaymentsPanel from './TableAccountPaymentsPanel';
import styles from './TableAccountWorkspace.module.css';

type AccountTab = 'items' | 'payments' | 'activity';

interface TableAccountWorkspaceProps {
  readonly session: TableServiceSessionDto;
  readonly timeZone?: string;
}

const TABS: readonly AccountTab[] = ['items', 'payments', 'activity'];

export default function TableAccountWorkspace({ session, timeZone }: TableAccountWorkspaceProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<AccountTab>('items');
  const money = (amount: number | null | undefined) =>
    formatTableMoney(amount, session) ?? t('cashier.tables.currency_unknown');
  const tabLabels: Record<AccountTab, string> = {
    items: t('cashier.tables.account_items'),
    payments: t('cashier.tables.account_payments'),
    activity: t('cashier.tables.account_activity'),
  };
  const nextTabForKey = (current: AccountTab, key: string): AccountTab | null => {
    const index = TABS.indexOf(current);
    const rtl = i18n.dir?.() === 'rtl';
    let nextIndex = index;
    if (key === 'Home') nextIndex = 0;
    else if (key === 'End') nextIndex = TABS.length - 1;
    else if (key === 'ArrowRight') nextIndex = (index + (rtl ? TABS.length - 1 : 1)) % TABS.length;
    else if (key === 'ArrowLeft') nextIndex = (index + (rtl ? 1 : TABS.length - 1)) % TABS.length;
    else return null;
    return TABS[nextIndex];
  };

  return (
    <section className={styles.account} aria-labelledby="table-account-title">
      <h3 id="table-account-title" className={styles.title}>
        {t('cashier.tables.account')}
      </h3>
      <dl className={styles.balance} aria-label={t('cashier.tables.account_balance')}>
        <div className={styles.balancePrimary}>
          <dt>{t('cashier.tables.outstanding')}</dt>
          <dd>{money(tableSessionEligibleOutstanding(session))}</dd>
        </div>
        <div>
          <dt>{t('cashier.tables.total')}</dt>
          <dd>{money(session.bill.total)}</dd>
        </div>
        <div>
          <dt>{t('cashier.tables.paid')}</dt>
          <dd>{money(session.bill.totalPaid)}</dd>
        </div>
        {(session.bill.credit ?? 0) > 0 && (
          <div>
            <dt>{t('cashier.tables.round_credit')}</dt>
            <dd>{money(session.bill.credit)}</dd>
          </div>
        )}
      </dl>
      <div className={styles.tabs} role="tablist" aria-label={t('cashier.tables.account')}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            id={`table-account-tab-${tab}`}
            className={styles.tab}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls="table-account-panel"
            data-table-account-tab={tab}
            tabIndex={activeTab === tab ? 0 : -1}
            onKeyDown={(event) => {
              const nextTab = nextTabForKey(tab, event.key);
              if (!nextTab) return;
              event.preventDefault();
              setActiveTab(nextTab);
              event.currentTarget.parentElement
                ?.querySelector<HTMLButtonElement>(`[data-table-account-tab="${nextTab}"]`)
                ?.focus();
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>
      <div
        className={styles.panel}
        id="table-account-panel"
        role="tabpanel"
        aria-labelledby={`table-account-tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTab === 'items' && <TableAccountItemsPanel session={session} />}
        {activeTab === 'payments' && <TableAccountPaymentsPanel session={session} />}
        {activeTab === 'activity' && <TableAccountActivityPanel session={session} timeZone={timeZone} />}
      </div>
    </section>
  );
}
