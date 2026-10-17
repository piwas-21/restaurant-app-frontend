'use client';

import { useId, useState } from 'react';
import { FilePenLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './OrderAmendmentEntryButton.module.css';

const explanations: Readonly<Record<string, string>> = {
  'orderAmendments.resolution_payment_held': 'amendmentHelp.paymentHeld',
  'orderAmendments.resolution_pending': 'amendmentHelp.correctionPending',
  'orderAmendments.order_refund_activity': 'amendmentHelp.refundReview',
};

export default function AmendmentUnavailableButton({ reason }: Readonly<{ reason: string }>) {
  const { t } = useTranslation();
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const message = t(explanations[reason] ?? reason);
  return (
    <div className={styles.blocked}>
      <button
        type="button"
        className={styles.action}
        aria-disabled="true"
        aria-describedby={id}
        aria-expanded={expanded}
        title={message}
        onClick={() => setExpanded((value) => !value)}
      >
        <FilePenLine size={17} aria-hidden="true" />
        {t('orderAmendments.open', 'Amend order')}
      </button>
      <p id={id} className={styles.explanation} data-expanded={expanded}>
        {message}
      </p>
    </div>
  );
}
