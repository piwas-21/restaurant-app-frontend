'use client';

import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto, OrderType } from '@/types/order';
import { AutoPrintSettings } from '@/types/cashier';
import { exportKitchenItemsToPDF, exportOrderToPDF } from '@/utils/pdfExportUtils';

// Any order arriving within this window after mount is silently marked
// "seen" — covers the initial REST→SSE handover, React Strict Mode's
// double-invoke, and SSE re-emissions of REST results.
const POPUP_GRACE_WINDOW_MS = 5000;
const FLASH_OVERLAY_DURATION_MS = 500;

export interface UseCashierOrderAlertsOptions {
  orders: OrderDto[];
  autoPrintSettings: AutoPrintSettings;
  audioEnabled: boolean;
  notifyNewOrder: (orderNumber: string, customerName: string) => void;
  notifyOrderUpdate: (orderNumber: string, status: string) => void;
  playOrderUpdateSound: () => void;
}

export interface UseCashierOrderAlertsReturn {
  pendingOrderForConfirm: string | null;
  showQuickConfirmModal: boolean;
  setShowQuickConfirmModal: Dispatch<SetStateAction<boolean>>;
  openQuickConfirmModal: (orderId: string) => void;
  closeQuickConfirmModal: () => void;
}

/**
 * Watches the orders list for new arrivals and status transitions, plays
 * sounds + visual flash for new orders, optionally fires auto-print, and
 * queues pending non-Dine-in orders for the quick-confirm modal.
 */
export function useCashierOrderAlerts({
  orders,
  autoPrintSettings,
  audioEnabled,
  notifyNewOrder,
  notifyOrderUpdate,
  playOrderUpdateSound,
}: UseCashierOrderAlertsOptions): UseCashierOrderAlertsReturn {
  const { t } = useTranslation();

  const [pendingOrderQueue, setPendingOrderQueue] = useState<string[]>([]);
  const [pendingOrderForConfirm, setPendingOrderForConfirm] = useState<string | null>(null);
  const [showQuickConfirmModal, setShowQuickConfirmModal] = useState(false);
  const [dismissedOrders, setDismissedOrders] = useState<Set<string>>(new Set());

  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const previousOrderStatusesRef = useRef<Map<string, string>>(new Map());
  const mountedAtRef = useRef<number>(Date.now());
  const isInitialLoadRef = useRef(true);

  // Detect new orders (with grace window) — sound, optional auto-print,
  // and queue for the quick-confirm modal.
  useEffect(() => {
    if (Date.now() - mountedAtRef.current < POPUP_GRACE_WINDOW_MS) {
      orders.forEach((order) => seenOrderIdsRef.current.add(order.id));
      isInitialLoadRef.current = false;
      return;
    }
    isInitialLoadRef.current = false;

    const newOrders = orders.filter((order) => !seenOrderIdsRef.current.has(order.id));
    if (newOrders.length === 0) return;

    const ordersForModal: string[] = [];
    newOrders.forEach((order) => {
      seenOrderIdsRef.current.add(order.id);
      notifyNewOrder(order.orderNumber || order.id, order.customerName || '');

      const isQuickConfirmCandidate =
        order.type !== OrderType.DineIn && order.status === 'Pending' && !dismissedOrders.has(order.id);
      if (isQuickConfirmCandidate) ordersForModal.push(order.id);

      if (autoPrintSettings.enabled) maybeAutoPrint(order, autoPrintSettings, t);
    });

    if (ordersForModal.length > 0) {
      // Defer to next tick to avoid React state batching with the queue setter below.
      setTimeout(() => setPendingOrderQueue((prev) => [...prev, ...ordersForModal]), 0);
    }

    // Visual fallback when audio is disabled.
    if (!audioEnabled && newOrders.length > 0) flashViewport();
  }, [orders, notifyNewOrder, audioEnabled, dismissedOrders, autoPrintSettings, t]);

  // Drive the modal off the queue.
  useEffect(() => {
    if (pendingOrderQueue.length === 0 || showQuickConfirmModal) return;
    setPendingOrderForConfirm(pendingOrderQueue[0]);
    setShowQuickConfirmModal(true);
    setPendingOrderQueue((prev) => prev.slice(1));
  }, [pendingOrderQueue, showQuickConfirmModal]);

  // Status-change notifications (skip the first render).
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    orders.forEach((order) => {
      const previousStatus = previousOrderStatusesRef.current.get(order.id);
      if (previousStatus && previousStatus !== order.status) {
        notifyOrderUpdate(order.orderNumber, order.status);
        playOrderUpdateSound();
      }
      previousOrderStatusesRef.current.set(order.id, order.status);
    });
  }, [orders, notifyOrderUpdate, playOrderUpdateSound]);

  const openQuickConfirmModal = useCallback((orderId: string) => {
    setPendingOrderForConfirm(orderId);
    setShowQuickConfirmModal(true);
  }, []);

  const closeQuickConfirmModal = useCallback(() => {
    if (pendingOrderForConfirm) {
      setDismissedOrders((prev) => new Set(prev).add(pendingOrderForConfirm));
    }
    setShowQuickConfirmModal(false);
    setPendingOrderForConfirm(null);
  }, [pendingOrderForConfirm]);

  return {
    pendingOrderForConfirm,
    showQuickConfirmModal,
    setShowQuickConfirmModal,
    openQuickConfirmModal,
    closeQuickConfirmModal,
  };
}

function maybeAutoPrint(order: OrderDto, settings: AutoPrintSettings, t: ReturnType<typeof useTranslation>['t']): void {
  const matchesType =
    (order.type === OrderType.DineIn && settings.orderTypes.dineIn) ||
    (order.type === OrderType.Takeaway && settings.orderTypes.takeaway) ||
    (order.type === OrderType.Delivery && settings.orderTypes.delivery);
  if (!matchesType) return;

  const orderStatus = (order.status?.toLowerCase() || 'pending') as keyof typeof settings.orderStatuses;
  if (!settings.orderStatuses[orderStatus]) return;

  if (settings.printContent.all) exportKitchenItemsToPDF(order, 'All', t);
  if (settings.printContent.frontKitchen) exportKitchenItemsToPDF(order, 'FrontKitchen', t);
  if (settings.printContent.backKitchen) exportKitchenItemsToPDF(order, 'BackKitchen', t);
  if (settings.printContent.bill) exportOrderToPDF(order, t);
}

function flashViewport(): void {
  const flashEl = document.createElement('div');
  flashEl.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(255, 152, 0, 0.3);
    pointer-events: none; z-index: 9999;
    animation: flash 0.5s ease-out;
  `;
  document.body.appendChild(flashEl);
  setTimeout(() => flashEl.remove(), FLASH_OVERLAY_DURATION_MS);
}
