'use client';

import { useTranslation } from 'react-i18next';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import styles from './TaxConfigurationManager.module.css';
import { useTaxConfigurations } from './tax-configuration/useTaxConfigurations';
import TaxConfigurationList from './tax-configuration/TaxConfigurationList';
import TaxConfigurationFormModal from './tax-configuration/TaxConfigurationFormModal';

export default function TaxConfigurationManager() {
  const { t } = useTranslation();
  const tax = useTaxConfigurations();

  if (tax.loading) {
    return (
      <div className={styles.loading}>
        <p>{t('loading', 'Loading...')}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <TaxConfigurationList
        taxConfigs={tax.taxConfigs}
        onCreate={tax.handleCreate}
        onToggle={tax.handleToggle}
        onEdit={tax.handleEdit}
        onDelete={tax.handleDelete}
        getOrderTypeLabel={tax.getOrderTypeLabel}
      />

      <TaxConfigurationFormModal
        isOpen={tax.isFormOpen}
        editingConfig={tax.editingConfig}
        formData={tax.formData}
        setFormData={tax.setFormData}
        rateInput={tax.rateInput}
        isRateValid={tax.isRateValid}
        onRateChange={tax.handleRateChange}
        onClose={tax.closeForm}
        onSubmit={tax.handleSubmit}
      />

      <ConfirmationModal
        isOpen={tax.isDeleteModalOpen}
        onClose={tax.closeDeleteModal}
        onConfirm={tax.confirmDelete}
        message={t('tax_delete_confirm', 'Are you sure you want to delete this tax configuration?')}
      />
    </div>
  );
}
