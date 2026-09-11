'use client';

import dynamic from 'next/dynamic';
import StatusUpdateDialog from './StatusUpdateDialog';
import RefundDialog from './RefundDialog';
import CancelOrderDialog from './CancelOrderDialog';
import FocusOrderDialog from './FocusOrderDialog';
import { OrderDto } from '@/types/order';
import { AddPaymentRequest } from '@/services/cashierService';

const PaymentModal = dynamic(() => import('./PaymentModal'), { ssr: false });

interface CashierActionDialogsProps {
  selectedOrder: OrderDto | null;
  showStatusDialog: boolean;
  showPaymentModal: boolean;
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
  /** A mutation is in flight; dialogs that carry a form lock their submit control. */
  isMutating?: boolean;
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
      <PaymentModal
        order={props.selectedOrder}
        isOpen={props.showPaymentModal}
        onClose={props.onClosePayment}
        onConfirm={props.onConfirmPayment}
        isLoading={props.isMutating}
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
