'use client';

import { useTranslation } from 'react-i18next';
import { X, Star, FileText, Printer, Download, ChevronDown } from 'lucide-react';
import { OrderDto } from '@/types/order';
import { getStatusBadgeClasses, getFocusBadgeClass } from '@/utils/orderStatusStyles';
import styles from '../OrderDetailsModal.module.css';

interface OrderDetailsHeaderProps {
  order: OrderDto;
  showExportMenu: boolean;
  onToggleExportMenu: () => void;
  onPrint: () => void;
  onExport: () => void;
  onExportPDF: () => void;
  onClose: () => void;
}

/**
 * Header row of the OrderDetailsModal: title + order number / status / focus badges,
 * and the print / export / close actions. Extracted verbatim from OrderDetailsModal
 * (Sprint 6 god-file decomposition).
 */
export default function OrderDetailsHeader({
  order,
  showExportMenu,
  onToggleExportMenu,
  onPrint,
  onExport,
  onExportPDF,
  onClose,
}: OrderDetailsHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <h2 className={styles.title}>{t('order_details', 'Order Details')}</h2>
        <div className={styles.orderMeta}>
          <span className={styles.orderNumber}>#{order.orderNumber}</span>
          <span className={getStatusBadgeClasses(order.status)}>
            {order.status ? t(`order_status_${order.status.toLowerCase()}`, order.status) : 'N/A'}
          </span>
          {order.isFocusOrder && (
            <span className={getFocusBadgeClass()}>
              <Star size={14} />
              {t('focus_order', 'Focus Order')}
            </span>
          )}
        </div>
      </div>
      <div className={styles.headerActions}>
        <button onClick={onPrint} className={styles.iconButton} title={t('print_receipt', 'Print Receipt')}>
          <Printer size={20} />
        </button>
        <div className={styles.exportDropdown}>
          <button onClick={onToggleExportMenu} className={styles.iconButton} title={t('export', 'Export')}>
            <Download size={20} />
            <ChevronDown size={14} />
          </button>
          {showExportMenu && (
            <div className={styles.exportMenu}>
              <button onClick={onExport} className={styles.exportMenuItem}>
                <FileText size={16} />
                {t('export_as_csv', 'Export as CSV')}
              </button>
              <button onClick={onExportPDF} className={styles.exportMenuItem}>
                <FileText size={16} />
                {t('export_as_pdf', 'Export as PDF')}
              </button>
            </div>
          )}
        </div>
        <button onClick={onClose} className={styles.closeButton}>
          <X size={24} />
        </button>
      </div>
    </div>
  );
}
