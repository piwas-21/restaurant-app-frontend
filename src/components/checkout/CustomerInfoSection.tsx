/**
 * Customer Info Section Component
 *
 * Displays customer name, email, and phone number
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { User, Edit } from 'lucide-react';
import styles from './CustomerInfoSection.module.css';

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
}

interface CustomerInfoSectionProps {
  customerInfo: CustomerInfo;
  /** Re-opens the order-type/contact editor in place (review page owns the modal). */
  onEdit: () => void;
}

export default function CustomerInfoSection({ customerInfo, onEdit }: Readonly<CustomerInfoSectionProps>) {
  const { t } = useTranslation();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <User size={20} />
          {t('customer_information', 'Customer Information')}
        </h2>
        <button onClick={onEdit} className={styles.editButton}>
          <Edit size={16} />
          {t('edit', 'Edit')}
        </button>
      </div>
      <div className={styles.infoCard}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>{t('name', 'Name')}:</span>
          <span className={styles.infoValue}>{customerInfo.name}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>{t('email', 'Email')}:</span>
          <span className={styles.infoValue}>{customerInfo.email}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>{t('phone', 'Phone')}:</span>
          <span className={styles.infoValue}>{customerInfo.phone}</span>
        </div>
      </div>
    </section>
  );
}
