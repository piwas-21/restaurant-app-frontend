'use client';

import { useTranslation } from 'react-i18next';
import type { OrderAmendmentDraft } from '@/hooks/orderAmendments/orderAmendmentTypes';
import type { useOrderAmendment } from '@/hooks/orderAmendments/useOrderAmendment';
import styles from './OrderAmendmentModal.module.css';

interface OrderAmendmentModalFooterProps {
  readonly amendment: ReturnType<typeof useOrderAmendment>;
  readonly draft: OrderAmendmentDraft;
  readonly canQuote: boolean;
  readonly quoteExpired: boolean;
  readonly canRequote: boolean;
  readonly readOnlyRecovery?: boolean;
  readonly onClose: () => void;
}

export default function OrderAmendmentModalFooter({
  amendment,
  draft,
  canQuote,
  quoteExpired,
  canRequote,
  readOnlyRecovery = false,
  onClose,
}: Readonly<OrderAmendmentModalFooterProps>) {
  const { t } = useTranslation();

  if (readOnlyRecovery) {
    return (
      <div className={styles.footer}>
        {amendment.phase === 'uncertain' && (
          <button type="button" onClick={() => void amendment.checkOperation()}>
            {t('orderAmendments.check_operation', 'Check the original operation')}
          </button>
        )}
        <button type="button" className={styles.primary} onClick={onClose}>
          {t('orderAmendments.close', 'Close')}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.footer}>
      {amendment.phase === 'editing' && (
        <>
          <button type="button" onClick={onClose}>
            {t('orderAmendments.close', 'Close')}
          </button>
          <div className={styles.footerGroup}>
            <button
              type="button"
              className={styles.primary}
              disabled={!canQuote}
              onClick={() => void amendment.prepareQuote(draft)}
            >
              {t('orderAmendments.prepare_quote', 'Get a quote')}
            </button>
          </div>
        </>
      )}
      {amendment.phase === 'quoting' && (
        <button type="button" className={styles.primary} disabled>
          {t('orderAmendments.quoting', 'Preparing quote…')}
        </button>
      )}
      {amendment.phase === 'review' && (
        <>
          <button type="button" onClick={amendment.reset}>
            {t('orderAmendments.back_to_changes', 'Back to changes')}
          </button>
          <div className={styles.footerGroup}>
            <button
              type="button"
              className={styles.primary}
              disabled={quoteExpired}
              onClick={() => void amendment.commit()}
            >
              {t('orderAmendments.commit', 'Confirm amendment')}
            </button>
          </div>
        </>
      )}
      {amendment.phase === 'committing' && (
        <button type="button" className={styles.primary} disabled>
          {t('orderAmendments.committing', 'Saving amendment…')}
        </button>
      )}
      {amendment.phase === 'uncertain' && (
        <div className={styles.footerGroup}>
          <button type="button" onClick={() => void amendment.checkOperation()}>
            {t('orderAmendments.check_operation', 'Check the original operation')}
          </button>
          {canRequote && (
            <button type="button" onClick={amendment.reset}>
              {t('orderAmendments.return_to_edits', 'Return to edits and request a new quote')}
            </button>
          )}
          {amendment.canRetrySameCommit && (
            <button type="button" className={styles.primary} onClick={() => void amendment.retrySameCommit()}>
              {t('orderAmendments.retry_same_operation', 'Retry with the same operation ID')}
            </button>
          )}
        </div>
      )}
      {amendment.phase === 'committed' && (
        <button type="button" className={styles.primary} onClick={onClose}>
          {t('orderAmendments.close', 'Close')}
        </button>
      )}
    </div>
  );
}
