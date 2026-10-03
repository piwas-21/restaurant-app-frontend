'use client';

import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import OrderStatusBadge from '@/components/design-system/OrderStatusBadge';
import OrderLineSummary from '@/components/order/OrderLineSummary';
import StatusBadge from '@/components/design-system/StatusBadge';
import { orderItemToLineSummary } from '@/components/order/lineSummary';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import { paymentStatusLabel } from '@/lib/paymentStatus';
import type {
  OrderAmendmentChangeKind,
  OrderAmendmentChangeSnapshot,
  OrderAmendmentItemDto,
  OrderAmendmentQuote,
} from '@/types/orderAmendment';
import { formatAmendmentMinorAmount, orderItemTitle } from './orderAmendmentPresentation';
import { matchedPreparationInstructions } from './proposedPreparationInstructions';
import instructionStyles from './ProposedPreparationInstruction.module.css';
import styles from './OrderAmendmentModal.module.css';

interface OrderAmendmentReviewStageProps {
  readonly quote: OrderAmendmentQuote;
  readonly language: string;
  readonly proposedInstructionChanges: readonly ProposedInstructionChange[];
  readonly proposedAdditionItems: readonly OrderAmendmentItemDto[];
}

interface ProposedInstructionChange {
  readonly orderItemId: string;
  readonly kind: OrderAmendmentChangeKind;
  readonly startOrdinal: number;
  readonly quantity: number;
  readonly current?: OrderAmendmentItemDto;
}

function changeDescription(change: OrderAmendmentChangeSnapshot, t: TFunction): string {
  const kind = t(`orderAmendments.kind_${change.kind.toLowerCase()}`, change.kind);
  const quantity = change.wholeLine
    ? t('orderAmendments.whole_line', 'whole line')
    : `#${change.startOrdinal}–#${change.startOrdinal + change.quantity - 1}`;
  return `${kind} · ${orderItemTitle(change.previous)} · ${quantity}`;
}

function amount(value: number, currency: string | null | undefined, language: string, fallback: string): string {
  return formatAmendmentMinorAmount(value, currency, language) ?? fallback;
}

export default function OrderAmendmentReviewStage({
  quote,
  language,
  proposedInstructionChanges,
  proposedAdditionItems,
}: Readonly<OrderAmendmentReviewStageProps>) {
  const { t, i18n } = useTranslation();
  const financial = quote.financialPreview;
  const expires = new Date(quote.expiresAt);
  const expiresLabel = Number.isNaN(expires.getTime())
    ? quote.expiresAt
    : expires.toLocaleTimeString(i18n.language || 'en', { hour: '2-digit', minute: '2-digit' });
  const moneyUnavailable = t('orderAmendments.currency_unavailable', 'Currency unavailable');

  return (
    <div className={styles.reviewStage}>
      <section className={styles.reviewSection} aria-labelledby="amendment-review-source">
        <div className={styles.sectionHeader}>
          <h3 id="amendment-review-source">{t('orderAmendments.original_order', 'Original order')}</h3>
          <span>{quote.sourceOrder.orderNumber}</span>
        </div>
        <div className={styles.orderState}>
          <span>{t('orderAmendments.service_state', 'Service')}</span>
          <OrderStatusBadge status={quote.sourceOrder.status} />
          <span>{t('orderAmendments.payment_state', 'Payment')}</span>
          <StatusBadge tone="neutral">{paymentStatusLabel(quote.sourceOrder.paymentStatus, t)}</StatusBadge>
        </div>
        <p className={styles.sourceTotal}>
          {t('orderAmendments.original_total', 'Current order total')}:{' '}
          {formatOrderCurrency(quote.sourceOrder.total, quote.sourceOrder)}
        </p>
        <ul className={styles.changeList}>
          {quote.changes.length > 0 ? (
            quote.changes.map((change, index) => {
              const proposedInstruction = proposedInstructionChanges.find(
                (candidate) =>
                  candidate.orderItemId === change.orderItemId &&
                  candidate.kind === change.kind &&
                  candidate.startOrdinal === change.startOrdinal &&
                  candidate.quantity === change.quantity,
              );
              const replacementInstructions =
                change.kind === 'Replace' && proposedInstruction?.current && change.current
                  ? matchedPreparationInstructions(proposedInstruction.current, change.current)
                  : [];
              return (
                <li key={`${change.orderItemId}-${change.kind}-${index}`}>
                  <p>{changeDescription(change, t)}</p>
                  <OrderLineSummary line={orderItemToLineSummary(change.previous)} />
                  {change.current && (
                    <div className={styles.currentSnapshot}>
                      <span>{t('orderAmendments.replacement_or_update', 'New line details')}</span>
                      <OrderLineSummary line={orderItemToLineSummary(change.current)} />
                    </div>
                  )}
                  {change.kind === 'InstructionChange' && proposedInstruction?.current && (
                    <div className={instructionStyles.note}>
                      <strong>{t('orderAmendments.proposed_instruction', 'Proposed preparation instruction')}</strong>
                      <pre dir="auto">
                        {proposedInstruction.current.specialInstructions ||
                          t('orderAmendments.no_instruction', 'No additional preparation instruction')}
                      </pre>
                    </div>
                  )}
                  {replacementInstructions.map((entry, instructionIndex) => (
                    <div className={instructionStyles.note} key={`${entry.itemTitle}-${instructionIndex}`}>
                      <strong>
                        {entry.nested
                          ? t('orderAmendments.proposed_instruction_for_item', 'Preparation instruction for {{item}}', {
                              item: entry.itemTitle,
                            })
                          : t('orderAmendments.proposed_instruction', 'Proposed preparation instruction')}
                      </strong>
                      <pre dir="auto">{entry.text}</pre>
                    </div>
                  ))}
                </li>
              );
            })
          ) : (
            <li>{t('orderAmendments.no_existing_changes', 'No existing order lines change.')}</li>
          )}
        </ul>
      </section>

      <section className={styles.reviewSection} aria-labelledby="amendment-review-supplement">
        <div className={styles.sectionHeader}>
          <h3 id="amendment-review-supplement">{t('orderAmendments.supplement_order', 'Fresh supplement')}</h3>
          <span>
            {quote.supplementOrder
              ? quote.supplementOrder.orderNumber.trim() ||
                t('orderAmendments.order_number_assigned_when_saved', 'Assigned when saved')
              : t('orderAmendments.no_supplement', 'No new supplement')}
          </span>
        </div>
        {quote.supplementOrder ? (
          <>
            <ul className={styles.supplementItems}>
              {quote.supplementOrder.items.map((item, index) => {
                const proposedItem = proposedAdditionItems[index];
                const proposedInstructions = proposedItem ? matchedPreparationInstructions(proposedItem, item) : [];
                return (
                  <li key={item.id}>
                    <strong>
                      {item.quantity}× {orderItemTitle(item)}
                    </strong>
                    <OrderLineSummary line={orderItemToLineSummary(item)} />
                    {proposedInstructions.map((entry, instructionIndex) => (
                      <div className={instructionStyles.note} key={`${entry.itemTitle}-${instructionIndex}`}>
                        <strong>
                          {entry.nested
                            ? t(
                                'orderAmendments.proposed_instruction_for_item',
                                'Preparation instruction for {{item}}',
                                {
                                  item: entry.itemTitle,
                                },
                              )
                            : t('orderAmendments.proposed_instruction', 'Proposed preparation instruction')}
                        </strong>
                        <pre dir="auto">{entry.text}</pre>
                      </div>
                    ))}
                  </li>
                );
              })}
            </ul>
            <p className={styles.sourceTotal}>
              {t('orderAmendments.supplement_total', 'Supplement total')}:{' '}
              {formatOrderCurrency(quote.supplementOrder.total, quote.supplementOrder)}
            </p>
          </>
        ) : (
          <p className={styles.inlineHint}>
            {t('orderAmendments.no_new_items', 'This quote only changes existing order lines.')}
          </p>
        )}
        {quote.providerProcedure && (
          <p className={styles.providerNotice} role="note">
            {quote.providerProcedure}
          </p>
        )}
      </section>

      <section className={styles.moneySection} aria-labelledby="amendment-money-title">
        <div className={styles.sectionHeader}>
          <h3 id="amendment-money-title">{t('orderAmendments.financial_effect', 'Account and payment effect')}</h3>
          <span>{financial.currency ?? t('orderAmendments.currency_unavailable', 'Currency unavailable')}</span>
        </div>
        <dl className={styles.moneyGrid}>
          <div>
            <dt>{t('orderAmendments.added_amount', 'Added')}</dt>
            <dd>{amount(financial.addedAmountMinor, financial.currency, language, moneyUnavailable)}</dd>
          </div>
          <div>
            <dt>{t('orderAmendments.removed_value', 'Removed unit value')}</dt>
            <dd>{amount(financial.removedUnitValueMinor, financial.currency, language, moneyUnavailable)}</dd>
          </div>
          <div>
            <dt>{t('orderAmendments.net_change', 'Net account change')}</dt>
            <dd>{amount(financial.netAccountDeltaMinor, financial.currency, language, moneyUnavailable)}</dd>
          </div>
          <div>
            <dt>{t('orderAmendments.potential_credit', 'Potential credit')}</dt>
            <dd>{amount(financial.potentialCreditMinor, financial.currency, language, moneyUnavailable)}</dd>
          </div>
        </dl>
        <dl className={styles.statusGrid}>
          <div>
            <dt>{t('orderAmendments.resolution', 'Financial resolution')}</dt>
            <dd>
              {t(`orderAmendments.state_${financial.resolutionStatus.toLowerCase()}`, financial.resolutionStatus)}
            </dd>
          </div>
          <div>
            <dt>{t('orderAmendments.credit', 'Credit')}</dt>
            <dd>{t(`orderAmendments.state_${financial.creditState.toLowerCase()}`, financial.creditState)}</dd>
          </div>
          <div>
            <dt>{t('orderAmendments.loyalty', 'Loyalty')}</dt>
            <dd>{t(`orderAmendments.state_${financial.loyaltyState.toLowerCase()}`, financial.loyaltyState)}</dd>
          </div>
          <div>
            <dt>{t('orderAmendments.refund', 'Refund')}</dt>
            <dd>{t(`orderAmendments.state_${financial.refundState.toLowerCase()}`, financial.refundState)}</dd>
          </div>
        </dl>
        <p className={styles.moneyNotice}>
          {t(
            'orderAmendments.captured_unchanged',
            'This amendment does not collect or refund money. Captured payments stay unchanged until a separate authorized payment or refund flow resolves them.',
          )}
        </p>
        <p className={styles.expiry}>
          {t('orderAmendments.quote_expires', 'Quote expires at {{time}}', { time: expiresLabel })}
        </p>
      </section>
    </div>
  );
}
