'use client';

import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import QuantityStepper from '@/components/design-system/QuantityStepper';
import StickyActionBar from '@/components/design-system/StickyActionBar';
import type { OrderDto } from '@/types/order';
import type { OrderItem } from '@/components/catalog/orderItems';
import { formatPlainCurrency } from '@/utils/currency';
import styles from './ServerTakeawayTicket.module.css';

interface ServerTakeawayTicketProps {
  readonly items: readonly OrderItem[];
  readonly ticketTotal: number;
  readonly quote: OrderDto | null;
  readonly phase: 'idle' | 'reviewing';
  readonly notes: string;
  readonly onNotesChange: (value: string) => void;
  readonly onSetQuantity: (index: number, quantity: number) => void;
  readonly onRemove: (index: number) => void;
  readonly canUndo: boolean;
  readonly onUndo: () => void;
  readonly onReview: () => void;
  readonly disabled: boolean;
}

export default function ServerTakeawayTicket({
  items,
  ticketTotal,
  quote,
  phase,
  notes,
  onNotesChange,
  onSetQuantity,
  onRemove,
  canUndo,
  onUndo,
  onReview,
  disabled,
}: ServerTakeawayTicketProps) {
  const { t } = useTranslation();
  const total = quote?.total ?? ticketTotal;
  const locked = disabled || phase === 'reviewing';

  return (
    <section className={styles.ticket} aria-label={t('server.takeaway.ticket')}>
      <header className={styles.header}>
        <h2>{t('server.takeaway.ticket')}</h2>
        <span>{t('server.takeaway.item_count', { count: items.reduce((sum, item) => sum + item.quantity, 0) })}</span>
      </header>
      {items.length === 0 ? (
        <p className={styles.empty}>{t('server.takeaway.empty')}</p>
      ) : (
        <ul className={styles.lines}>
          {items.map((item, index) => (
            <li className={styles.line} key={`${item.product.id}-${item.variationId ?? 'base'}-${index}`}>
              <div className={styles.lineText}>
                <strong dir="auto">{item.product.name}</strong>
                {item.variationName && <span dir="auto">{item.variationName}</span>}
                {item.notes && <span dir="auto">{item.notes}</span>}
              </div>
              <div className={styles.lineActions}>
                <QuantityStepper
                  value={item.quantity}
                  onChange={(quantity) => onSetQuantity(index, quantity)}
                  onRemove={() => onRemove(index)}
                  itemName={item.product.name}
                  disabled={locked}
                  min={1}
                />
                <span className={styles.linePrice}>{formatPlainCurrency(item.unitPrice * item.quantity)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {canUndo && (
        <button type="button" className={styles.undo} onClick={onUndo} disabled={locked}>
          {t('server.takeaway.undo')}
        </button>
      )}
      <FormField label={t('server.takeaway.notes')} htmlFor="server-takeaway-notes" className={styles.notesField}>
        <textarea
          id="server-takeaway-notes"
          className={styles.notes}
          value={notes}
          placeholder={t('server.takeaway.notes_placeholder')}
          onChange={(event) => onNotesChange(event.target.value)}
          readOnly={locked}
        />
      </FormField>
      <StickyActionBar
        ariaLabel={t('server.takeaway.actions')}
        context={t('server.takeaway.payment_unpaid')}
        total={
          <>
            {t('server.takeaway.total')}: {formatPlainCurrency(total)}
          </>
        }
        primaryAction={
          <button type="button" className={styles.send} onClick={onReview} disabled={locked || items.length === 0}>
            {phase === 'reviewing' ? t('server.takeaway.sending') : t('server.takeaway.send')}
          </button>
        }
      />
    </section>
  );
}
