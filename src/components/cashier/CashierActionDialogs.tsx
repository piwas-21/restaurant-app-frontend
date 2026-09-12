'use client';

import dynamic from 'next/dynamic';
import StatusUpdateDialog from './StatusUpdateDialog';

import CancelOrderDialog from './CancelOrderDialog';
import FocusOrderDialog from './FocusOrderDialog';
import { OrderDto } from '@/types/order';
import { AddPaymentRequest } from '@/services/cashierService';

const PaymentModal = dynamic(() => import('./PaymentModal'), { ssr: false });
const RefundModal = dynamic(() => import('./RefundModal'), { ssr: false });

interface CashierActionDialogsProps {
  selectedOrder: OrderDto | null;
  showStatusDialog: boolean;

  showPaymentModal: boolean;
  showRefundModal: boolean;

  showCancelDialog: boolean;
  showFocusDialog: boolean;
  onCloseStatus: () => void;
  onClosePayment: () => void;
  onCloseRefundModal: () => void;
  onCloseCancel: () => void;
  onCloseFocus: () => void;
  onConfirmStatus: (newStatus: string) => Promise<void>;
  onConfirmPayment: (paymentData: AddPaymentRequest) => Promise<void>;
  onConfirmRefund: (paymentId: string, amount: number, reason: string) => Promise<void>;
  onConfirmCancel: (reason?: string) => Promise<void>;
  onConfirmFocus: (isFocus: boolean, priority?: number, reason?: string) => Promise<void>;
  /** A mutation is in flight; dialogs that carry a form lock their submit control. */
  isMutating?: boolean;
  /** A lost payment response is being reconciled; show the checking state rather than a generic spinner. */
  isCheckingPayment?: boolean;
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
        isCheckingPayment={props.isCheckingPayment}
      />
      <RefundModal
        order={props.selectedOrder}
        isOpen={props.showRefundModal}
        onClose={props.onCloseRefundModal}
        onConfirm={props.onConfirmRefund}
        isLoading={props.isMutating}
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
