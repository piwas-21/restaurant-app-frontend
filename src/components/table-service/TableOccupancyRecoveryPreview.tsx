'use client';

import type { TFunction } from 'i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import StaffButton from '@/components/design-system/StaffButton';
import { recoveryErrorTranslationKey } from '@/lib/tableOccupancyRecoveryLabels';
import type { RecoveryError } from '@/hooks/tableReadiness/useTableOccupancyRecovery.types';
import type { TableOccupancyRecoveryPreview as Preview } from '@/types/tableOccupancyRecovery';
import TableOccupancyRecoveryOrders from './TableOccupancyRecoveryOrders';
import styles from './TableReadinessAction.module.css';

interface Props {
  readonly preview: Preview;
  readonly isOpen: boolean;
  readonly isWorking: boolean;
  readonly canWrite: boolean;
  readonly reason: string;
  readonly error?: RecoveryError;
  readonly locale: string;
  readonly onReasonChange: (reason: string) => void;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly t: TFunction;
}

function money(value: number, currency: string | null, locale: string): string {
  if (!currency) return String(value);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  } catch (_error: unknown) {
    return `${value} ${currency}`;
  }
}

export default function TableOccupancyRecoveryPreview({
  preview,
  isOpen,
  isWorking,
  canWrite,
  reason,
  error,
  locale,
  onReasonChange,
  onClose,
  onConfirm,
  t,
}: Props) {
  const counts = [
    ['accountPayments.recovery.count.orders', preview.orderCount],
    ['accountPayments.recovery.count.cancelable', preview.cancelableUnsentCount],
    ['accountPayments.recovery.count.legacy', preview.legacyUnassignedCount],
    ['accountPayments.recovery.count.routed', preview.routedOrderCount],
    ['accountPayments.recovery.count.preparing', preview.preparingOrderCount],
    ['accountPayments.recovery.count.ready', preview.readyOrderCount],
    ['accountPayments.recovery.count.paid', preview.paidOrRefundedOrderCount],
    ['accountPayments.recovery.count.attempts', preview.activePaymentAttemptCount],
    ['accountPayments.recovery.count.handoffs', preview.pendingPaymentHandoffCount],
    ['accountPayments.recovery.count.checkout', preview.checkoutAttemptCount],
  ] as const;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('accountPayments.recovery.preview_title', { table: preview.tableNumber })}
      size="lg"
      isPending={isWorking}
      disableBackdropClose
    >
      <div className={styles.recoveryBody}>
        <p className={styles.recoveryWarning}>{t('accountPayments.recovery.warning')}</p>
        <dl className={styles.recoveryCounts}>
          {counts.map(([key, count]) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
        <p>
          {t('accountPayments.recovery.outstanding', {
            amount: money(preview.preservedOutstandingAmount, preview.currency, locale),
          })}
        </p>
        <TableOccupancyRecoveryOrders
          orders={preview.orders}
          currency={preview.currency}
          locale={locale}
          t={t}
          money={money}
        />
        <FormField label={t('accountPayments.recovery.reason')}>
          <textarea
            value={reason}
            maxLength={500}
            onChange={(event) => onReasonChange(event.target.value)}
            aria-invalid={error === 'reason_required' || error === 'version_missing'}
          />
        </FormField>
        {error && <p role="alert">{t(recoveryErrorTranslationKey(error, 'preview_failed'))}</p>}
      </div>
      <div className={styles.actions}>
        <StaffButton onClick={onClose} disabled={isWorking}>
          {t('accountPayments.recovery.cancel')}
        </StaffButton>
        <StaffButton variant="danger" onClick={onConfirm} disabled={!canWrite || isWorking}>
          {t('accountPayments.recovery.confirm')}
        </StaffButton>
      </div>
    </BaseModal>
  );
}
