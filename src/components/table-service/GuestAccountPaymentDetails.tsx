'use client';

import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { TableGuestAccountDto } from '@/types/tableGuestVisit';
import type { AccountPaymentState } from '@/types/accountPayments';
import type { GuestAccountPaymentOperation, GuestPaymentReceipt } from '@/types/guestAccountPayments';
import { formatAccountPaymentMinor } from '@/lib/accountPaymentMoney';
import styles from './GuestAccountPayment.module.css';

const PAYMENT_STATE_LABEL_KEYS: Readonly<Record<AccountPaymentState, string>> = {
  Quoted: 'table_guest_payment_Quoted',
  Reserved: 'table_guest_payment_Reserved',
  Starting: 'table_guest_payment_Starting',
  Processing: 'table_guest_payment_Processing',
  Captured: 'table_guest_payment_Captured',
  CancelRequested: 'table_guest_payment_CancelRequested',
  Released: 'table_guest_payment_Released',
  Failed: 'table_guest_payment_Failed',
  ReconciliationRequired: 'table_guest_payment_ReconciliationRequired',
};

export function PaymentOperationReview({
  operation,
  tableAccount,
  canContinue,
  isWorking,
  onContinue,
  onRelease,
}: Readonly<{
  operation: GuestAccountPaymentOperation;
  tableAccount: TableGuestAccountDto | null;
  canContinue: boolean;
  isWorking: boolean;
  onContinue: () => Promise<boolean>;
  onRelease: () => Promise<boolean>;
}>) {
  const { t, i18n } = useTranslation();
  return (
    <section className={styles.review} aria-labelledby="guest-payment-review-heading">
      <h3 id="guest-payment-review-heading">{t('table_guest_payment_review_title')}</h3>
      <StatusBadge tone={operation.state === 'Quoted' ? 'info' : 'warning'}>
        {t(PAYMENT_STATE_LABEL_KEYS[operation.state])}
      </StatusBadge>
      <dl>
        <dt>{t('table_guest_payment_review_amount')}</dt>
        <dd>{formatAccountPaymentMinor(operation.amountMinor, operation.currency, i18n.language)}</dd>
        <dt>{t('table_guest_payment_review_scope')}</dt>
        <dd>
          <AllocationReview operation={operation} tableAccount={tableAccount} />
        </dd>
      </dl>
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          disabled={!canContinue || isWorking}
          onClick={() => void onContinue()}
        >
          {t('table_guest_payment_continue')}
        </button>
        <button type="button" className={styles.button} disabled={isWorking} onClick={() => void onRelease()}>
          {t('table_guest_payment_release')}
        </button>
      </div>
    </section>
  );
}

export function PaymentStatus({
  state,
  amountMinor,
  currency,
  receivedMinor,
  refundedMinor,
  reconciliationRequired,
  isWorking,
  retryOriginal,
  showStatus,
  canCancel,
  onRetry,
  onRefresh,
  onCancel,
}: Readonly<{
  state: AccountPaymentState;
  amountMinor: number;
  currency: string;
  receivedMinor: number;
  refundedMinor: number;
  reconciliationRequired: boolean;
  isWorking: boolean;
  retryOriginal: boolean;
  showStatus: boolean;
  canCancel: boolean;
  onRetry: () => Promise<boolean>;
  onRefresh: () => Promise<boolean>;
  onCancel: () => Promise<boolean>;
}>) {
  const { t, i18n } = useTranslation();
  const displayState = reconciliationRequired ? 'ReconciliationRequired' : state;
  return (
    <div className={styles.statusBlock}>
      <StatusBadge tone={statusTone(displayState, reconciliationRequired)}>
        {t(PAYMENT_STATE_LABEL_KEYS[displayState])}
      </StatusBadge>
      <dl>
        <dt>{t('table_guest_payment_review_amount')}</dt>
        <dd>{formatAccountPaymentMinor(amountMinor, currency, i18n.language)}</dd>
        {receivedMinor > 0 && (
          <>
            <dt>{t('table_guest_payment_received')}</dt>
            <dd>{formatAccountPaymentMinor(receivedMinor, currency, i18n.language)}</dd>
          </>
        )}
        {refundedMinor > 0 && (
          <>
            <dt>{t('table_guest_payment_refunded')}</dt>
            <dd>{formatAccountPaymentMinor(refundedMinor, currency, i18n.language)}</dd>
          </>
        )}
      </dl>
      {reconciliationRequired && <p className={styles.notice}>{t('table_guest_payment_reconciliation')}</p>}
      <div className={styles.actions}>
        {retryOriginal ? (
          <button type="button" className={styles.button} disabled={isWorking} onClick={() => void onRetry()}>
            {t('table_guest_payment_retry_original')}
          </button>
        ) : (
          showStatus && (
            <button type="button" className={styles.button} disabled={isWorking} onClick={() => void onRefresh()}>
              {t('table_guest_payment_status')}
            </button>
          )
        )}
        {canCancel && !reconciliationRequired && (
          <button type="button" className={styles.button} disabled={isWorking} onClick={() => void onCancel()}>
            {t('table_guest_payment_cancel')}
          </button>
        )}
      </div>
    </div>
  );
}

export function PaymentReceipt({ receipt, locale }: Readonly<{ receipt: GuestPaymentReceipt; locale: string }>) {
  const { t } = useTranslation();
  const displayState = receipt.reconciliationRequired ? 'ReconciliationRequired' : receipt.state;
  return (
    <section className={styles.receipt} aria-label={t('table_guest_payment_receipt')}>
      <h3>{t('table_guest_payment_receipt')}</h3>
      <StatusBadge tone={statusTone(displayState, receipt.reconciliationRequired)}>
        {t(PAYMENT_STATE_LABEL_KEYS[displayState])}
      </StatusBadge>
      <dl>
        <dt>{t('table_guest_payment_received')}</dt>
        <dd>{formatAccountPaymentMinor(receipt.receivedMinor, receipt.currency, locale)}</dd>
        {receipt.refundedMinor > 0 && (
          <>
            <dt>{t('table_guest_payment_refunded')}</dt>
            <dd>{formatAccountPaymentMinor(receipt.refundedMinor, receipt.currency, locale)}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

export function PaymentHoldNotice({
  state,
  reconciliationRequired,
}: Readonly<{ state: AccountPaymentState | null; reconciliationRequired: boolean }>) {
  const { t } = useTranslation();
  if (reconciliationRequired || state === 'ReconciliationRequired') {
    return (
      <output className={styles.notice} aria-live="polite">
        {t('table_guest_payment_reconciliation')}
      </output>
    );
  }
  if (state === 'Captured' || state === 'Released' || state === 'Failed') return null;
  return (
    <output className={styles.notice} aria-live="polite">
      {t('table_guest_payment_pending')}
    </output>
  );
}

function AllocationReview({
  operation,
  tableAccount,
}: Readonly<{ operation: GuestAccountPaymentOperation; tableAccount: TableGuestAccountDto | null }>) {
  const { t } = useTranslation();
  if (operation.allocations.length === 0) return <span>{t('table_guest_payment_account_balance')}</span>;
  return (
    <ul className={styles.scopeList}>
      {operation.allocations.map((allocation, index) => {
        const line = allocation.orderItemId
          ? tableAccount?.items.find(
              (entry) => entry.orderId === allocation.orderId && entry.item.itemId === allocation.orderItemId,
            )
          : null;
        const orderNumber =
          tableAccount?.orders.find((entry) => entry.orderId === allocation.orderId)?.orderNumber ??
          t('table_guest_payment_unknown_order');
        const item = line?.item.productName ?? t('table_guest_payment_order_item', { orderNumber });
        const description = allocation.orderItemId
          ? t('table_guest_payment_review_item', { item, orderNumber, count: allocation.unitCount })
          : t('table_guest_payment_account_balance');
        return (
          <li key={`${allocation.orderId}:${allocation.orderItemId ?? 'account'}:${allocation.startOrdinal}:${index}`}>
            {description}
          </li>
        );
      })}
    </ul>
  );
}

function statusTone(state: AccountPaymentState, reconciliationRequired: boolean) {
  if (reconciliationRequired || state === 'ReconciliationRequired') return 'warning';
  if (state === 'Captured') return 'success';
  if (state === 'Failed') return 'danger';
  if (state === 'Quoted' || state === 'Starting' || state === 'Processing') return 'info';
  if (state === 'Reserved' || state === 'CancelRequested') return 'warning';
  return 'neutral';
}
