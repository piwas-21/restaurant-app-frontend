'use client';

import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import QuantityStepper from '@/components/design-system/QuantityStepper';
import StickyActionBar from '@/components/design-system/StickyActionBar';
import StatusBadge, { type StatusBadgeTone } from '@/components/design-system/StatusBadge';
import type { OrderDto, OrderRoutingStateDto } from '@/types/order';
import type { OrderItem } from '@/components/catalog/orderItems';
import { SERVER_TABLE_ROUND_NOTES_MAX_LENGTH, serverTableRoundNotesSchema } from '@/schemas/serverTableRound.schema';
import { formatPlainCurrency } from '@/utils/currency';
import styles from './ServerTableRoundTicket.module.css';

interface Props {
  readonly items: readonly OrderItem[];
  readonly ticketTotal: number;
  readonly quote: OrderDto | null;
  readonly createdOrder: OrderDto | null;
  readonly phase: 'idle' | 'reviewing' | 'reconciling';
  readonly operationState: 'idle' | 'committed' | 'failed' | 'unknown';
  readonly notes: string;
  readonly onNotesChange: (value: string) => void;
  readonly onSetQuantity: (index: number, quantity: number) => void;
  readonly onRemove: (index: number) => void;
  readonly onReview: () => void;
  readonly canCompose: boolean;
}

function routeMeta(
  status: string,
  t: ReturnType<typeof useTranslation>['t'],
): { label: string; tone: StatusBadgeTone } {
  const normalized = status.toLowerCase();
  if (normalized === 'queued') return { label: t('server.round.routing.queued'), tone: 'info' };
  if (normalized === 'sent' || normalized === 'received' || normalized === 'printed')
    return { label: t('server.round.routing.sent'), tone: 'success' };
  if (normalized === 'failed') return { label: t('server.round.routing.failed'), tone: 'danger' };
  if (normalized.includes('notconfigured') || normalized.includes('not_configured'))
    return { label: t('server.round.routing.not_configured'), tone: 'warning' };
  return { label: t('server.round.routing.unknown'), tone: 'neutral' };
}

function RoutingStates({ states }: { readonly states: readonly OrderRoutingStateDto[] }) {
  const { t } = useTranslation();
  if (!states.length) return null;
  return (
    <div className={styles.routing} aria-label={t('server.round.routing_label')}>
      {states.map((state) => {
        const meta = routeMeta(state.status, t);
        return (
          <StatusBadge key={`${state.id}-${state.revision}`} tone={meta.tone}>
            {meta.label}
          </StatusBadge>
        );
      })}
    </div>
  );
}

export default function ServerTableRoundTicket({
  items,
  ticketTotal,
  quote,
  createdOrder,
  phase,
  operationState,
  notes,
  onNotesChange,
  onSetQuantity,
  onRemove,
  onReview,
  canCompose,
}: Props) {
  const { t } = useTranslation();
  const locked = phase !== 'idle' || operationState === 'unknown' || !canCompose;
  const total = quote?.total ?? ticketTotal;
  const notesValid = serverTableRoundNotesSchema.safeParse(notes).success;
  const notesError = notesValid
    ? undefined
    : t('server.round.notes_too_long', { max: SERVER_TABLE_ROUND_NOTES_MAX_LENGTH });
  const review = () => {
    if (serverTableRoundNotesSchema.safeParse(notes).success) onReview();
  };
  return (
    <section className={styles.ticket} aria-label={t('server.round.ticket')}>
      <header className={styles.header}>
        <h2>{t('server.round.ticket')}</h2>
        <span>{t('server.round.item_count', { count: items.reduce((sum, item) => sum + item.quantity, 0) })}</span>
      </header>
      {createdOrder && (
        <section className={styles.created} aria-live="polite">
          <StatusBadge tone="success">{t('server.round.created')}</StatusBadge>
          <p>{t('server.round.created_message', { orderNumber: createdOrder.orderNumber })}</p>
          <RoutingStates states={createdOrder.routingStates ?? []} />
        </section>
      )}
      {items.length === 0 ? (
        <p className={styles.empty}>{t('server.round.empty')}</p>
      ) : (
        <ul className={styles.lines}>
          {items.map((item, index) => (
            <li className={styles.line} key={`${item.product.id}-${item.variationId ?? 'base'}-${index}`}>
              <div>
                <strong dir="auto">{item.product.name}</strong>
                {item.variationName && <span dir="auto">{item.variationName}</span>}
                {item.notes && <span dir="auto">{item.notes}</span>}
              </div>
              <div className={styles.actions}>
                <QuantityStepper
                  value={item.quantity}
                  min={1}
                  itemName={item.product.name}
                  disabled={locked}
                  onChange={(quantity) => onSetQuantity(index, quantity)}
                  onRemove={() => onRemove(index)}
                />
                <span>{formatPlainCurrency(item.unitPrice * item.quantity)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <FormField
        label={t('server.round.notes')}
        error={notesError}
        htmlFor="server-round-notes"
        className={styles.notesField}
      >
        <textarea
          id="server-round-notes"
          className={styles.notes}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          readOnly={locked}
          maxLength={SERVER_TABLE_ROUND_NOTES_MAX_LENGTH}
          placeholder={t('server.round.notes_placeholder')}
        />
      </FormField>
      <StickyActionBar
        ariaLabel={t('server.round.actions')}
        context={t('server.round.payment_unpaid')}
        total={
          <>
            {t('server.total')}: {formatPlainCurrency(total)}
          </>
        }
        primaryAction={
          <button
            type="button"
            className={styles.send}
            onClick={review}
            disabled={locked || items.length === 0 || !notesValid}
          >
            {phase === 'reviewing' ? t('server.round.sending') : t('server.round.send')}
          </button>
        }
      />
    </section>
  );
}
