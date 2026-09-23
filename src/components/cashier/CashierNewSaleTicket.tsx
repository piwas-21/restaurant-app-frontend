'use client';

import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { formatPlainCurrency } from '@/utils/currency';
import type { OrderDto } from '@/types/order';
import type { CashierNewSaleDraftLine } from '@/lib/cashierNewSaleDraft';
import type { StaffCustomerSelection } from '@/types/staffCustomer';
import StaffCustomerSummary from '@/components/staff/StaffCustomerSummary';
import styles from './CashierNewSaleTicket.module.css';

interface CashierNewSaleTicketProps {
  readonly lines: readonly CashierNewSaleDraftLine[];
  readonly ticketTotal: number;
  readonly quote: OrderDto | null;
  readonly customer?: StaffCustomerSelection;
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

/**
 * The current ticket (plan §5.3.3): one line per distinct customization, with quantity, edit
 * and remove; a removal of an unsent line can be undone until the next change. The running
 * total is a display courtesy — the server quote is the authoritative number, and once one
 * exists it is the total shown here.
 */
export default function CashierNewSaleTicket({
  lines,
  ticketTotal,
  quote,
  customer,
  phase,
  notes,
  onNotesChange,
  onSetQuantity,
  onRemove,
  canUndo,
  onUndo,
  onReview,
  disabled,
}: CashierNewSaleTicketProps) {
  const { t } = useTranslation();
  const total = quote ? quote.total : ticketTotal;
  const lineCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  // While a review is in flight the ticket is frozen: an edit mid-review would invalidate the
  // quoted price, drop the stored operation id and make the next retry mint a fresh one.
  const reviewLocked = disabled || phase === 'reviewing';

  return (
    <section className={styles.ticket} aria-label={t('cashier.new_sale.ticket_label')}>
      <div className={styles.head}>
        <h2 className={styles.title}>{t('cashier.new_sale.ticket_label')}</h2>
        <span className={styles.count}>{t('cashier.new_sale.items_count', { count: lineCount })}</span>
      </div>

      {lines.length === 0 && <p className={styles.empty}>{t('cashier.new_sale.empty_ticket')}</p>}

      <ul className={styles.lines}>
        {lines.map((line, index) => (
          <li key={`${line.product.id}-${line.variationId ?? 'base'}-${index}`} className={styles.line}>
            <div className={styles.lineMain}>
              <span className={styles.lineName}>{line.product.name}</span>
              {line.variationName && <span className={styles.lineDetail}>{line.variationName}</span>}
              {line.notes && <span className={styles.lineDetail}>{line.notes}</span>}
            </div>
            <div className={styles.lineControls}>
              <div className={styles.quantity}>
                <button
                  type="button"
                  className={styles.quantityButton}
                  aria-label={t('cashier.new_sale.decrease_quantity', { name: line.product.name })}
                  onClick={() => onSetQuantity(index, line.quantity - 1)}
                  disabled={reviewLocked}
                >
                  −
                </button>
                <span className={styles.quantityValue}>{line.quantity}</span>
                <button
                  type="button"
                  className={styles.quantityButton}
                  aria-label={t('cashier.new_sale.increase_quantity', { name: line.product.name })}
                  onClick={() => onSetQuantity(index, line.quantity + 1)}
                  disabled={reviewLocked}
                >
                  +
                </button>
              </div>
              <span className={styles.linePrice}>{formatPlainCurrency(line.unitPrice * line.quantity)}</span>
              <button
                type="button"
                className={styles.removeButton}
                aria-label={t('cashier.new_sale.remove_line', { name: line.product.name })}
                onClick={() => onRemove(index)}
                disabled={reviewLocked}
              >
                {t('cashier.new_sale.remove')}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {canUndo && (
        <button type="button" className={styles.undoButton} onClick={onUndo} disabled={reviewLocked}>
          {t('cashier.new_sale.undo')}
        </button>
      )}

      <FormField
        label={t('cashier.new_sale.notes_label')}
        htmlFor="cashier-new-sale-notes"
        className={styles.notesField}
      >
        <textarea
          id="cashier-new-sale-notes"
          className={styles.notes}
          value={notes}
          placeholder={t('cashier.new_sale.notes_placeholder')}
          onChange={(event) => onNotesChange(event.target.value)}
          readOnly={reviewLocked}
          aria-busy={phase === 'reviewing'}
        />
      </FormField>

      <div className={styles.totalRow}>
        <span>{t('cashier.new_sale.total_label')}</span>
        <span className={styles.totalValue}>{formatPlainCurrency(total)}</span>
      </div>

      <StaffCustomerSummary selection={customer} />

      <button
        type="button"
        className={styles.reviewButton}
        disabled={disabled || lines.length === 0}
        onClick={onReview}
      >
        {phase === 'reviewing' ? t('cashier.new_sale.reviewing') : t('cashier.new_sale.review_and_collect')}
      </button>
    </section>
  );
}
