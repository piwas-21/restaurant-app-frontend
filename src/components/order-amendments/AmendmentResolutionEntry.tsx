'use client';

import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import { useAmendmentResolutionUi } from '@/contexts/AmendmentResolutionUiContext';
import type { OrderAmendmentHistory } from '@/types/orderAmendment';
import styles from './AmendmentResolution.module.css';

export default function AmendmentResolutionEntry({ record }: { readonly record: OrderAmendmentHistory }) {
  const { t } = useTranslation();
  const ui = useAmendmentResolutionUi();
  const financial = record.financialResolution;
  if (financial.resolutionStatus !== 'Pending' || financial.potentialCreditMinor <= 0) return null;
  if (!ui) return <p className={styles.notice}>{t('orderAmendments.resolution_admin_required')}</p>;
  const currency = financial.currency;
  if (!currency) return <p className={styles.error}>{t('orderAmendments.currency_unavailable')}</p>;
  return (
    <StaffButton
      disabled={!ui.canStart}
      onClick={() =>
        ui.open(record.amendmentId, {
          currency,
          creditMinor: financial.potentialCreditMinor,
        })
      }
    >
      {t('orderAmendments.resolution_open')}
    </StaffButton>
  );
}
