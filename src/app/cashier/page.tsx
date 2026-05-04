'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCashierOrders } from '@/hooks/useCashierOrders';
import { useNotification } from '@/hooks/useNotification';
import { useCashierFilters } from '@/hooks/cashier/useCashierFilters';
import { useCashierDialogs } from '@/hooks/cashier/useCashierDialogs';
import { useCashierAutoPrint } from '@/hooks/cashier/useCashierAutoPrint';
import { useCashierOrderAlerts } from '@/hooks/cashier/useCashierOrderAlerts';
import { useTodayOnlyDateRange } from '@/hooks/cashier/useTodayOnlyDateRange';
import CashierHeader from '@/components/cashier/CashierHeader';
import OrderTypeNav from '@/components/cashier/OrderTypeNav';
import CashierMainContent from '@/components/cashier/CashierMainContent';
import CashierActionDialogs from '@/components/cashier/CashierActionDialogs';
import CashierAuxiliaryDialogs from '@/components/cashier/CashierAuxiliaryDialogs';
import QuickConfirmModal from '@/components/cashier/QuickConfirmModal';
import NotificationCenter from '@/components/cashier/NotificationCenter';
import styles from '@/app/styles/CashierPage.module.css';

export default function CashierPage() {
  const { t } = useTranslation();

  const { todayOnly, setTodayOnly, dateRange } = useTodayOnlyDateRange();

  const {
    orders,
    isConnected,
    isLoading,
    error,
    lastEventTime,
    connectionState,
    refreshOrders,
    updateOrderStatus,
    addPayment,
    refundPayment,
    cancelOrder,
    toggleFocusOrder,
  } = useCashierOrders(dateRange);

  const notif = useNotification();

  const { settings: autoPrintSettings, saveSettings: saveAutoPrintSettings } = useCashierAutoPrint();

  const dialogs = useCashierDialogs(orders, {
    updateOrderStatus,
    addPayment,
    refundPayment,
    cancelOrder,
    toggleFocusOrder,
    refreshOrders,
  });

  const filters = useCashierFilters(orders, dialogs.selectedOrderId, dialogs.setSelectedOrderId);

  const alerts = useCashierOrderAlerts({
    orders,
    autoPrintSettings,
    audioEnabled: notif.audioEnabled,
    notifyNewOrder: notif.notifyNewOrder,
    notifyOrderUpdate: notif.notifyOrderUpdate,
    playOrderUpdateSound: notif.playOrderUpdateSound,
  });

  const [showAutoPrintSettings, setShowAutoPrintSettings] = useState(false);
  const [showQRScannerDialog, setShowQRScannerDialog] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showZReport, setShowZReport] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshOrders();
      dialogs.showSuccess(t('cashier.orders_refreshed') || 'Orders refreshed');
    } catch {
      dialogs.showError(t('cashier.refresh_failed') || 'Failed to refresh orders');
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshOrders, dialogs, t]);

  return (
    <div className={styles.pageWrapper}>
      <NotificationCenter notifications={notif.notifications} onDismiss={notif.removeNotification} />

      <CashierHeader
        isConnected={isConnected}
        isRefreshing={isRefreshing}
        audioEnabled={notif.audioEnabled}
        audioBlockedByPolicy={notif.audioBlockedByPolicy}
        soundType={notif.soundType}
        repeatUntilMouseMoves={notif.repeatUntilMouseMoves}
        onRefresh={handleRefresh}
        onToggleAudio={notif.toggleAudio}
        onSoundTypeChange={notif.changeSoundType}
        onTestSound={notif.playSoundByType}
        onToggleRepeat={notif.toggleRepeatSound}
        onOpenQRScanner={() => setShowQRScannerDialog(true)}
        onOpenZReport={() => setShowZReport(true)}
        onOpenDiagnostics={() => setShowDiagnostics(!showDiagnostics)}
      />

      {dialogs.successMessage && <div className="alert alert-success">{dialogs.successMessage}</div>}
      {dialogs.errorMessage && <div className="alert alert-error">{dialogs.errorMessage}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <OrderTypeNav activeFilter={filters.orderTypeFilter} onFilterChange={filters.setOrderTypeFilter} />

      <div className={styles.dateRangeToolbar}>
        <label>
          <input type="checkbox" checked={todayOnly} onChange={(e) => setTodayOnly(e.target.checked)} />{' '}
          {t('cashier.show_todays_orders_only')}
        </label>
      </div>

      <CashierMainContent
        filteredOrders={filters.filteredOrders}
        selectedOrder={dialogs.selectedOrder}
        selectedOrderId={dialogs.selectedOrderId}
        isLoading={isLoading}
        error={error}
        searchQuery={filters.searchQuery}
        statusFilter={filters.statusFilter}
        paymentStatusFilter={filters.paymentStatusFilter}
        orderTypeFilter={filters.orderTypeFilter}
        onSelectOrder={dialogs.setSelectedOrderId}
        onStatusChange={dialogs.handleStatusChange}
        onAddPayment={() => dialogs.setShowPaymentDialog(true)}
        onRefund={() => dialogs.setShowRefundDialog(true)}
        onCancel={() => dialogs.setShowCancelDialog(true)}
        onToggleFocus={() => dialogs.setShowFocusDialog(true)}
        onQuickConfirm={alerts.openQuickConfirmModal}
        onSearchChange={filters.setSearchQuery}
        onStatusFilterChange={filters.setStatusFilter}
        onPaymentStatusFilterChange={filters.setPaymentStatusFilter}
        onOrderTypeFilterChange={filters.setOrderTypeFilter}
      />

      <CashierActionDialogs
        selectedOrder={dialogs.selectedOrder}
        showStatusDialog={dialogs.showStatusDialog}
        showPaymentDialog={dialogs.showPaymentDialog}
        showRefundDialog={dialogs.showRefundDialog}
        showCancelDialog={dialogs.showCancelDialog}
        showFocusDialog={dialogs.showFocusDialog}
        onCloseStatus={() => dialogs.setShowStatusDialog(false)}
        onClosePayment={() => dialogs.setShowPaymentDialog(false)}
        onCloseRefund={() => dialogs.setShowRefundDialog(false)}
        onCloseCancel={() => dialogs.setShowCancelDialog(false)}
        onCloseFocus={() => dialogs.setShowFocusDialog(false)}
        onConfirmStatus={dialogs.handleStatusChange}
        onConfirmPayment={dialogs.handleAddPayment}
        onConfirmRefund={dialogs.handleRefund}
        onConfirmCancel={dialogs.handleCancelOrder}
        onConfirmFocus={dialogs.handleToggleFocus}
      />

      <QuickConfirmModal
        order={
          alerts.pendingOrderForConfirm ? orders.find((o) => o.id === alerts.pendingOrderForConfirm) || null : null
        }
        isOpen={alerts.showQuickConfirmModal}
        onClose={alerts.closeQuickConfirmModal}
        onConfirm={dialogs.handleQuickConfirm}
        onCancel={dialogs.handleQuickCancel}
      />

      <CashierAuxiliaryDialogs
        showQRScanner={showQRScannerDialog}
        showAutoPrint={showAutoPrintSettings}
        showZReport={showZReport}
        showDiagnostics={showDiagnostics}
        autoPrintSettings={autoPrintSettings}
        diagnostics={{
          sseConnected: isConnected,
          sseConnectionState: connectionState,
          sseLastEventTime: lastEventTime,
          sseError: error,
          audioEnabled: notif.audioEnabled,
          audioReady: notif.audioReady,
          audioBlockedByPolicy: notif.audioBlockedByPolicy,
        }}
        onCloseQRScanner={() => setShowQRScannerDialog(false)}
        onCloseAutoPrint={() => setShowAutoPrintSettings(false)}
        onCloseZReport={() => setShowZReport(false)}
        onCloseDiagnostics={() => setShowDiagnostics(false)}
        onApplyDiscount={() => dialogs.showSuccess(t('cashier.discount_info_loaded') || 'Discount information loaded')}
        onSaveAutoPrint={saveAutoPrintSettings}
        onTestSound={() => notif.playSoundByType(notif.soundType)}
        onEnableAudio={notif.resumeAudioContext}
        onRefreshConnection={handleRefresh}
      />
    </div>
  );
}
