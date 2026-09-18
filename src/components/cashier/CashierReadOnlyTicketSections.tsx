import type { TFunction } from 'i18next';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import type { OrderItemDto, OrderPaymentDto } from '@/types/order';
import { orderItemToLineSummary } from '@/components/order/lineSummary';
import OrderLineSummary from '@/components/order/OrderLineSummary';
import StatusBadge from '@/components/design-system/StatusBadge';
import styles from './CashierWorkspaceTicket.module.css';

function methodLabel(method: string, t: TFunction): string {
  switch (method) {
    case 'Cash':
    case '1':
      return t('cashier.workspace.method_cash');
    case 'CreditCard':
    case '2':
      return t('cashier.workspace.method_credit_card');
    case 'DebitCard':
    case '3':
      return t('cashier.workspace.method_debit_card');
    case 'OnlinePayment':
    case '4':
      return t('cashier.workspace.method_online');
    case 'MobilePayment':
    case '5':
      return t('cashier.workspace.method_mobile');
    case 'BankTransfer':
    case '6':
      return t('cashier.workspace.method_bank_transfer');
    default:
      return t('cashier.workspace.method_unknown');
  }
}

function paymentRecordStatus(payment: OrderPaymentDto, t: TFunction): string {
  switch (payment.status) {
    case 'Pending':
      return t('cashier.workspace.record_pending');
    case 'Processing':
      return t('cashier.workspace.record_processing');
    case 'Completed':
      return t('cashier.workspace.record_completed');
    case 'Failed':
      return t('cashier.workspace.record_failed');
    case 'PartiallyRefunded':
      return t('cashier.workspace.record_partially_refunded');
    case 'Refunded':
      return t('cashier.workspace.record_refunded');
    default:
      return t('cashier.workspace.record_unknown');
  }
}

function paymentRecordTone(payment: OrderPaymentDto): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (payment.status) {
    case 'Completed':
      return 'success';
    case 'Pending':
    case 'Processing':
    case 'PartiallyRefunded':
      return 'warning';
    case 'Failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function TicketItems({
  items,
  t,
  currency,
}: {
  readonly items: readonly OrderItemDto[];
  readonly t: TFunction;
  readonly currency?: string | null;
}) {
  if (items.length === 0) return <p className={styles.emptyMessage}>{t('cashier.workspace.no_items')}</p>;

  return (
    <ul className={styles.ticketItems}>
      {items.map((item) => (
        <li key={item.id} className={styles.ticketItem}>
          <div className={styles.ticketItemContent}>
            <div className={styles.ticketItemMain}>
              <span className={styles.ticketItemQuantity}>{item.quantity}×</span>
              <span>
                <strong dir="auto">{item.productName || t('cashier.workspace.unknown_item')}</strong>
                {item.variationName && (
                  <span className={styles.itemSecondary}>
                    · <span dir="auto">{item.variationName}</span>
                  </span>
                )}
              </span>
            </div>
            <OrderLineSummary line={orderItemToLineSummary(item)} />
          </div>
          <span className={styles.ticketItemPrice}>{formatOrderCurrency(item.itemTotal, { currency })}</span>
        </li>
      ))}
    </ul>
  );
}

export function PaymentRows({
  payments,
  t,
  currency,
}: {
  readonly payments: readonly OrderPaymentDto[];
  readonly t: TFunction;
  readonly currency?: string | null;
}) {
  if (payments.length === 0) return <p className={styles.emptyMessage}>{t('cashier.workspace.no_payments')}</p>;
  return (
    <ul className={styles.paymentRows}>
      {payments.map((payment) => (
        <li key={payment.id} className={styles.paymentRow}>
          <span>
            <strong>{methodLabel(String(payment.paymentMethod), t)}</strong>
            <StatusBadge tone={paymentRecordTone(payment)}>{paymentRecordStatus(payment, t)}</StatusBadge>
          </span>
          <span>{formatOrderCurrency(payment.amount, { currency })}</span>
        </li>
      ))}
    </ul>
  );
}
