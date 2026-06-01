'use client';

import { useTranslation } from 'react-i18next';
import styles from './AddressManagement.module.css';
import { useAddressManagement } from '@/hooks/account/useAddressManagement';
import AddressCard from './address/AddressCard';
import AddressFormModal from './address/AddressFormModal';

export default function AddressManagement() {
  const { t } = useTranslation();
  const {
    addresses,
    loading,
    error,
    showAddressForm,
    editingAddress,
    deleteConfirmModal,
    handleAddNew,
    handleEdit,
    handleDelete,
    confirmDelete,
    handleSetDefault,
    handleSaveAddress,
    closeForm,
    closeDeleteModal,
  } = useAddressManagement();

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>{t('loading', 'Loading...')}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{t('delivery_addresses_title', 'Delivery Addresses')}</h2>
        <button onClick={handleAddNew} className={styles.addButton}>
          + {t('add_address_button', 'Add New Address')}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {addresses.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t('no_addresses_message', "You haven't added any delivery addresses yet.")}</p>
          <button onClick={handleAddNew} className={styles.addButton}>
            {t('add_first_address_button', 'Add Your First Address')}
          </button>
        </div>
      ) : (
        <div className={styles.addressGrid}>
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={() => handleEdit(address)}
              onDelete={() => handleDelete(address.id)}
              onSetDefault={() => handleSetDefault(address.id)}
            />
          ))}
        </div>
      )}

      {showAddressForm && <AddressFormModal address={editingAddress} onSave={handleSaveAddress} onCancel={closeForm} />}

      {deleteConfirmModal.show && (
        <div className={styles.modalOverlay} onClick={closeDeleteModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2>{t('confirm_delete_title', 'Delete Address')}</h2>
            <p>{t('address_delete_confirm', 'Are you sure you want to delete this address?')}</p>
            <div className={styles.formActions}>
              <button type="button" onClick={closeDeleteModal} className={styles.cancelButton}>
                {t('cancel_button', 'Cancel')}
              </button>
              <button type="button" onClick={confirmDelete} className={styles.deleteButton}>
                {t('delete_button', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
