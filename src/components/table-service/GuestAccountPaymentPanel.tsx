'use client';

import { useTranslation } from 'react-i18next';
import type { TableGuestAccountDto, TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import { useGuestAccountPaymentFlow } from '@/hooks/tableGuest/useGuestAccountPaymentFlow';
import GuestAccountPaymentContributionForm from './GuestAccountPaymentContributionForm';
import { PaymentHoldNotice, PaymentOperationReview, PaymentReceipt, PaymentStatus } from './GuestAccountPaymentDetails';
import styles from './GuestAccountPayment.module.css';

interface GuestAccountPaymentPanelProps {
  readonly tableAccount: TableGuestAccountDto | null;
  readonly activeIdentity: TableGuestVisitIdentity | null;
  readonly recoveryIdentity: TableGuestVisitIdentity | null;
  readonly newPaymentsEnabled: boolean;
  readonly canCreatePayment: boolean;
  readonly returnAttemptId: string | null;
  readonly returnHintPresent: boolean;
  readonly onAccountUpdated: () => void;
}

export default function GuestAccountPaymentPanel(props: GuestAccountPaymentPanelProps) {
  const { t, i18n } = useTranslation();
  const flow = useGuestAccountPaymentFlow(props);
  const account = flow.account;
  const attemptId = flow.attempt ? flow.attempt.attemptId : props.returnAttemptId;
  const receipt = attemptId ? (flow.receipts.find((entry) => entry.attemptId === attemptId)?.receipt ?? null) : null;
  const operation = flow.operation;
  const currentState = flow.checkout?.state ?? operation?.state ?? null;
  const unfinishedQuote = flow.attempt?.unfinishedQuote === true;
  const preStart =
    flow.attempt?.startRequested === false && (operation?.state === 'Quoted' || operation?.state === 'Reserved');
  const retryOriginal =
    flow.attempt?.startRequested === true && flow.checkout === null && props.activeIdentity !== null;
  const canCancel =
    props.activeIdentity !== null && flow.checkout !== null && ['Starting', 'Processing'].includes(flow.checkout.state);
  const canShowForm =
    props.canCreatePayment &&
    props.newPaymentsEnabled &&
    account !== null &&
    account.limits.online !== null &&
    flow.canReplaceAttempt &&
    !flow.storageUnavailable;
  const panelError = flow.error || flow.planRecoveryError;
  let panelErrorMessage = '';
  if (panelError === 'load') panelErrorMessage = t('table_guest_payment_load_failed');
  else if (panelError === 'action') panelErrorMessage = t('table_guest_payment_action_failed');

  return (
    <section className={styles.panel} aria-labelledby="guest-account-payment-heading">
      <header>
        <h2 id="guest-account-payment-heading" className={styles.heading}>
          {t('table_guest_payment_title')}
        </h2>
        <p className={styles.muted}>{t('table_guest_payment_description')}</p>
      </header>
      {props.returnHintPresent && (
        <output className={styles.notice} aria-live="polite">
          {t('table_guest_payment_return_check')}
        </output>
      )}
      {flow.storageUnavailable && (
        <p className={styles.error} role="alert">
          {t('table_guest_payment_storage')}
        </p>
      )}
      {panelError && (
        <p className={styles.error} role="alert">
          {panelErrorMessage}
        </p>
      )}
      {!props.newPaymentsEnabled && (flow.attempt || flow.pendingPlanIntent) && (
        <output className={styles.notice} aria-live="polite">
          {t('table_guest_payment_new_disabled')}
        </output>
      )}
      {flow.pendingPlanIntent && (
        <div className={styles.notice}>
          <output aria-live="polite">{t('table_guest_payment_plan_pending')}</output>
          {props.activeIdentity && (
            <button
              type="button"
              className={styles.button}
              disabled={flow.isWorking || flow.isLoading || flow.isRecoveryPolling || flow.planRecoveryLoading}
              onClick={() => void flow.resolveOriginalPlan()}
            >
              {t(flow.planRetryAvailable ? 'table_guest_payment_retry_original' : 'table_guest_payment_status')}
            </button>
          )}
        </div>
      )}
      {account?.limits.online === null && props.canCreatePayment && (
        <output className={styles.notice} aria-live="polite">
          {t('table_guest_payment_online_unavailable')}
        </output>
      )}
      {!props.canCreatePayment && props.activeIdentity && props.returnHintPresent && props.newPaymentsEnabled && (
        <output className={styles.notice} aria-live="polite">
          {t('table_guest_payment_pending_round')}
        </output>
      )}
      {(flow.isLoading || flow.isRecoveryPolling) && flow.attempt && (
        <output className={styles.muted} aria-live="polite">
          {t('loading')}
        </output>
      )}

      {preStart && operation && (
        <PaymentOperationReview
          operation={operation}
          tableAccount={props.tableAccount}
          canContinue={
            props.newPaymentsEnabled &&
            props.canCreatePayment &&
            !flow.storageUnavailable &&
            !flow.isLoading &&
            !flow.isRecoveryPolling
          }
          isWorking={flow.isWorking || flow.isLoading || flow.isRecoveryPolling}
          onContinue={flow.startOrResumeCheckout}
          onRelease={flow.releaseBeforeStart}
        />
      )}
      {unfinishedQuote && (
        <div className={styles.actions}>
          {props.activeIdentity && props.newPaymentsEnabled && props.canCreatePayment && (
            <button
              type="button"
              className={styles.button}
              disabled={flow.isWorking || flow.isLoading || flow.isRecoveryPolling || flow.storageUnavailable}
              onClick={() => void flow.retryUnfinishedQuote()}
            >
              {t('table_guest_payment_retry_original')}
            </button>
          )}
          <button
            type="button"
            className={styles.button}
            disabled={flow.isWorking || flow.isLoading || flow.isRecoveryPolling || flow.storageUnavailable}
            onClick={() => void flow.discardUnfinishedQuote()}
          >
            {t('table_guest_payment_discard_unfinished_quote')}
          </button>
        </div>
      )}
      {flow.attempt &&
        !operation &&
        !flow.attempt.startRequested &&
        !unfinishedQuote &&
        props.activeIdentity !== null && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              disabled={flow.isWorking || flow.isLoading || flow.isRecoveryPolling}
              onClick={() => void flow.refreshPaymentStatus()}
            >
              {t('table_guest_payment_status')}
            </button>
          </div>
        )}
      {flow.attempt?.startRequested && !currentState && retryOriginal && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            disabled={flow.isWorking || flow.isLoading || flow.isRecoveryPolling}
            onClick={() => void flow.startOrResumeCheckout()}
          >
            {t('table_guest_payment_retry_original')}
          </button>
        </div>
      )}
      {flow.attempt?.startRequested &&
        !currentState &&
        !props.activeIdentity &&
        (flow.attempt.attemptId || props.returnAttemptId) && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              disabled={flow.isWorking || flow.isLoading || flow.isRecoveryPolling}
              onClick={() => void flow.refreshPaymentStatus()}
            >
              {t('table_guest_payment_status')}
            </button>
          </div>
        )}
      {currentState && flow.attempt?.startRequested && (
        <PaymentStatus
          state={currentState}
          amountMinor={flow.checkout?.amountMinor ?? operation?.amountMinor ?? 0}
          currency={flow.checkout?.currency ?? operation?.currency ?? account?.currency ?? ''}
          receivedMinor={flow.checkout?.receivedMinor ?? 0}
          refundedMinor={flow.checkout?.refundedMinor ?? 0}
          reconciliationRequired={flow.checkout?.reconciliationRequired ?? false}
          isWorking={flow.isWorking || flow.isLoading}
          isRecoveryPolling={flow.isRecoveryPolling}
          isCancellationWorking={flow.isCancellationWorking}
          retryOriginal={retryOriginal}
          showStatus={flow.checkout !== null}
          canCancel={canCancel}
          onRetry={flow.startOrResumeCheckout}
          onRefresh={flow.refreshPaymentStatus}
          onCancel={flow.requestCancellation}
        />
      )}
      {receipt && <PaymentReceipt receipt={receipt} locale={i18n.language} />}
      {flow.returnReceiptUnavailable && (
        <output className={styles.notice} aria-live="polite">
          {t('table_guest_payment_return_missing')}
        </output>
      )}
      {canShowForm && account && account.availableMinor > 0 && !flow.isLoading && !flow.isRecoveryPolling && (
        <GuestAccountPaymentContributionForm
          account={account}
          tableAccount={props.tableAccount}
          activePlan={account.activeEqualSharePlan}
          disabled={flow.isWorking || flow.isAccountLoading || flow.planRecoveryBlocked}
          onReview={flow.reviewContribution}
          onCreatePlan={flow.createEqualSharePlan}
        />
      )}
      {account?.availableMinor === 0 && props.canCreatePayment && (
        <p className={styles.muted}>{t('table_guest_payment_items_empty')}</p>
      )}
      {flow.attempt && !flow.canReplaceAttempt && (
        <PaymentHoldNotice
          state={currentState}
          reconciliationRequired={flow.checkout?.reconciliationRequired ?? false}
        />
      )}
    </section>
  );
}
