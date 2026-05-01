'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAuth } from '@/components/AuthContext';
import { OrderDto } from '@/types/order';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import OrderAnalytics from '@/components/admin/OrderAnalytics';
import AdvancedOrderAnalytics from '@/components/admin/AdvancedOrderAnalytics';
import { OrdersTable } from '@/components/admin/orders/OrdersTable';
import { OrdersFilters } from '@/components/admin/orders/OrdersFilters';
import { BulkActionsBar } from '@/components/admin/orders/BulkActionsBar';
import { OrdersPagination } from '@/components/admin/orders/OrdersPagination';
import AdminOrdersModals from '@/components/admin/orders/AdminOrdersModals';
import { useAdminOrdersData } from '@/hooks/admin/useAdminOrdersData';
import { useAdminOrderMutations } from '@/hooks/admin/useAdminOrderMutations';
import { useAdminOrdersBulkSelection } from '@/hooks/admin/useAdminOrdersBulkSelection';
import { useAdminOrdersKeyboardShortcuts } from '@/hooks/admin/useAdminOrdersKeyboardShortcuts';
import { ClipboardList, RefreshCw, Loader2, AlertCircle, RotateCcw, Keyboard } from 'lucide-react';
import styles from '../../styles/AdminOrdersPage.module.css';

const SNACKBAR_BOTTOM_RIGHT = { vertical: 'bottom', horizontal: 'right' } as const;

export default function AdminOrdersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const data = useAdminOrdersData({ isReady: Boolean(user) && !authLoading });
  const bulk = useAdminOrdersBulkSelection(data.orders, data.paginatedOrders);
  const mutations = useAdminOrderMutations({
    refetch: data.fetchOrders,
    selectedOrders: bulk.selectedOrders,
    clearSelection: bulk.clearSelection,
  });

  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [showKeyboardShortcutsModal, setShowKeyboardShortcutsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auth gate — page handles redirect; data hook waits on `isReady`.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/');
      return;
    }
    if (user.role !== 'Admin' && user.role !== 'Staff') {
      router.push('/');
      enqueueSnackbar(t('access_denied', 'Access denied. Admin privileges required.'), {
        variant: 'error',
        anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
      });
    }
  }, [user, authLoading, router, enqueueSnackbar, t]);

  const keyboardShortcuts = useAdminOrdersKeyboardShortcuts({
    searchInputRef,
    refresh: data.fetchOrders,
    closeAllModals: () => {
      setShowStatusModal(false);
      setShowFocusModal(false);
      setShowBulkStatusModal(false);
      setShowKeyboardShortcutsModal(false);
      setShowDeleteModal(false);
    },
    openShortcutsModal: () => setShowKeyboardShortcutsModal(true),
    disabled: showDetailsModal || showStatusModal || showFocusModal || showBulkStatusModal,
  });

  if (data.isLoading) {
    return (
      <main className={styles.container}>
        <div className={styles.loadingState}>
          <Loader2 size={64} className={styles.spinner} />
          <p suppressHydrationWarning>{t('loading_orders', 'Loading orders...')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <h1 className={styles.title}>
              <ClipboardList size={32} />
              {t('admin_orders_management', 'Orders Management')}
            </h1>
            <p className={styles.subtitle}>{t('admin_orders_desc', 'View and manage all restaurant orders')}</p>
          </div>
          <div className={styles.headerButtons}>
            <button
              onClick={() => setShowKeyboardShortcutsModal(true)}
              className={styles.keyboardButton}
              title={t('keyboard_shortcuts', 'Keyboard Shortcuts (Press ?)')}
            >
              <Keyboard size={20} />
            </button>
            <button onClick={data.fetchOrders} className={styles.refreshButton} title={t('refresh', 'Refresh')}>
              <RefreshCw size={20} />
              {t('refresh', 'Refresh')}
            </button>
          </div>
        </div>

        <OrdersFilters
          searchQuery={data.filters.searchQuery}
          onSearchChange={data.setSearchQuery}
          selectedStatus={data.filters.selectedStatus}
          onStatusChange={data.setSelectedStatus}
          selectedPaymentStatus={data.filters.selectedPaymentStatus}
          onPaymentStatusChange={data.setSelectedPaymentStatus}
          selectedOrderType={data.filters.selectedOrderType}
          onOrderTypeChange={data.setSelectedOrderType}
          showFocusOnly={data.filters.showFocusOnly}
          onShowFocusOnlyChange={data.setShowFocusOnly}
          totalOrders={data.orders.length}
          displayedOrders={data.paginatedOrders.length}
          searchInputRef={searchInputRef}
        />

        <DateRangeFilter onDateRangeChange={data.handleDateRangeChange} />

        {data.hasActiveFilters && (
          <div className={styles.clearFiltersSection}>
            <button onClick={data.handleClearFilters} className={styles.clearFiltersButton}>
              <RotateCcw size={16} />
              {t('clear_all_filters', 'Clear All Filters')}
            </button>
          </div>
        )}

        <OrderAnalytics orders={data.orders} />
        <AdvancedOrderAnalytics orders={data.orders} />

        <div className={styles.sortControls}>
          <label className={styles.sortLabel}>{t('sort_by', 'Sort by')}:</label>
          <select
            value={`${data.filters.sortBy}-${data.filters.sortOrder}`}
            onChange={(e) => {
              const [s, o] = e.target.value.split('-') as ['date' | 'amount', 'asc' | 'desc'];
              data.handleSortChange(s, o);
            }}
            className={styles.sortDropdown}
          >
            <option value="date-desc">{t('sort_newest_first', 'Newest First')}</option>
            <option value="date-asc">{t('sort_oldest_first', 'Oldest First')}</option>
            <option value="amount-desc">{t('sort_highest_amount', 'Highest Amount')}</option>
            <option value="amount-asc">{t('sort_lowest_amount', 'Lowest Amount')}</option>
          </select>
        </div>

        {bulk.selectedOrderIds.size > 0 && (
          <BulkActionsBar
            selectedCount={bulk.selectedOrderIds.size}
            onExportCSV={bulk.handleBulkExportCSV}
            onExportPDF={bulk.handleBulkExportPDF}
            onUpdateStatus={() => setShowBulkStatusModal(true)}
            onClearSelection={bulk.clearSelection}
          />
        )}

        {data.error && (
          <div className={styles.errorAlert}>
            <AlertCircle size={20} />
            <p>{data.error}</p>
          </div>
        )}

        {data.orders.length === 0 ? (
          <div className={styles.emptyState}>
            <ClipboardList size={64} className={styles.emptyIcon} />
            <h2>{t('no_orders_found', 'No Orders Found')}</h2>
            <p>{t('no_orders_match_filters', 'No orders match your current filters')}</p>
          </div>
        ) : (
          <>
            <OrdersTable
              orders={data.paginatedOrders}
              selectedOrderIds={bulk.selectedOrderIds}
              onToggleSelection={bulk.toggleOrderSelection}
              onToggleSelectAll={bulk.toggleSelectAll}
              onViewDetails={(o) => {
                setSelectedOrder(o);
                setShowDetailsModal(true);
              }}
              onUpdateStatus={(o) => {
                setSelectedOrder(o);
                setShowStatusModal(true);
              }}
              onToggleFocus={(o) => {
                setSelectedOrder(o);
                setShowFocusModal(true);
              }}
              onDeleteOrder={(o) => {
                setSelectedOrder(o);
                setShowDeleteModal(true);
              }}
            />
            <OrdersPagination
              currentPage={data.currentPage}
              totalPages={data.totalPages}
              onPageChange={data.setCurrentPage}
            />
          </>
        )}

        <AdminOrdersModals
          selectedOrder={selectedOrder}
          setSelectedOrder={setSelectedOrder}
          setOrders={data.setOrders}
          showStatusModal={showStatusModal}
          showFocusModal={showFocusModal}
          showDetailsModal={showDetailsModal}
          showBulkStatusModal={showBulkStatusModal}
          showKeyboardShortcutsModal={showKeyboardShortcutsModal}
          showDeleteModal={showDeleteModal}
          setShowStatusModal={setShowStatusModal}
          setShowFocusModal={setShowFocusModal}
          setShowDetailsModal={setShowDetailsModal}
          setShowBulkStatusModal={setShowBulkStatusModal}
          setShowKeyboardShortcutsModal={setShowKeyboardShortcutsModal}
          setShowDeleteModal={setShowDeleteModal}
          selectedCount={bulk.selectedOrderIds.size}
          bulkUpdateProgress={mutations.bulkUpdateProgress}
          isUpdatingBulkStatus={mutations.isUpdatingBulkStatus}
          keyboardShortcuts={keyboardShortcuts}
          onConfirmStatus={async (order, status, notes) => {
            await mutations.handleUpdateStatus(order, status, notes);
            setShowStatusModal(false);
            setSelectedOrder(null);
          }}
          onConfirmFocus={async (order, isFocus, priority, reason) => {
            await mutations.handleToggleFocus(order, isFocus, priority, reason);
            setShowFocusModal(false);
            setSelectedOrder(null);
          }}
          onConfirmDelete={async (order) => {
            await mutations.handleDeleteOrder(order);
            setShowDeleteModal(false);
            setSelectedOrder(null);
          }}
          onConfirmBulkStatus={async (status, notes) => {
            await mutations.handleBulkStatusUpdate(status, notes);
            setShowBulkStatusModal(false);
          }}
          onOrderUpdatedFromDetails={(updated) => {
            data.setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            setShowDetailsModal(false);
            setSelectedOrder(null);
            enqueueSnackbar('Order updated successfully', { variant: 'success', anchorOrigin: SNACKBAR_BOTTOM_RIGHT });
          }}
        />
      </div>
    </main>
  );
}
