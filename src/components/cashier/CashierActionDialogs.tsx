'use client';

import StatusUpdateDialog from './StatusUpdateDialog';
import PaymentDialog from './PaymentDialog';
import RefundDialog from './RefundDialog';
import CancelOrderDialog from './CancelOrderDialog';
import FocusOrderDialog from './FocusOrderDialog';
import { OrderDto } from '@/types/order';
import { AddPaymentRequest } from '@/services/cashierService';

interface CashierActionDialogsProps {
  selectedOrder: OrderDto | null;
  showStatusDialog: boolean;
  showPaymentDialog: boolean;
  showRefundDialog: boolean;
  showCancelDialog: boolean;
  showFocusDialog: boolean;
  onCloseStatus: () => void;
  onClosePayment: () => void;
  onCloseRefund: () => void;
  onCloseCancel: () => void;
  onCloseFocus: () => void;
  onConfirmStatus: (newStatus: string) => Promise<void>;
  onConfirmPayment: (paymentData: AddPaymentRequest) => Promise<void>;
  onConfirmRefund: (paymentId: string, amount?: number) => Promise<void>;
  onConfirmCancel: (reason?: string) => Promise<void>;
  onConfirmFocus: (isFocus: boolean, priority?: number, reason?: string) => Promise<void>;
}

/**
 * Renders the five mutation dialogs for the cashier page. Pure JSX wiring
 * — extracted so `cashier/page.tsx` stays under the page-level LOC limit.
 */
export default function CashierActionDialogs(props: CashierActionDialogsProps) {
  return (
    <>
      <StatusUpdateDialog
        order={props.selectedOrder}
        isOpen={props.showStatusDialog}
        onClose={props.onCloseStatus}
        onConfirm={props.onConfirmStatus}
      />
      <PaymentDialog
        order={props.selectedOrder}
        isOpen={props.showPaymentDialog}
        onClose={props.onClosePayment}
        onConfirm={props.onConfirmPayment}
      />
      <RefundDialog
        order={props.selectedOrder}
        isOpen={props.showRefundDialog}
        onClose={props.onCloseRefund}
        onConfirm={props.onConfirmRefund}
      />
      <CancelOrderDialog
        order={props.selectedOrder}
        isOpen={props.showCancelDialog}
        onClose={props.onCloseCancel}
        onConfirm={props.onConfirmCancel}
      />
      <FocusOrderDialog
        order={props.selectedOrder}
        isOpen={props.showFocusDialog}
        onClose={props.onCloseFocus}
        onConfirm={props.onConfirmFocus}
      />
    </>
  );
}
