'use client';

import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import type { StaffCustomerSelection } from '@/types/staffCustomer';
import StaffCustomerPicker from './StaffCustomerPicker';
import styles from './StaffCustomerModal.module.css';

interface Props {
  readonly isOpen: boolean;
  readonly selection?: StaffCustomerSelection;
  readonly disabled?: boolean;
  readonly onChange: (value: StaffCustomerSelection | undefined) => void;
  readonly onClose: () => void;
}

export default function StaffCustomerModal({ isOpen, selection, disabled = false, onChange, onClose }: Props) {
  const { t } = useTranslation();
  if (!isOpen) return null;
  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={t('staff_customer.title')}
      size="md"
      footer={
        <button type="button" className={styles.done} onClick={onClose} disabled={disabled}>
          {t('staff_customer.done')}
        </button>
      }
    >
      <StaffCustomerPicker value={selection} onChange={onChange} disabled={disabled} />
    </BaseModal>
  );
}
