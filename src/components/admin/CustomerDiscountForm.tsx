'use client';

import { useTranslation } from 'react-i18next';
import { X, Save, Loader2 } from 'lucide-react';
import type { CustomerDiscountRule } from '@/types/fidelity';
import { useCustomerDiscountForm } from '@/hooks/admin/useCustomerDiscountForm';
import CustomerDiscountCustomerField from './customer-discount/CustomerDiscountCustomerField';
import CustomerDiscountFields from './customer-discount/CustomerDiscountFields';
import styles from './CustomerDiscountForm.module.css';

interface CustomerDiscountFormProps {
  discount: CustomerDiscountRule | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Admin create/edit customer-discount modal. Orchestrates the customer + discount field
 * sub-components and the actions hook (useCustomerDiscountForm), where the state, validation,
 * and submit live (Sprint 6 god-file decomposition).
 */
export default function CustomerDiscountForm({ discount, onClose, onSuccess }: CustomerDiscountFormProps) {
  const { t } = useTranslation();
  const form = useCustomerDiscountForm(discount, onSuccess);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{discount ? t('edit_discount', 'Edit Discount') : t('create_new_discount', 'Create New Discount')}</h2>
          <button onClick={onClose} className={styles.closeButton} disabled={form.loading}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={form.handleSubmit} className={styles.form}>
          <CustomerDiscountCustomerField
            isEditMode={!!discount}
            loading={form.loading}
            name={form.formData.name}
            onChange={form.handleChange}
            selectedUser={form.selectedUser}
            searchQuery={form.searchQuery}
            searchResults={form.searchResults}
            searchLoading={form.searchLoading}
            showSearchResults={form.showSearchResults}
            onSearchChange={form.handleSearchChange}
            onUserSelect={form.handleUserSelect}
            onClearUser={form.handleClearUser}
          />

          <CustomerDiscountFields formData={form.formData} loading={form.loading} onChange={form.handleChange} />

          <div className={styles.actions}>
            <button type="button" onClick={onClose} className={styles.cancelButton} disabled={form.loading}>
              {t('cancel', 'Cancel')}
            </button>
            <button type="submit" className={styles.submitButton} disabled={form.loading}>
              {form.loading ? (
                <>
                  <Loader2 size={18} className={styles.spinner} />
                  {t('saving', 'Saving...')}
                </>
              ) : (
                <>
                  <Save size={18} />
                  {discount ? t('update_discount', 'Update Discount') : t('create_discount', 'Create Discount')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
