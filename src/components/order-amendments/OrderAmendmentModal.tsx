'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import type { OrderDto } from '@/types/order';
import { useOrderAmendment } from '@/hooks/orderAmendments/useOrderAmendment';
import type { OrderAmendmentDraft } from '@/hooks/orderAmendments/orderAmendmentTypes';
import { amendmentExpiryPassed } from '@/hooks/orderAmendments/orderAmendmentOperationState';
import { orderNeedsPreparingOverride } from './orderAmendmentPresentation';
import OrderAmendmentEditStage from './OrderAmendmentEditStage';
import OrderAmendmentModalFooter from './OrderAmendmentModalFooter';
import OrderAmendmentReviewStage from './OrderAmendmentReviewStage';
import styles from './OrderAmendmentModal.module.css';

const EMPTY_DRAFT: OrderAmendmentDraft = {
  additions: [],
  changes: [],
  reason: '',
  preparingOverrideAcknowledged: false,
  releaseAdditionsToKitchen: true,
  localProviderSupplementConsent: false,
  providerConsentNote: '',
};

interface OrderAmendmentModalProps {
  readonly order: OrderDto;
  readonly operatorRole: 'Server' | 'Cashier' | 'Admin';
  readonly onClose: () => void;
  readonly onCommitted?: () => void;
  readonly recoveryOnly?: boolean;
}

function translatedError(error: string | null, t: (key: string) => string): string | null {
  if (!error) return null;
  return error.startsWith('orderAmendments.') ? t(error) : error;
}

export default function OrderAmendmentModal({
  order,
  operatorRole,
  onClose,
  onCommitted,
  recoveryOnly = false,
}: Readonly<OrderAmendmentModalProps>) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<OrderAmendmentDraft>(EMPTY_DRAFT);
  const amendment = useOrderAmendment(order, onCommitted);
  const hasWork = draft.additions.length + draft.changes.length > 0;
  const hasIncompleteReplacement = draft.changes.some((change) => change.kind === 'Replace' && !change.current);
  const requiresReason = draft.changes.length > 0 && !draft.reason.trim();
  const requiresPreparingOverride = orderNeedsPreparingOverride(order, draft.changes.length > 0);
  const missingProviderConsent =
    Boolean(order.externalOrder) &&
    draft.additions.length > 0 &&
    (!draft.localProviderSupplementConsent || !draft.providerConsentNote.trim());
  const canQuote =
    !recoveryOnly &&
    amendment.recoveryReady &&
    hasWork &&
    !hasIncompleteReplacement &&
    !requiresReason &&
    !missingProviderConsent &&
    (!requiresPreparingOverride || draft.preparingOverrideAcknowledged);
  const isPending = !recoveryOnly && ['quoting', 'committing', 'uncertain'].includes(amendment.phase);
  const quoteExpired = !recoveryOnly && Boolean(amendment.quote && amendmentExpiryPassed(amendment.quote.expiresAt));
  const canRequote = !recoveryOnly && amendment.phase === 'uncertain' && amendment.canRequote;
  const error = translatedError(amendment.error, (key) => t(key));

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={
        recoveryOnly
          ? t('orderAmendments.check_operation', 'Check the original operation')
          : t('orderAmendments.title', 'Amend order {{order}}', { order: order.orderNumber })
      }
      size="lg"
      presentation="responsive-sheet"
      className={styles.modal}
      isPending={isPending}
      disableEscapeClose={isPending}
      disableBackdropClose={isPending}
      footer={
        <OrderAmendmentModalFooter
          amendment={amendment}
          draft={draft}
          canQuote={canQuote}
          quoteExpired={quoteExpired}
          canRequote={canRequote}
          readOnlyRecovery={recoveryOnly}
          onClose={onClose}
        />
      }
    >
      <div className={styles.body}>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {!recoveryOnly && amendment.phase === 'editing' && (
          <p className={styles.stageNotice}>
            {t(
              'orderAmendments.draft_notice',
              'Changes stay as a draft until you review the server quote and confirm.',
            )}
          </p>
        )}
        {!recoveryOnly && (
          <div hidden={amendment.phase !== 'editing' && amendment.phase !== 'quoting'}>
            <OrderAmendmentEditStage order={order} draft={draft} onDraftChange={setDraft} operatorRole={operatorRole} />
          </div>
        )}
        {!recoveryOnly && amendment.quote && amendment.phase !== 'editing' && amendment.phase !== 'quoting' && (
          <OrderAmendmentReviewStage
            quote={amendment.quote}
            language={i18n.language || 'en'}
            proposedAdditionItems={draft.additions}
            proposedInstructionChanges={draft.changes
              .filter((change) => change.kind === 'InstructionChange' || change.kind === 'Replace')
              .map((change) => ({
                orderItemId: change.orderItemId,
                kind: change.kind,
                startOrdinal: change.startOrdinal,
                quantity: change.quantity,
                current: change.current ?? undefined,
              }))}
          />
        )}
        {!recoveryOnly && quoteExpired && amendment.phase === 'review' && (
          <p className={styles.error} role="alert">
            {t('orderAmendments.quote_expired', 'This quote expired. Review a fresh quote before committing.')}
          </p>
        )}
        {amendment.phase === 'uncertain' && (
          <output className={styles.stageNotice} aria-live="polite" aria-atomic="true">
            {!recoveryOnly &&
            (amendment.operationLookup?.status === 'Unknown' || amendment.operationLookup?.status === 0)
              ? t(
                  'orderAmendments.operation_unknown',
                  'The original operation is not confirmed. Check it again or retry only with the same operation ID.',
                )
              : t(
                  'orderAmendments.commit_uncertain',
                  'The result is not confirmed yet. Keep this review open and check the same operation ID.',
                )}
            {amendment.clientOperationId && <span dir="ltr"> · {amendment.clientOperationId}</span>}
          </output>
        )}
        {amendment.result && amendment.phase === 'committed' && (
          <output className={styles.successNotice} aria-live="polite" aria-atomic="true">
            {t('orderAmendments.committed', 'Amendment committed')} ·{' '}
            <span dir="ltr">{amendment.result.clientOperationId}</span>
          </output>
        )}
      </div>
    </BaseModal>
  );
}
