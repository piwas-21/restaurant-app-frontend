'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, DollarSign } from 'lucide-react';
import { OrderType } from '@/types/order';
import { useApplicableTaxes } from '@/hooks/admin/useApplicableTaxes';
import type { TaxConfiguration } from '@/services/adminTaxConfigurationService';
import styles from './TaxSelectionModal.module.css';

interface TaxSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTax: (tax: TaxConfiguration | null) => void;
  currentOrderType: OrderType;
  currentTaxId?: string | null;
}

/**
 * **Currently unrendered — the fix below is LATENT, not observed.** The only importer of this
 * component anywhere in `src/` or `e2e/` is its own test; no page mounts it. So the load-failure
 * defect it now handles is real in the code and unreachable in the product, and no cashier has
 * ever met it. Recorded because the first draft of this comment
 * asserted a consequence ("the cashier left the order untaxed") that could not have happened —
 * the ratchet counts syntax, and a site it counts is not thereby a site a user can reach.
 * Whoever wires this screen up inherits the fix; whoever deletes it should take the tests too.
 */
export const TaxSelectionModal: React.FC<TaxSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectTax,
  currentOrderType,
  currentTaxId,
}) => {
  const { t } = useTranslation();
  const [selectedTaxId, setSelectedTaxId] = useState<string | null>(currentTaxId || null);
  // The fetch, its filter and its error slot — see `useApplicableTaxes` for why the failure needs
  // a slot of its own rather than an empty list.
  const { taxConfigurations, loading, error: loadError, reload } = useApplicableTaxes(isOpen, currentOrderType);

  const handleSelectTax = (taxId: string) => {
    setSelectedTaxId(taxId);
  };

  const handleConfirm = () => {
    const selectedTax = taxConfigurations.find((tax) => tax.id === selectedTaxId);
    onSelectTax(selectedTax || null);
    onClose();
  };

  const handleNoTax = () => {
    setSelectedTaxId(null);
  };

  const getOrderTypeLabel = (orderType: OrderType): string => {
    switch (orderType) {
      case OrderType.DineIn:
        return t('order_type_dine_in', 'Dine-In');
      case OrderType.Takeaway:
        return t('order_type_takeaway', 'Takeaway');
      case OrderType.Delivery:
        return t('order_type_delivery', 'Delivery');
      default:
        return orderType;
    }
  };

  /**
   * Four mutually exclusive states, as early returns rather than a nested ternary chain: loading,
   * the load FAILED, the server genuinely returned nothing, and the list. The order is
   * load-bearing — the error must come before the empty state, or a failed read renders
   * "No tax configurations available", which is an answer the server never gave.
   */
  const renderContent = () => {
    if (loading) {
      return <div className={styles.loading}>{t('loading_tax_configurations', 'Loading tax configurations...')}</div>;
    }
    if (loadError) {
      return (
        <div className={styles.emptyState} role="alert">
          <DollarSign size={48} />
          <p>{loadError}</p>
          <button type="button" className={styles.cancelButton} onClick={reload}>
            {t('retry', 'Retry')}
          </button>
        </div>
      );
    }
    if (taxConfigurations.length === 0) {
      return (
        <div className={styles.emptyState}>
          <DollarSign size={48} />
          <p>
            {t('no_tax_configurations_for_order_type', 'No tax configurations available for {{orderType}}', {
              orderType: getOrderTypeLabel(currentOrderType),
            })}
          </p>
          <small>
            {t('create_tax_configuration_admin_panel', 'Please create a tax configuration in the admin panel')}
          </small>
        </div>
      );
    }
    return (
      <div className={styles.taxList}>
        {/* Option for no tax */}
        <div className={`${styles.taxCard} ${selectedTaxId === null ? styles.selected : ''}`} onClick={handleNoTax}>
          <div className={styles.taxInfo}>
            <h3 className={styles.taxName}>{t('no_tax', 'No Tax')}</h3>
            <p className={styles.taxDescription}>{t('no_tax_description', 'Do not apply any tax to this order')}</p>
          </div>
          <div className={styles.taxRate}>0.00%</div>
          {selectedTaxId === null && (
            <div className={styles.checkmark}>
              <Check size={20} />
            </div>
          )}
        </div>

        {taxConfigurations.map((tax) => (
          <div
            key={tax.id}
            className={`${styles.taxCard} ${selectedTaxId === tax.id ? styles.selected : ''}`}
            onClick={() => handleSelectTax(tax.id)}
          >
            <div className={styles.taxInfo}>
              <h3 className={styles.taxName}>{tax.name}</h3>
              <p className={styles.taxDescription}>{tax.description}</p>
              <div className={styles.applicableTypes}>
                {tax.applicableOrderTypes.map((type) => (
                  <span key={type} className={styles.typeBadge}>
                    {getOrderTypeLabel(type)}
                  </span>
                ))}
              </div>
            </div>
            <div className={styles.taxRate}>{(tax.rate * 100).toFixed(2)}%</div>
            {selectedTaxId === tax.id && (
              <div className={styles.checkmark}>
                <Check size={20} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <DollarSign className={styles.icon} />
            <div>
              <h2 className={styles.title}>{t('select_tax_rate', 'Select Tax Rate')}</h2>
              <p className={styles.subtitle}>
                {t('order_type', 'Order Type')}: <strong>{getOrderTypeLabel(currentOrderType)}</strong>
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Close">
            <X size={24} />
          </button>
        </div>

        <div className={styles.content}>{renderContent()}</div>

        <div className={styles.footer}>
          <button type="button" onClick={onClose} className={styles.cancelButton}>
            {t('cancel', 'Cancel')}
          </button>
          {/* Also disabled on `loadError`: with the list empty, Confirm resolves to `no tax` and
              would silently clear an already-set `currentTaxId` on the strength of a failed read. */}
          <button
            type="button"
            onClick={handleConfirm}
            className={styles.confirmButton}
            disabled={loading || loadError !== null}
          >
            {t('confirm_selection', 'Confirm Selection')}
          </button>
        </div>
      </div>
    </div>
  );
};
