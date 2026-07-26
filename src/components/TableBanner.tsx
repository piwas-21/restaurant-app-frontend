'use client';

import React, { useState } from 'react';
import { X, QrCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTableContext } from '@/contexts/TableContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { OrderType } from '@/types/order';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import styles from './TableBanner.module.css';

interface TableBannerProps {
  position?: 'top' | 'floating';
}

export default function TableBanner({ position = 'top' }: TableBannerProps) {
  const { t } = useTranslation();
  const { tableContext, clearTableContext, hasTableContext } = useTableContext();
  const { state: orderTypeState, clearOrderType } = useOrderType();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (!hasTableContext) {
    return null;
  }

  const handleConfirmClear = () => {
    setIsConfirmOpen(false);
    clearTableContext();
    // G2: clearing the table used to leave the order type on Dine-In with an orphaned table
    // number — the banner disappeared while checkout still believed the guest was seated. The
    // dine-in pin came FROM this table, so it goes with it. A guest who had deliberately chosen
    // Takeaway or Delivery keeps that; only the scan-derived choice is undone.
    if (orderTypeState.orderType === OrderType.DineIn) {
      clearOrderType();
    }
  };

  return (
    <>
      <div
        className={`${styles.banner} ${position === 'floating' ? styles.floating : styles.top}`}
        role="status"
        aria-live="polite"
      >
        <div className={styles.content}>
          <div className={styles.icon}>
            <QrCode size={20} />
          </div>

          <div className={styles.info}>
            <span className={styles.label}>{t('ordering_for_table', 'Ordering for Table')}</span>
            <span className={styles.tableNumber}>{tableContext.tableNumber}</span>
            {tableContext.isOutdoor && <span className={styles.badge}>🌤️ {t('outdoor', 'Outdoor')}</span>}
          </div>

          <button
            onClick={() => setIsConfirmOpen(true)}
            className={styles.clearButton}
            aria-label={t('clear_table_selection', 'Clear table selection')}
            title={t('clear_table_selection', 'Clear table selection')}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Was a `window.confirm` with a hardcoded English string — untranslatable, and it blocks
          the main thread. */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmClear}
        message={t(
          'clear_table_selection_confirm',
          'Clear table selection? You will need to scan the QR code again, and your dine-in choice will be reset.',
        )}
      />
    </>
  );
}
