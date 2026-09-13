import { useTranslation } from 'react-i18next';
import type { OrderDto } from '@/types/order';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import { PaymentRows } from './CashierReadOnlyTicketSections';
import styles from './CashierCollection.module.css';

interface CashierCollectionPaymentHistoryProps {
  readonly order: OrderDto;
}

export default function CashierCollectionPaymentHistory({ order }: CashierCollectionPaymentHistoryProps) {
  const { t } = useTranslation();
  return (
    <aside className={styles.paymentHistory} aria-labelledby="cashier-collection-history">
      <h2 id="cashier-collection-history">{t('cashier.workspace.payment')}</h2>
      <div className={styles.historyTotals}>
        <div>
          <span>{t('cashier.collection.total')}</span>
          <strong>{formatOrderCurrency(order.total, order)}</strong>
        </div>
        <div>
          <span>{t('cashier.workspace.total_paid')}</span>
          <strong>{formatOrderCurrency(order.totalPaid, order)}</strong>
        </div>
      </div>
      <PaymentRows payments={order.payments ?? []} currency={order.currency} t={t} />
    </aside>
  );
}
