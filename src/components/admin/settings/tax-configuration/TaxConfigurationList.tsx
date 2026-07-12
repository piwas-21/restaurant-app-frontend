'use client';

import { useTranslation } from 'react-i18next';
import { Trash2, Edit, Plus, DollarSign, ToggleLeft, ToggleRight } from 'lucide-react';
import type { TaxConfiguration } from '@/services/adminTaxConfigurationService';
import type { OrderType } from '@/types/order';
import styles from '../TaxConfigurationManager.module.css';

interface TaxConfigurationListProps {
  taxConfigs: TaxConfiguration[];
  onCreate: () => void;
  onToggle: (config: TaxConfiguration) => void;
  onEdit: (config: TaxConfiguration) => void;
  onDelete: (id: string) => void;
  getOrderTypeLabel: (orderType: OrderType) => string;
}

export default function TaxConfigurationList({
  taxConfigs,
  onCreate,
  onToggle,
  onEdit,
  onDelete,
  getOrderTypeLabel,
}: TaxConfigurationListProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className={styles.header}>
        <button onClick={onCreate} className={styles.createButton}>
          <Plus size={18} />
          {t('add_tax_configuration', 'Add Tax Configuration')}
        </button>
      </div>

      <div className={styles.configList}>
        {taxConfigs.length === 0 ? (
          <div className={styles.emptyState}>
            <DollarSign size={48} />
            <p>{t('no_tax_configurations', 'No tax configurations found')}</p>
            <button onClick={onCreate} className={styles.emptyButton}>
              {t('create_first_tax_configuration', 'Create First Tax Configuration')}
            </button>
          </div>
        ) : (
          taxConfigs.map((config) => (
            <div
              key={config.id}
              className={`${styles.configCard} ${config.isEnabled ? styles.enabled : styles.disabled}`}
            >
              <div className={styles.configHeader}>
                <div className={styles.configInfo}>
                  <h3 className={styles.configName}>{config.name}</h3>
                  <p className={styles.configDescription}>{config.description}</p>
                </div>
                <div className={styles.configStatus}>
                  {config.isEnabled ? (
                    <span className={styles.statusBadge}>{t('active', 'Active')}</span>
                  ) : (
                    <span className={`${styles.statusBadge} ${styles.inactive}`}>{t('inactive', 'Inactive')}</span>
                  )}
                </div>
              </div>

              <div className={styles.configDetails}>
                <div className={styles.rateDisplay}>
                  <span className={styles.rateLabel}>{t('rate', 'Rate')}:</span>
                  <span className={styles.rateValue}>{config.rate.toFixed(2)}%</span>
                </div>
                <div className={styles.orderTypesDisplay}>
                  <span className={styles.orderTypesLabel}>{t('applies_to', 'Applies to')}:</span>
                  <div className={styles.orderTypesBadges}>
                    {config.applicableOrderTypes && config.applicableOrderTypes.length > 0 ? (
                      config.applicableOrderTypes.map((type) => (
                        <span key={type} className={styles.orderTypeBadge}>
                          {getOrderTypeLabel(type)}
                        </span>
                      ))
                    ) : (
                      <span className={styles.orderTypeBadge} style={{ opacity: 0.5 }}>
                        {t('no_order_types_selected', 'No order types selected')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.configActions}>
                <button
                  onClick={() => onToggle(config)}
                  className={styles.toggleButton}
                  title={config.isEnabled ? t('disable', 'Disable') : t('enable', 'Enable')}
                >
                  {config.isEnabled ? (
                    <>
                      <ToggleRight size={18} />
                      {t('disable', 'Disable')}
                    </>
                  ) : (
                    <>
                      <ToggleLeft size={18} />
                      {t('enable', 'Enable')}
                    </>
                  )}
                </button>
                <button onClick={() => onEdit(config)} className={styles.editButton} title={t('edit', 'Edit')}>
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => onDelete(config.id)}
                  className={styles.deleteButton}
                  title={t('delete', 'Delete')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
