'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import { useAccountPaymentAccount } from '@/hooks/useAccountPaymentAccount';
import { useAccountPaymentOperation } from '@/hooks/useAccountPaymentOperation';
import { formatAccountPaymentMinor } from '@/lib/accountPaymentMoney';
import { canReleaseAccountPaymentRecovery } from '@/lib/accountPaymentRecovery';
import type { TableServiceSessionDto } from '@/types/order';
import AccountPaymentActivitySummary from './AccountPaymentActivitySummary';
import AccountPaymentSelectionForm from './AccountPaymentSelectionForm';
import AccountPaymentReview from './AccountPaymentReview';
import styles from './AccountPaymentCollection.module.css';

interface Props {
  readonly actorId: string | undefined;
  readonly session: TableServiceSessionDto;
  readonly enabled: boolean;
  readonly disabled: boolean;
  readonly recoveryEnabled: boolean;
  readonly onUpdated: () => void;
}

export default function AccountPaymentCollection({
  actorId,
  session,
  enabled,
  disabled,
  recoveryEnabled,
  onUpdated,
}: Props) {
  const { t, i18n } = useTranslation();
  const reader = useAccountPaymentAccount(session.serviceSessionId, enabled);
  const refreshAccount = reader.refresh;
  const refresh = useCallback(async () => {
    await refreshAccount();
    onUpdated();
  }, [refreshAccount, onUpdated]);
  const payment = useAccountPaymentOperation(actorId, session.serviceSessionId, enabled, refresh);
  const account = reader.account;
  const writesLocked =
    disabled || reader.stale || reader.loading || payment.busy || !enabled || account?.status !== 'Open';
  const pendingPayment = payment.pending?.kind === 'payment' ? payment.pending : null;
  const safeReleaseEnabled = canReleaseAccountPaymentRecovery(
    actorId,
    session.serviceSessionId,
    payment.pending,
    payment.operation,
    recoveryEnabled,
    payment.busy,
    payment.storageUnavailable,
  );
  const canRetryPreview =
    payment.pending !== null &&
    !payment.operation &&
    (payment.pending.kind === 'plan' || pendingPayment?.stage === 'quote');
  const canDiscardPreview = pendingPayment?.stage === 'quote' && !payment.operation;
  const money = (minor: number) =>
    formatAccountPaymentMinor(minor, account?.currency ?? '', i18n.language || 'en') ??
    t('cashier.tables.currency_unknown');

  return (
    <section className={styles.collection} aria-label={t('accountPayments.contribution')}>
      <h3>{t('accountPayments.contribution')}</h3>
      {!enabled && <p className={styles.warning}>{t('accountPayments.disabled_recovery')}</p>}
      {reader.loading && <output aria-live="polite">{t('accountPayments.loading')}</output>}
      {reader.error && (
        <p role="alert" className={styles.error}>
          {reader.error}
        </p>
      )}
      {payment.error && (
        <p role="alert" className={styles.error}>
          {payment.error}
        </p>
      )}
      {account && (
        <dl className={styles.summary}>
          <div>
            <dt>{t('accountPayments.outstanding')}</dt>
            <dd>{money(account.outstandingMinor)}</dd>
          </div>
          <div>
            <dt>{t('accountPayments.reserved')}</dt>
            <dd>{money(account.reservedMinor)}</dd>
          </div>
          <div>
            <dt>{t('accountPayments.available')}</dt>
            <dd>{money(account.availableMinor)}</dd>
          </div>
        </dl>
      )}
      {account && (
        <AccountPaymentActivitySummary
          capturedMinor={account.capturedAccountPaymentMinor}
          attempts={account.activeAttempts}
          currency={account.currency}
        />
      )}
      {account && account.reservedMinor > 0 && (
        <p className={styles.note}>{t('accountPayments.other_contributions')}</p>
      )}
      {enabled && (
        <StaffButton onClick={() => void reader.refresh()} disabled={reader.loading}>
          {t('cashier.workspace.refresh')}
        </StaffButton>
      )}
      {payment.pending && !payment.operation && (
        <div className={styles.review}>
          <p className={styles.warning}>{t('accountPayments.result_unknown')}</p>
          <StaffButton onClick={() => void payment.check()} disabled={payment.busy}>
            {t('accountPayments.check_result')}
          </StaffButton>
          {canRetryPreview && (
            <StaffButton
              onClick={() => void payment.retryPreview()}
              disabled={disabled || payment.busy || !enabled || payment.storageUnavailable}
            >
              {t('accountPayments.retry_original')}
            </StaffButton>
          )}
          {canDiscardPreview && (
            <StaffButton onClick={payment.discardPreview} disabled={payment.busy}>
              {t('accountPayments.discard_preview')}
            </StaffButton>
          )}
        </div>
      )}
      {payment.operation && (
        <AccountPaymentReview
          key={payment.operation.operationId}
          session={session}
          operation={payment.operation}
          pending={payment.pending}
          disabled={disabled || payment.busy || !enabled || payment.storageUnavailable}
          recoveryReleaseEnabled={safeReleaseEnabled}
          onReserve={payment.reserve}
          onCollect={payment.collect}
          onRelease={payment.release}
          onCheck={() => payment.check()}
        />
      )}
      {account && payment.canStart && (
        <AccountPaymentSelectionForm
          key={`${account.serviceSessionId}:${account.accountRevision}`}
          account={account}
          session={session}
          disabled={writesLocked}
          onQuote={payment.quote}
          onPlan={payment.plan}
        />
      )}
    </section>
  );
}
