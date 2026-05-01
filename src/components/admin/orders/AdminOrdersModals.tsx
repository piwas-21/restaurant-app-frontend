'use client';

import { Dispatch, SetStateAction } from 'react';
import OrderDetailsModal from '@/components/admin/OrderDetailsModal';
import DeleteConfirmationModal from '@/components/admin/DeleteConfirmationModal';
import KeyboardShortcutsModal from '@/components/admin/KeyboardShortcutsModal';
import { StatusUpdateModal } from '@/components/admin/orders/StatusUpdateModal';
import { FocusOrderModal } from '@/components/admin/orders/FocusOrderModal';
import { BulkStatusUpdateModal } from '@/components/admin/orders/BulkStatusUpdateModal';
import { OrderDto, OrderStatus } from '@/types/order';
import { KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';

interface AdminOrdersModalsProps {
  selectedOrder: OrderDto | null;
  setSelectedOrder: Dispatch<SetStateAction<OrderDto | null>>;
  setOrders: Dispatch<SetStateAction<OrderDto[]>>;
  showStatusModal: boolean;
  showFocusModal: boolean;
  showDetailsModal: boolean;
  showBulkStatusModal: boolean;
  showKeyboardShortcutsModal: boolean;
  showDeleteModal: boolean;
  setShowStatusModal: Dispatch<SetStateAction<boolean>>;
  setShowFocusModal: Dispatch<SetStateAction<boolean>>;
  setShowDetailsModal: Dispatch<SetStateAction<boolean>>;
  setShowBulkStatusModal: Dispatch<SetStateAction<boolean>>;
  setShowKeyboardShortcutsModal: Dispatch<SetStateAction<boolean>>;
  setShowDeleteModal: Dispatch<SetStateAction<boolean>>;
  selectedCount: number;
  bulkUpdateProgress: { current: number; total: number };
  isUpdatingBulkStatus: boolean;
  keyboardShortcuts: KeyboardShortcut[];
  onConfirmStatus: (order: OrderDto, status: OrderStatus, notes: string) => Promise<void>;
  onConfirmFocus: (order: OrderDto, isFocus: boolean, priority?: number, reason?: string) => Promise<void>;
  onConfirmDelete: (order: OrderDto) => Promise<void>;
  onConfirmBulkStatus: (status: OrderStatus, notes: string) => Promise<void>;
  onOrderUpdatedFromDetails: (updated: OrderDto) => void;
}

/**
 * The six modals overlaying the admin orders page. Pure JSX wiring —
 * extracted so `orders-management/page.tsx` stays under the page LOC limit.
 */
export default function AdminOrdersModals(props: AdminOrdersModalsProps) {
  const closeWithReset = (close: () => void) => {
    close();
    props.setSelectedOrder(null);
  };

  return (
    <>
      {props.showStatusModal && props.selectedOrder && (
        <StatusUpdateModal
          order={props.selectedOrder}
          onClose={() => closeWithReset(() => props.setShowStatusModal(false))}
          onConfirm={(status, notes) => props.onConfirmStatus(props.selectedOrder!, status, notes)}
        />
      )}

      {props.showFocusModal && props.selectedOrder && (
        <FocusOrderModal
          order={props.selectedOrder}
          onClose={() => closeWithReset(() => props.setShowFocusModal(false))}
          onConfirm={(isFocus, priority, reason) =>
            props.onConfirmFocus(props.selectedOrder!, isFocus, priority, reason)
          }
        />
      )}

      {props.showDetailsModal && props.selectedOrder && (
        <OrderDetailsModal
          order={props.selectedOrder}
          onClose={() => closeWithReset(() => props.setShowDetailsModal(false))}
          onOrderUpdated={props.onOrderUpdatedFromDetails}
        />
      )}

      {props.showBulkStatusModal && (
        <BulkStatusUpdateModal
          selectedCount={props.selectedCount}
          onClose={() => props.setShowBulkStatusModal(false)}
          onConfirm={props.onConfirmBulkStatus}
          progress={props.bulkUpdateProgress}
          isUpdating={props.isUpdatingBulkStatus}
        />
      )}

      {props.showKeyboardShortcutsModal && (
        <KeyboardShortcutsModal
          shortcuts={props.keyboardShortcuts}
          onClose={() => props.setShowKeyboardShortcutsModal(false)}
        />
      )}

      {props.showDeleteModal && props.selectedOrder && (
        <DeleteConfirmationModal
          order={props.selectedOrder}
          onClose={() => closeWithReset(() => props.setShowDeleteModal(false))}
          onConfirm={() => props.onConfirmDelete(props.selectedOrder!)}
        />
      )}
    </>
  );
}
