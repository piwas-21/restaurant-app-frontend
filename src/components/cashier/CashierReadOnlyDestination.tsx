'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CashierQueueState } from '@/types/cashier';
import type { OrderDto } from '@/types/order';
import CashierWorkspaceShell from './CashierWorkspaceShell';
import CashierReadOnlyQueuePanel from './CashierReadOnlyQueuePanel';
import CashierReadOnlyTicket from './CashierReadOnlyTicket';
import styles from './CashierWorkspaceView.module.css';

interface Pagination {
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

interface CashierReadOnlyDestinationProps {
  readonly destination: 'orders' | 'history';
  readonly description: string;
  readonly timeZone?: string;
  readonly orders: readonly OrderDto[];
  readonly pagination: Pagination;
  readonly queueState: CashierQueueState;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly isConnected?: boolean;
  readonly selectedOrderId: string | null;
  readonly selectedOrder: OrderDto | null;
  readonly selectedOrderLoading: boolean;
  readonly selectedOrderError: string | null;
  readonly searchQuery: string;
  readonly statusFilter: string;
  readonly paymentStatusFilter: string;
  readonly orderTypeFilter: string;
  readonly additionalFilters?: ReactNode;
  readonly onSelectOrder: (orderId: string) => void;
  readonly onCollect?: (orderId: string) => void;
  readonly onOrderChanged?: () => void;
  readonly onBack: () => void;
  readonly onSearchChange: (value: string) => void;
  readonly onSearchSubmit: () => void;
  readonly onStatusFilterChange: (value: string) => void;
  readonly onPaymentStatusFilterChange: (value: string) => void;
  readonly onOrderTypeFilterChange: (value: string) => void;
  readonly onPageChange: (page: number) => void;
  readonly onRetry?: () => void;
}

export default function CashierReadOnlyDestination({
  destination,
  description,
  timeZone,
  orders,
  pagination,
  queueState,
  isLoading,
  error,
  isConnected,
  selectedOrderId,
  selectedOrder,
  selectedOrderLoading,
  selectedOrderError,
  searchQuery,
  statusFilter,
  paymentStatusFilter,
  orderTypeFilter,
  additionalFilters,
  onSelectOrder,
  onCollect,
  onOrderChanged,
  onBack,
  onSearchChange,
  onSearchSubmit,
  onStatusFilterChange,
  onPaymentStatusFilterChange,
  onOrderTypeFilterChange,
  onPageChange,
  onRetry,
}: CashierReadOnlyDestinationProps) {
  const { t } = useTranslation();
  const hasSelection = Boolean(selectedOrderId);
  const [isMobile, setIsMobile] = useState(false);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const ticketHeadingRef = useRef<HTMLHeadingElement>(null);
  const ticketStateRef = useRef<HTMLDivElement>(null);
  const orderRowsRef = useRef(new Map<string, HTMLButtonElement>());
  const lastSelectedOrderRef = useRef<string | null>(null);
  const focusedMobileOrderRef = useRef<string | null>(null);
  const pendingDetailFocusRef = useRef(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  const setOrderRowRef = useCallback((orderId: string, node: HTMLButtonElement | null) => {
    const key = orderId.toLowerCase();
    if (node) orderRowsRef.current.set(key, node);
    else orderRowsRef.current.delete(key);
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      const key = selectedOrderId.toLowerCase();
      lastSelectedOrderRef.current = key;
      if (isMobile && focusedMobileOrderRef.current !== key) {
        focusedMobileOrderRef.current = key;
        pendingDetailFocusRef.current = true;
      }
      return;
    }

    const previous = lastSelectedOrderRef.current;
    lastSelectedOrderRef.current = null;
    focusedMobileOrderRef.current = null;
    pendingDetailFocusRef.current = false;
    if (isMobile && previous) {
      window.setTimeout(() => orderRowsRef.current.get(previous)?.focus(), 0);
    }
  }, [isMobile, selectedOrderId]);

  useEffect(() => {
    if (!isMobile || !selectedOrderId || !pendingDetailFocusRef.current) return;
    const target = backButtonRef.current ?? ticketHeadingRef.current ?? ticketStateRef.current;
    if (target) {
      target.focus();
      pendingDetailFocusRef.current = false;
    }
  }, [isMobile, selectedOrderId, selectedOrder, selectedOrderLoading, selectedOrderError]);

  return (
    <CashierWorkspaceShell activeDestination={destination} queueState={queueState} isConnected={isConnected}>
      <section className={styles.destination} aria-labelledby={`${destination}-title`}>
        <header className={styles.destinationHeader}>
          <div>
            <h1 id={`${destination}-title`} className={styles.destinationTitle}>
              {t(`cashier.workspace.${destination}`)}
            </h1>
            <p className={styles.destinationDescription}>{description}</p>
          </div>
          <button type="button" className={styles.refreshButton} onClick={onRetry} disabled={!onRetry || isLoading}>
            <RefreshCw aria-hidden="true" size={17} />
            {t('cashier.workspace.refresh')}
          </button>
        </header>
        <div
          className={`${styles.workspaceGrid} ${destination === 'orders' ? styles.ordersGrid : ''} ${hasSelection ? styles.hasSelection : ''}`}
        >
          <CashierReadOnlyQueuePanel
            destination={destination}
            orders={orders}
            pagination={pagination}
            queueState={queueState}
            isLoading={isLoading}
            error={error}
            selectedOrderId={selectedOrderId}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            paymentStatusFilter={paymentStatusFilter}
            orderTypeFilter={orderTypeFilter}
            timeZone={timeZone}
            additionalFilters={additionalFilters}
            onSelectOrder={onSelectOrder}
            onOrderRowRef={setOrderRowRef}
            onSearchChange={onSearchChange}
            onSearchSubmit={onSearchSubmit}
            onStatusFilterChange={onStatusFilterChange}
            onPaymentStatusFilterChange={onPaymentStatusFilterChange}
            onOrderTypeFilterChange={onOrderTypeFilterChange}
            onPageChange={onPageChange}
            onRetry={onRetry}
          />
          <section className={styles.ticketPane} aria-label={t('cashier.workspace.order_details')}>
            <CashierReadOnlyTicket
              order={selectedOrder}
              isLoading={selectedOrderLoading}
              error={selectedOrderError}
              timeZone={timeZone}
              onBack={hasSelection ? onBack : undefined}
              onCollect={onCollect}
              onOrderChanged={onOrderChanged}
              backButtonRef={backButtonRef}
              headingRef={ticketHeadingRef}
              stateRef={ticketStateRef}
            />
          </section>
        </div>
      </section>
    </CashierWorkspaceShell>
  );
}
