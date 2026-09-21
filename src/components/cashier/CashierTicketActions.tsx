'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { BellRing, Printer, ChefHat, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OrderType } from '@/types/order';
import type { OrderDto } from '@/types/order';
import { approveOrder, rejectOrder, toggleFocusOrder } from '@/services/cashierService';
import { flowLookup, useConfirmationFlowConfig } from '@/hooks/orderTypes/useConfirmationFlowConfig';
import { exportKitchenItemsToPDF, exportOrderToPDF } from '@/utils/pdfExportUtils';
import { getErrorMessage } from '@/utils/apiClient';
import FocusOrderDialog from './FocusOrderDialog';
import OrderDetailsNotesSection from './order-details/OrderDetailsNotesSection';
import styles from './CashierTicketActions.module.css';

// Approval/rejection is opened on demand. Its Zod schemas and modal UI do not belong in the
// cashier route's initial bundle while the operator is only reading the queue.
const CashierConfirmModal = dynamic(() => import('./CashierConfirmModal'), { ssr: false });

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
  const { flowByType } = useConfirmationFlowConfig();
  const flowForOrder = flowLookup(flowByType);
  const [notesOpen, setNotesOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  // The pending hand-off gate (order confirmation flows): a pending takeaway/delivery order is
  // waiting on THIS cashier — approve/confirm is the one emphasized action (plan §5.2), ahead of
  // print/notes. Dine-in auto-confirms at creation and never reaches this branch.
  const confirmationFlow = flowForOrder(order.type)?.flow ?? 'direct';
  const isPendingHandoff =
    (order.status === 'Pending' || (order.status === 'PendingApproval' && confirmationFlow === 'acknowledge')) &&
    (order.type === OrderType.Takeaway || order.type === OrderType.Delivery);

  return (
    <section className={styles.actions} aria-label={t('cashier.workspace.actions_label')}>
      <div className={styles.row}>
        {isPendingHandoff && (
          <button
            type="button"
            className={`${styles.actionButton} ${styles.primaryAction}`}
            onClick={() => setConfirmOpen(true)}
          >
            <CheckCircle size={17} aria-hidden="true" />
            {t(confirmationFlow === 'acknowledge' ? 'cashier.approve_order_action' : 'cashier.confirm_order_action')}
          </button>
        )}
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
      {confirmOpen && (
        <CashierConfirmModal
          order={order}
          isOpen
          onClose={() => setConfirmOpen(false)}
          onConfirm={async (orderId, preparationMinutes) => {
            await approveOrder(orderId, preparationMinutes);
            onOrderChanged?.();
          }}
          onReject={async (orderId, reason) => {
            await rejectOrder(orderId, reason);
            onOrderChanged?.();
          }}
          confirmationFlow={confirmationFlow}
        />
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
