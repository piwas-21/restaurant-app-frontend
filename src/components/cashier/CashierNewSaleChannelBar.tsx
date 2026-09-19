'use client';

import { useTranslation } from 'react-i18next';
import { OrderType } from '@/types/order';
import { ALL_ORDER_TYPES } from '@/utils/orderChannels';
import { orderTypeLabel } from '@/utils/orderTypeLabels';
import FormField from '@/components/design-system/FormField';
import styles from './CashierNewSaleChannelBar.module.css';

interface CashierNewSaleChannelBarProps {
  readonly enabled: readonly OrderType[];
  readonly loading: boolean;
  readonly selected: OrderType | null;
  readonly onSelect: (channel: OrderType) => void;
  readonly tableNumber: string;
  readonly onTableNumberChange: (value: string) => void;
  readonly disabled?: boolean;
  /** Per-channel customer/delivery sheet (delivery NEEDS its address before review). */
  readonly onOpenDetails?: () => void;
  readonly detailsComplete?: boolean;
}

/**
 * The sale's channel, always visible (cashier POS plan §5.3.1): the tenant's valid channels as
 * single-choice chips, starting on the tenant's default. Labels come from the shared channel
 * vocabulary so a new channel cannot appear here under a second name. Dine-in asks for its
 * table — the review resolves that number to the table's open visit before anything is quoted.
 */
export default function CashierNewSaleChannelBar({
  enabled,
  loading,
  selected,
  onSelect,
  tableNumber,
  onTableNumberChange,
  disabled = false,
  onOpenDetails,
  detailsComplete = false,
}: CashierNewSaleChannelBarProps) {
  const { t } = useTranslation();

  if (loading && selected === null) {
    return <p className={styles.loading}>{t('cashier.new_sale.channel_loading')}</p>;
  }

  return (
    <section className={styles.bar} aria-label={t('cashier.new_sale.channel_label')}>
      <div className={styles.chips} role="radiogroup" aria-label={t('cashier.new_sale.channel_label')}>
        {ALL_ORDER_TYPES.filter((channel) => enabled.includes(channel)).map((channel) => (
          <button
            key={channel}
            type="button"
            role="radio"
            aria-checked={selected === channel}
            className={`${styles.chip} ${selected === channel ? styles.chipActive : ''}`}
            disabled={disabled}
            onClick={() => onSelect(channel)}
          >
            {orderTypeLabel(channel, t)}
          </button>
        ))}
      </div>
      {selected === OrderType.DineIn && (
        <FormField
          label={t('cashier.new_sale.table_number')}
          htmlFor="cashier-new-sale-table"
          className={styles.tableField}
        >
          <input
            id="cashier-new-sale-table"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={tableNumber}
            placeholder={t('cashier.new_sale.table_number_placeholder')}
            disabled={disabled}
            onChange={(event) => onTableNumberChange(event.target.value)}
          />
        </FormField>
      )}
      {onOpenDetails && selected !== null && (
        <button
          type="button"
          className={`${styles.detailsButton} ${selected === OrderType.Delivery && !detailsComplete ? styles.detailsMissing : ''}`}
          onClick={onOpenDetails}
          disabled={disabled}
        >
          {selected === OrderType.Delivery
            ? t('cashier.new_sale.details_delivery_button')
            : t('cashier.new_sale.details_button')}
          <span className={styles.detailsState} aria-hidden="true">
            {detailsComplete ? '✓' : '…'}
          </span>
        </button>
      )}
    </section>
  );
}
