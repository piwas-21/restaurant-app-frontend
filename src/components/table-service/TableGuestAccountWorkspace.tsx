'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/TenantLink';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useTableContext } from '@/contexts/TableContext';
import { useTableGuestVisit } from '@/contexts/TableGuestVisitContext';
import { useTableGuestFeature } from '@/contexts/TableGuestFeatureContext';
import { tenantLocaleFromPathname } from '@/lib/tenantLocaleRouting';
import { formatCurrency } from '@/utils/currency';
import TableGuestAccountBatch from './TableGuestAccountBatch';
import TableGuestSafeDeparture from './TableGuestSafeDeparture';
import TableGuestVisitMessage from './TableGuestVisitMessage';
import styles from './TableGuestAccount.module.css';
import { reportTableGuestFailure } from '@/lib/tableGuestFailureDiagnostics';

export default function TableGuestAccountWorkspace() {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { clearOrderType } = useOrderType();
  const { clearTableContext } = useTableContext();
  const { retryTableGuestFeature } = useTableGuestFeature();
  const {
    phase,
    visit,
    featureEnabled,
    featureStatus,
    pendingRound,
    pendingRoundStatus,
    requiresSafeDeparture,
    lastRoundAcknowledgement,
    getAccount,
    leaveAfterSafeDeparture,
  } = useTableGuestVisit();
  const [account, setAccount] = useState<Awaited<ReturnType<typeof getAccount>> | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [confirmedDeparture, setConfirmedDeparture] = useState(false);
  const pendingRoundUnresolved = pendingRound !== null || pendingRoundStatus === 'unknown';
  const locale = tenantLocaleFromPathname(pathname);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError('');
    try {
      setAccount(await getAccount());
    } catch (accountError) {
      reportTableGuestFailure('read account', accountError);
      setError(t('table_guest_account_load_failed'));
    } finally {
      setIsRefreshing(false);
    }
  }, [getAccount, t]);

  useEffect(() => {
    if (phase !== 'active') return;
    void refresh();
  }, [phase, visit?.serviceSessionId, refresh]);

  const handleSafeDeparture = () => {
    if (!confirmedDeparture || pendingRoundUnresolved || !leaveAfterSafeDeparture()) return;
    clearOrderType();
    try {
      clearTableContext();
    } catch (storageError) {
      reportTableGuestFailure('clear table context', storageError);
      // The visit credential was already cleared; an unavailable table-context store cannot keep it active.
    }
    router.replace(locale ? `/${locale}/menu` : '/menu');
  };

  if (phase === 'loading')
    return (
      <main className={styles.workspace} aria-live="polite">
        {t('loading')}
      </main>
    );
  if (phase === 'storageUnavailable') {
    return (
      <TableGuestVisitMessage
        title={t('table_guest_unavailable_title')}
        detail={t('table_guest_storage_help')}
        confirmedDeparture={confirmedDeparture}
        onConfirmDeparture={setConfirmedDeparture}
        onLeave={handleSafeDeparture}
        pending={pendingRoundUnresolved}
      />
    );
  }
  if (requiresSafeDeparture) {
    return (
      <TableGuestVisitMessage
        title={t('table_guest_ended_title')}
        detail={t('table_guest_ended_detail')}
        confirmedDeparture={confirmedDeparture}
        onConfirmDeparture={setConfirmedDeparture}
        onLeave={handleSafeDeparture}
        pending={pendingRoundUnresolved}
      />
    );
  }
  if (phase === 'unavailable') {
    return (
      <TableGuestVisitMessage
        title={t('table_guest_unavailable_title', t('unavailable', 'Unavailable'))}
        detail={t('table_guest_unavailable_detail', t('unavailable', 'Unavailable'))}
        onRetry={retryTableGuestFeature}
        confirmedDeparture={confirmedDeparture}
        onConfirmDeparture={setConfirmedDeparture}
        onLeave={handleSafeDeparture}
        pending={pendingRoundUnresolved}
      />
    );
  }
  if (phase !== 'active' || !featureEnabled) {
    let detail = t('table_guest_not_joined_detail');
    if (featureStatus === 'unavailable') {
      detail = t('table_guest_unavailable_detail', t('unavailable', 'Unavailable'));
    }
    return (
      <TableGuestVisitMessage
        title={t('table_guest_unavailable_title', t('unavailable', 'Unavailable'))}
        detail={detail}
      />
    );
  }

  const formatPrice = (amount: number) => formatCurrency(amount, i18n.language, account?.currency || undefined);

  return (
    <main className={styles.workspace} aria-labelledby="table-account-heading">
      <header className={styles.header}>
        <div>
          <h1 id="table-account-heading" className={styles.title}>
            {t('table_guest_account_title')}
          </h1>
          <p className={styles.muted}>
            {t('table_guest_shared_account', { table: account?.tableLabel || t('table_guest_table') })}
          </p>
        </div>
        <button type="button" className={styles.button} onClick={() => void refresh()} disabled={isRefreshing}>
          {isRefreshing ? t('loading') : t('table_guest_refresh')}
        </button>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {lastRoundAcknowledgement && (
        <p className={styles.notice}>
          <output>{t('table_guest_round_added')}</output>
        </p>
      )}
      {pendingRound && (
        <p className={styles.notice}>
          <output>
            {t('table_guest_pending_round_notice')}{' '}
            <Link href="/checkout/review">{t('table_guest_resolve_round_link')}</Link>
          </output>
        </p>
      )}
      {pendingRoundStatus === 'unknown' && (
        <p className={styles.error} role="alert">
          {t('table_guest_storage_help')}
        </p>
      )}

      {account && (
        <>
          <dl className={styles.summary} aria-label={t('table_guest_account_summary')}>
            <SummaryValue label={t('subtotal')} value={formatPrice(account.subTotal)} />
            <SummaryValue label={t('discount')} value={formatPrice(account.discount)} />
            <SummaryValue label={t('tax')} value={formatPrice(account.tax)} />
            <SummaryValue label={t('tip')} value={formatPrice(account.tip)} />
            <SummaryValue label={t('total')} value={formatPrice(account.total)} />
            <SummaryValue label={t('table_guest_paid')} value={formatPrice(account.totalPaid)} />
            <SummaryValue label={t('table_guest_remaining')} value={formatPrice(account.remaining)} />
            {account.credit > 0 && <SummaryValue label={t('table_guest_credit')} value={formatPrice(account.credit)} />}
          </dl>

          <section aria-labelledby="table-guest-batches-heading">
            <h2 id="table-guest-batches-heading">{t('table_guest_kitchen_batches')}</h2>
            {account.orders.length > 0 ? (
              <div className={styles.batchList}>
                {account.orders.map((order) => (
                  <TableGuestAccountBatch
                    key={order.orderId}
                    order={order}
                    account={account}
                    formatPrice={formatPrice}
                  />
                ))}
              </div>
            ) : (
              <p className={styles.muted}>{t('table_guest_no_rounds')}</p>
            )}
          </section>
          <p className={styles.muted}>{t('table_guest_staff_settlement')}</p>
        </>
      )}

      <TableGuestSafeDeparture
        confirmed={confirmedDeparture}
        onConfirmedChange={setConfirmedDeparture}
        onLeave={handleSafeDeparture}
        pending={pendingRoundUnresolved}
      />
    </main>
  );
}

function SummaryValue({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className={styles.summaryValue}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
