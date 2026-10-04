'use client';

import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import StaffButton from '@/components/design-system/StaffButton';
import StatusBadge from '@/components/design-system/StatusBadge';
import { useAmendmentResolution } from '@/hooks/orderAmendments/useAmendmentResolution';
import { useAmendmentResolutionContext } from '@/hooks/orderAmendments/useAmendmentResolutionContext';
import AmendmentResolutionAmounts from './AmendmentResolutionAmounts';
import AmendmentResolutionManualForm from './AmendmentResolutionManualForm';
import AmendmentResolutionReview from './AmendmentResolutionReview';
import AmendmentResolutionTillForm from './AmendmentResolutionTillForm';
import styles from './AmendmentResolution.module.css';

interface Props {
  readonly actorId: string;
  readonly orderId: string;
  readonly amendmentId: string;
  readonly enabled: boolean;
  readonly expected?: { readonly currency: string; readonly creditMinor: number };
  readonly onChanged: () => void;
  readonly onClose: () => void;
}

export default function AmendmentResolutionModal(props: Props) {
  const { t } = useTranslation();
  const { enabled, onChanged } = props;
  const contextRefresh = useRef<() => Promise<void>>(() => Promise.resolve());
  const refresh = useCallback(async () => {
    onChanged();
    if (enabled) await contextRefresh.current();
  }, [enabled, onChanged]);
  const flow = useAmendmentResolution({ ...props, refresh });
  const canPrepare =
    props.enabled && !flow.hasPending && ['idle', 'reviewFailed', 'review', 'refused'].includes(flow.stage);
  const context = useAmendmentResolutionContext({ ...props, enabled: canPrepare });
  contextRefresh.current = context.refresh;
  const working = ['checking', 'quoting', 'working'].includes(flow.stage);
  const canReview = canPrepare && context.context && !context.loading && !context.failed;
  const uncertain = flow.hasPending || flow.stage === 'unavailable';
  const pendingManualIds = new Set(
    flow.result?.refundLegs
      .filter((leg) => leg.custody === 'ManualTill' && leg.state === 'Pending' && !leg.tillConfirmation)
      .map((leg) => leg.paymentId.toLowerCase()),
  );
  const tillQuote =
    flow.result && flow.reviewedQuote && !flow.hasPendingTillConfirmation
      ? {
          ...flow.reviewedQuote,
          refundLegs: flow.reviewedQuote.refundLegs.filter((leg) => pendingManualIds.has(leg.paymentId.toLowerCase())),
        }
      : undefined;
  return (
    <BaseModal
      isOpen
      onClose={props.onClose}
      title={t('orderAmendments.resolution_title')}
      presentation="responsive-sheet"
      isPending={flow.stage === 'working' || flow.stage === 'quoting'}
    >
      <div className={styles.panel}>
        {working && <output aria-live="polite">{t('common.loading')}</output>}
        {!props.enabled && <p className={styles.notice}>{t('orderAmendments.resolution_disabled')}</p>}
        {context.failed && (
          <div role="alert" className={styles.error}>
            <p>{t('orderAmendments.resolution_context_failed')}</p>
            <StaffButton disabled={working} onClick={() => void context.refresh().catch(() => undefined)}>
              {t('retry')}
            </StaffButton>
          </div>
        )}
        {flow.stage === 'reviewFailed' && (
          <p role="alert" className={styles.error}>
            {t('orderAmendments.resolution_review_failed')}
          </p>
        )}
        {flow.refusal && (
          <p role="alert" className={styles.notice}>
            {t('orderAmendments.resolution_refused')}
          </p>
        )}
        {flow.refusal && !flow.hasPending && flow.stage === 'unavailable' && (
          <StaffButton disabled={working} onClick={() => void flow.refreshRefused()}>
            {t('retry')}
          </StaffButton>
        )}
        {uncertain && (
          <p role="alert" className={styles.notice}>
            {t('orderAmendments.resolution_pending')}
          </p>
        )}
        {flow.result && (
          <>
            <StatusBadge tone={flow.stage === 'resolved' ? 'success' : 'warning'}>
              {t(
                flow.stage === 'resolved'
                  ? 'orderAmendments.resolution_resolved'
                  : 'orderAmendments.resolution_pending_status',
              )}
            </StatusBadge>
            <p className={styles.reference}>
              {t('orderAmendments.resolution_operation_reference')} <bdi dir="ltr">{flow.result.operationId}</bdi>
            </p>
            <AmendmentResolutionAmounts value={flow.result} />
          </>
        )}
        {flow.hasPending && (
          <div className={styles.actions}>
            <StaffButton disabled={working} onClick={() => void flow.check()}>
              {t('orderAmendments.check_operation')}
            </StaffButton>
            <StaffButton disabled={working} onClick={() => void flow.retry()}>
              {t('orderAmendments.retry_same_operation')}
            </StaffButton>
          </div>
        )}
        {flow.hasPendingTillConfirmation && (
          <div className={styles.recovery}>
            <p className={styles.notice}>{t('orderAmendments.resolution_till_retry_help')}</p>
            <StaffButton disabled={working || !flow.result} onClick={() => void flow.retryTill()}>
              {t('orderAmendments.resolution_retry_till')}
            </StaffButton>
          </div>
        )}
        {tillQuote && tillQuote.refundLegs.length > 0 && (
          <AmendmentResolutionTillForm
            key={`${flow.result?.operationId}:${tillQuote.refundLegs.map((leg) => leg.paymentId).join(':')}`}
            quote={tillQuote}
            disabled={working}
            onConfirm={flow.confirmTill}
          />
        )}
        {canReview && context.context && (
          <AmendmentResolutionManualForm
            key={`${context.context.expectedOrderVersion}:${context.context.expectedAccountRevision}`}
            context={context.context}
            disabled={working}
            onReview={flow.review}
          />
        )}
        {flow.stage === 'review' && flow.quote && (
          <AmendmentResolutionReview
            key={flow.quote.clientOperationId}
            quote={flow.quote}
            disabled={!props.enabled || working || context.failed}
            onSettle={flow.settle}
          />
        )}
      </div>
    </BaseModal>
  );
}
