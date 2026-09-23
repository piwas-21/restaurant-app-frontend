'use client';

import { useTranslation } from 'react-i18next';
import type { StaffCustomerSelection } from '@/types/staffCustomer';
import { useModuleEnabled } from '@/contexts/ModulesContext';
import styles from './StaffCustomerSummary.module.css';

export default function StaffCustomerSummary({ selection }: { readonly selection?: StaffCustomerSelection }) {
  const { t } = useTranslation();
  const loyaltyEnabled = useModuleEnabled('loyalty');
  if (!selection?.customerName && !selection?.customerEmail && !selection?.customerPhone) return null;
  return (
    <div className={styles.summary} aria-label={t('staff_customer.selected')}>
      <strong>{selection.customerName || selection.customerEmail || selection.customerPhone}</strong>
      {selection.customerEmail && <span>{selection.customerEmail}</span>}
      {selection.customerPhone && <span>{selection.customerPhone}</span>}
      {loyaltyEnabled && selection.customerUserId && selection.currentPoints !== undefined && (
        <span>
          {t('staff_customer.points_balance', { points: selection.currentPoints })}
          {selection.pointsToRedeem
            ? ` · ${t('staff_customer.points_redeem', { points: selection.pointsToRedeem })}`
            : ''}
        </span>
      )}
    </div>
  );
}
