'use client';

import { useState } from 'react';
import { BellRing, Printer, ChefHat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OrderDto } from '@/types/order';
import { toggleFocusOrder } from '@/services/cashierService';
import { exportKitchenItemsToPDF, exportOrderToPDF } from '@/utils/pdfExportUtils';
import { getErrorMessage } from '@/utils/apiClient';
import FocusOrderDialog from './FocusOrderDialog';
import OrderDetailsNotesSection from './order-details/OrderDetailsNotesSection';
import styles from './CashierTicketActions.module.css';

interface CashierTicketActionsProps {
  readonly order: OrderDto;
  /** Notifies the host that the order changed (focus flip), so it can refresh its data. */
  readonly onOrderChanged?: () => void;
}

/**
 * The ticket's frequent secondary actions (POS plan §5.2): print kitchen, print bill, add
 * note, mark urgent (focus). Pilot feedback: the workspace destinations shipped without any
 * of them. Print opens the browser dialog and says so honestly — it cannot prove paper.
 */
export default function CashierTicketActions({ order, onOrderChanged }: CashierTicketActionsProps) {
  const { t } = useTranslation();
  const [notesOpen, setNotesOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusBusy, setFocusBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const printBill = () => exportOrderToPDF(order, (key, fallback) => t(key, { defaultValue: fallback }));
  const printKitchen = () =>
    exportKitchenItemsToPDF(order, 'GeneralKitchen', (key, fallback) => t(key, { defaultValue: fallback }));

  const confirmFocus = async (isFocus: boolean, priority?: number, reason?: string) => {
    setFocusBusy(true);
    setActionError(null);
    try {
      await toggleFocusOrder(order.id, isFocus, priority, reason);
      setFocusOpen(false);
      onOrderChanged?.();
    } catch (error) {
      setActionError(getErrorMessage(error) ?? t('cashier.workspace.focus_failed'));
    } finally {
      setFocusBusy(false);
    }
  };

  return (
    <section className={styles.actions} aria-label={t('cashier.workspace.actions_label')}>
      <div className={styles.row}>
        <button type="button" className={styles.actionButton} onClick={printKitchen}>
          <ChefHat size={17} aria-hidden="true" />
          {t('cashier.workspace.print_kitchen')}
        </button>
        <button type="button" className={styles.actionButton} onClick={printBill}>
          <Printer size={17} aria-hidden="true" />
          {t('cashier.workspace.print_bill')}
        </button>
        <button
          type="button"
          className={styles.actionButton}
          aria-expanded={notesOpen}
          onClick={() => setNotesOpen((current) => !current)}
        >
          <BellRing size={17} aria-hidden="true" />
          {t('cashier.workspace.add_note')}
        </button>
        <button
          type="button"
          className={`${styles.actionButton} ${order.isFocusOrder ? styles.actionButtonActive : ''}`}
          onClick={() => setFocusOpen(true)}
        >
          {order.isFocusOrder ? '★' : '☆'}
          {order.isFocusOrder ? t('remove_focus', 'Unfocus') : t('cashier.mark_as_focus', 'Focus')}
        </button>
      </div>
      {actionError && (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      )}
      {notesOpen && (
        <OrderDetailsNotesSection order={order} notesExpanded={notesOpen} setNotesExpanded={setNotesOpen} />
      )}
      <FocusOrderDialog
        order={order}
        isOpen={focusOpen}
        onClose={() => setFocusOpen(false)}
        onConfirm={confirmFocus}
        isLoading={focusBusy}
      />
    </section>
  );
}
