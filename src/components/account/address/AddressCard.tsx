'use client';

import { useTranslation } from 'react-i18next';
import type { AddressDto } from '@/services/addressService';
import styles from '../AddressManagement.module.css';

interface AddressCardProps {
  address: AddressDto;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

/**
 * A single delivery-address card with edit / set-default / delete actions. Extracted verbatim from
 * AddressManagement.tsx (Sprint 4/6 god-file decomposition).
 */
export default function AddressCard({ address, onEdit, onDelete, onSetDefault }: AddressCardProps) {
  const { t } = useTranslation();

  return (
    <div className={`${styles.addressCard} ${address.isDefault ? styles.defaultCard : ''}`}>
      {address.isDefault && <div className={styles.defaultBadge}>{t('default_address_badge', 'Default')}</div>}

      <div className={styles.addressContent}>
        <h3 className={styles.addressLabel}>{address.label}</h3>
        <p className={styles.addressText}>
          {address.addressLine1}
          {address.addressLine2 && (
            <>
              <br />
              {address.addressLine2}
            </>
          )}
          <br />
          {address.postalCode} {address.city}
          {address.state && `, ${address.state}`}
          <br />
          {address.country}
        </p>
        {address.phone && <p className={styles.addressPhone}>📞 {address.phone}</p>}
        {address.deliveryInstructions && (
          <p className={styles.addressInstructions}>📝 {address.deliveryInstructions}</p>
        )}
      </div>

      <div className={styles.addressActions}>
        <button onClick={onEdit} className={styles.editButton}>
          {t('edit_button', 'Edit')}
        </button>
        {!address.isDefault && (
          <button onClick={onSetDefault} className={styles.setDefaultButton}>
            {t('set_default_button', 'Set as Default')}
          </button>
        )}
        <button onClick={onDelete} className={styles.deleteButton}>
          {t('delete_button', 'Delete')}
        </button>
      </div>
    </div>
  );
}
