'use client';

import React, { useState } from 'react';
import { X, QrCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTableContext } from '@/contexts/TableContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { OrderType } from '@/types/order';
import BaseModal from '@/components/design-system/BaseModal';
import { STICKY_BANNER_ATTR } from '@/hooks/menu/useStickyNavOffset';
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
        // Only the sticky variant participates in the menu page's offset arithmetic; the floating
        // one is out of flow and the category nav never has to clear it.
        {...(position === 'top' ? { [STICKY_BANNER_ATTR]: '' } : {})}
        role="status"
        aria-live="polite"
      >
        <div className={styles.content}>
          <div className={styles.icon}>
            <QrCode size={20} />
          </div>

          <div className={styles.info}>
            {/* ONE interpolated sentence. It used to render the label and the number as two
                separate spans while the translated value carries a `{{number}}` placeholder that
                `t()` was never given values for — so a guest who scanned a QR read the literal
                "Ordering for Table {{number}} 7".

                Interpolating rather than stripping the placeholder from the ten locale files:
                `tr` ("Masa {{number}} için Sipariş") and `zh` ("为桌号 {{number}} 下单") put it
                mid-sentence, so removing the token would mangle the grammar in exactly the
                languages CLAUDE.md §9 says not to rewrite. This fixes all ten with no translation
                edits at all — it is the interpolation the strings were written for. */}
            <span className={styles.label}>{t('ordering_for_table', { number: tableContext.tableNumber })}</span>
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
          the main thread. `BaseModal` rather than the existing `ConfirmationModal` because that
          one is a raw overlay with no focus trap, no ESC and no dialog role, and every one of its
          callsites today is behind /admin — this is a customer-facing surface (frontend rule 2). */}
      <BaseModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title={t('clear_table_selection', 'Clear table selection')}
        size="sm"
        footer={
          <>
            <button type="button" className={styles.confirmCancel} onClick={() => setIsConfirmOpen(false)}>
              {t('cancel', 'Cancel')}
            </button>
            <button type="button" className={styles.confirmAccept} onClick={handleConfirmClear}>
              {t('confirm', 'Confirm')}
            </button>
          </>
        }
      >
        <p>
          {t(
            'clear_table_selection_confirm',
            'Clear table selection? You will need to scan the QR code again, and your dine-in choice will be reset.',
          )}
        </p>
      </BaseModal>
    </>
  );
}
