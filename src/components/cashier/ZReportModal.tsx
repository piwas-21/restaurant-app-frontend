'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, FileBarChart, Printer, Loader2 } from 'lucide-react';
import { ZReportDto } from '@/types/order';
import { getZReport } from '@/services/orderService';
import { getErrorMessage } from '@/utils/apiClient';
import { exportZReportToPDF } from '@/utils/zReportExportUtils';
import { formatCurrency } from '@/utils/currency';
import { calendarDayFromReport } from '@/utils/zReportDay';
import styles from './ZReportModal.module.css';

interface ZReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ZReportModal({ isOpen, onClose }: ZReportModalProps) {
  const { t } = useTranslation();
  // Empty until the SERVER names a day (see `zReportDay.ts`). This used to open on the device's
  // UTC day and send it explicitly, so backend #372's corrected default never applied: a cashier
  // closing at 00:30 in Geneva still read YESTERDAY's takings (frontend #511).
  const [reportDate, setReportDate] = useState<string>('');
  // The tenant's today, as the server last reported it — the picker's ceiling. Unknown until the
  // first answer arrives, and a ceiling we are not sure of must not be imposed.
  const [tenantToday, setTenantToday] = useState<string>('');
  const [reportData, setReportData] = useState<ZReportDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `date` omitted = "the day the restaurant is on" — the server decides it, from the tenant
  // clock. A date passed in is a day the cashier NAMED, and the server reads that on the same
  // wall clock, so both paths agree on whose calendar is in force.
  const fetchReport = useCallback(
    async (date?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getZReport(date);
        setReportData(data);
        // Which day did we actually get? The answer carries it, so the picker shows the day the
        // figures are for rather than the day this device guessed.
        const servedDay = calendarDayFromReport(data.reportDate);
        if (servedDay) {
          setReportDate(servedDay);
          if (!date) setTenantToday(servedDay);
        }
      } catch (err) {
        // This modal HOLDS its error (rendered below), but it is a single sentence with no fields
        // to route onto, so `getErrorMessage` rather than `useApiError`. The reason matters here:
        // a Z-report is refused for reasons a cashier can act on — a date outside the till's
        // range, a report already closed — and "Failed to load Z-Report" told them none of them.
        // (A 401 is NOT one of the cases this improves: `apiClient` throws `ApiError(401, '')`
        // with an empty message on purpose, so the fallback below still renders.)
        // `getZReport` also throws a plain `Error('Failed to fetch Z-Report')` for a 200 with no
        // body; `getErrorMessage` returns null for that, so the English literal never renders.
        setError(getErrorMessage(err) ?? (t('cashier.zreport.error') || 'Failed to load Z-Report'));
        setReportData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [t],
  );

  // Held in a ref so that OPENING is the only thing that re-asks for today. The effect used to
  // depend on `fetchReport`, whose identity follows `t` — a new `t` (a language change; every
  // render, for a stubbed `useTranslation`) re-ran it, which both refetched unboundedly and threw
  // away the day the cashier had picked (measured: 9 requests in one second).
  const fetchReportRef = useRef(fetchReport);
  fetchReportRef.current = fetchReport;

  // Opening always asks for the restaurant's current day, whatever was picked last time.
  useEffect(() => {
    if (!isOpen) return;
    // Blank, not a device guess: which day this is has not been answered yet.
    setReportDate('');
    // fetchReport has its own try/catch (sets error state); fire-and-forget.
    void fetchReportRef.current();
  }, [isOpen]);

  // Re-fetch when date changes (user picks a different date)
  const handleDateChange = (newDate: string) => {
    setReportDate(newDate);
    void fetchReport(newDate);
  };

  if (!isOpen) return null;

  const handleExportPDF = () => {
    if (reportData) {
      exportZReportToPDF(reportData);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content ${styles.modalWide}`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className={styles.headerControls}>
            <FileBarChart size={22} />
            <h2>{t('cashier.zreport.title') || 'Z-Report'}</h2>
            <input
              type="date"
              className={styles.dateInput}
              value={reportDate}
              onChange={(e) => handleDateChange(e.target.value)}
              // No ceiling until the server has told us what today is on the restaurant's clock.
              // The device's own day is not that ceiling: east of UTC it is a day BEHIND the
              // tenant's after local midnight, and would refuse the very day the till is closing.
              max={tenantToday || undefined}
            />
            {reportData && (
              <button className={styles.exportButton} onClick={handleExportPDF}>
                <Printer size={16} />
                {t('cashier.zreport.export_pdf') || 'Print / PDF'}
              </button>
            )}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {isLoading && (
            <div className={styles.loading}>
              <Loader2 size={32} className={styles.spinner} />
              <span>{t('cashier.zreport.loading') || 'Loading report...'}</span>
            </div>
          )}

          {error && !isLoading && (
            <div className={styles.error}>
              <span>{error}</span>
              {/* `|| undefined` matters: if the FIRST load failed we never learned the day, and
                  retrying must re-ask the server for today rather than send an empty date. */}
              <button className={styles.retryButton} onClick={() => fetchReport(reportDate || undefined)}>
                {t('cashier.zreport.retry') || 'Retry'}
              </button>
            </div>
          )}

          {!isLoading && !error && reportData && (
            <>
              {/* Summary Cards */}
              <div className={styles.summaryCards}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>{t('cashier.zreport.total_transactions') || 'Transactions'}</div>
                  <div className={styles.cardValue}>{reportData.totalTransactions}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>{t('cashier.zreport.gross_sales') || 'Gross Sales'}</div>
                  <div className={styles.cardValue}>{formatCurrency(reportData.grossSales)}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>{t('cashier.zreport.net_sales') || 'Net Sales'}</div>
                  <div className={styles.cardValue}>{formatCurrency(reportData.netSales)}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>{t('cashier.zreport.total_tax') || 'Tax'}</div>
                  <div className={styles.cardValue}>{formatCurrency(reportData.totalTax)}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>{t('cashier.zreport.total_tips') || 'Tips'}</div>
                  <div className={styles.cardValue}>{formatCurrency(reportData.totalTips)}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>{t('cashier.zreport.delivery_fees') || 'Delivery Fees'}</div>
                  <div className={styles.cardValue}>{formatCurrency(reportData.totalDeliveryFees)}</div>
                </div>
              </div>

              <div className={styles.twoColumns}>
                {/* Left column */}
                <div>
                  {/* Payment Methods */}
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                      {t('cashier.zreport.payment_methods') || 'Sales by Payment Method'}
                    </div>
                    {reportData.paymentsByMethod.length > 0 ? (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>{t('cashier.zreport.payment_method') || 'Method'}</th>
                            <th>{t('cashier.zreport.transactions') || 'Txns'}</th>
                            <th>{t('cashier.zreport.amount') || 'Amount'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.paymentsByMethod.map((pm) => (
                            <tr key={pm.paymentMethod}>
                              <td>{pm.paymentMethod}</td>
                              <td>{pm.transactionCount}</td>
                              <td>{formatCurrency(pm.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className={styles.empty}>{t('cashier.zreport.no_data') || 'No data'}</div>
                    )}
                  </div>

                  {/* Order Types */}
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                      {t('cashier.zreport.order_types') || 'Sales by Order Type'}
                    </div>
                    {reportData.salesByOrderType.length > 0 ? (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>{t('cashier.zreport.order_type') || 'Type'}</th>
                            <th>{t('cashier.zreport.orders') || 'Orders'}</th>
                            <th>{t('cashier.zreport.amount') || 'Amount'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.salesByOrderType.map((ot) => (
                            <tr key={ot.orderType}>
                              <td>{ot.orderType}</td>
                              <td>{ot.orderCount}</td>
                              <td>{formatCurrency(ot.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className={styles.empty}>{t('cashier.zreport.no_data') || 'No data'}</div>
                    )}
                  </div>
                </div>

                {/* Right column */}
                <div>
                  {/* Discounts */}
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>{t('cashier.zreport.discounts') || 'Discounts'}</div>
                    <table className={styles.table}>
                      <tbody>
                        <tr>
                          <td>{t('cashier.zreport.promo_code_discounts') || 'Promo Code'}</td>
                          <td>{formatCurrency(reportData.discounts.promoCodeDiscounts)}</td>
                        </tr>
                        <tr>
                          <td>{t('cashier.zreport.customer_discounts') || 'Customer Discounts'}</td>
                          <td>{formatCurrency(reportData.discounts.customerDiscounts)}</td>
                        </tr>
                        <tr>
                          <td>{t('cashier.zreport.fidelity_discounts') || 'Fidelity Points'}</td>
                          <td>{formatCurrency(reportData.discounts.fidelityPointsDiscounts)}</td>
                        </tr>
                        <tr className={styles.totalRow}>
                          <td>{t('cashier.zreport.total_discounts') || 'Total Discounts'}</td>
                          <td>{formatCurrency(reportData.discounts.totalDiscounts)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Refunds & Cancellations */}
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                      {t('cashier.zreport.refunds') || 'Refunds'} &{' '}
                      {t('cashier.zreport.cancellations') || 'Cancellations'}
                    </div>
                    <table className={styles.table}>
                      <tbody>
                        <tr>
                          <td>{t('cashier.zreport.refund_count') || 'Refund Count'}</td>
                          <td>{reportData.refunds.refundCount}</td>
                        </tr>
                        <tr>
                          <td>{t('cashier.zreport.total_refunded') || 'Total Refunded'}</td>
                          <td>{formatCurrency(reportData.refunds.totalRefundedAmount)}</td>
                        </tr>
                        <tr>
                          <td>{t('cashier.zreport.cancelled_orders') || 'Cancelled Orders'}</td>
                          <td>{reportData.cancelledOrdersCount}</td>
                        </tr>
                        <tr>
                          <td>{t('cashier.zreport.cancelled_total') || 'Cancelled Total'}</td>
                          <td>{formatCurrency(reportData.cancelledOrdersTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Product Types */}
                  {reportData.salesByProductType.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}>
                        {t('cashier.zreport.product_types') || 'Sales by Product Type'}
                      </div>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>{t('cashier.zreport.product_type') || 'Type'}</th>
                            <th>{t('cashier.zreport.items_sold') || 'Items'}</th>
                            <th>{t('cashier.zreport.amount') || 'Amount'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.salesByProductType.map((pt) => (
                            <tr key={pt.productType}>
                              <td>{pt.productType}</td>
                              <td>{pt.itemCount}</td>
                              <td>{formatCurrency(pt.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Selling Items */}
              {reportData.topSellingItems.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>{t('cashier.zreport.top_items') || 'Top Selling Items'}</div>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{t('cashier.zreport.product_name') || 'Product'}</th>
                        <th>{t('cashier.zreport.quantity_sold') || 'Qty Sold'}</th>
                        <th>{t('cashier.zreport.revenue') || 'Revenue'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.topSellingItems.map((item, idx) => (
                        <tr key={item.productName}>
                          <td className={styles.rank}>{idx + 1}</td>
                          <td>{item.productName}</td>
                          <td>{item.quantitySold}</td>
                          <td>{formatCurrency(item.totalRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {reportData.totalTransactions === 0 && (
                <div className={styles.empty}>{t('cashier.zreport.no_data') || 'No data available for this date'}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
