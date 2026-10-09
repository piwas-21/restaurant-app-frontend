'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TableServiceSessionDto } from '@/types/order';
import {
  formatTableMoney,
  tablePaymentFlowTranslationKey,
  tableSessionEligibleOutstanding,
} from '@/lib/cashierTableSession';
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
  const flowLabel = session.bill.paymentFlowMode
    ? t(tablePaymentFlowTranslationKey(session.bill.paymentFlowMode))
    : null;
  const nextTabForKey = (current: AccountTab, key: string): AccountTab | null => {
    const index = TABS.indexOf(current);
    const rtl = i18n.dir?.() === 'rtl';
    if (key === 'Home') return TABS[0];
    if (key === 'End') return TABS.at(-1) ?? 'activity';
    if (key !== 'ArrowRight' && key !== 'ArrowLeft') return null;

    let direction: number;
    if (key === 'ArrowRight') direction = rtl ? -1 : 1;
    else direction = rtl ? 1 : -1;
    return TABS[(index + direction + TABS.length) % TABS.length];
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
        {flowLabel && (
          <div>
            <dt>{t('cashier.tables.payment_flow')}</dt>
            <dd>
              {flowLabel}
              {session.bill.guestCount
                ? ` · ${t('cashier.tables.split_guest_count', { count: session.bill.guestCount })}`
                : ''}
            </dd>
          </div>
        )}
        {(session.bill.guestAmounts ?? []).map((guest) => (
          <div key={guest.guestNumber}>
            <dt>{t('cashier.tables.split_guest_amount', { number: guest.guestNumber })}</dt>
            <dd>
              {t(`cashier.tables.split_status_${guest.status.toLowerCase()}`)} · {money(guest.amount)}
            </dd>
          </div>
        ))}
        {(session.bill.paymentTip ?? 0) > 0 && (
          <div>
            <dt>{t('cashier.tables.payment_tip_received')}</dt>
            <dd>{money(session.bill.paymentTip)}</dd>
          </div>
        )}
      </dl>
      {(session.bill.paymentTip ?? 0) > 0 && (
        <p className={styles.note}>{t('cashier.tables.tip_food_refund_notice')}</p>
      )}
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
