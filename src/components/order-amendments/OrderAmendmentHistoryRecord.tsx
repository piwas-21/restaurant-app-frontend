'use client';

import { useTranslation } from 'react-i18next';
import OrderLineSummary from '@/components/order/OrderLineSummary';
import { orderItemToLineSummary } from '@/components/order/lineSummary';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import type { OrderItemDto } from '@/types/order';
import type { OrderAmendmentChangeSnapshot, OrderAmendmentHistory } from '@/types/orderAmendment';
import { formatAmendmentMinorAmount } from './orderAmendmentPresentation';
import AmendmentResolutionEntry from './AmendmentResolutionEntry';
import AmendmentResolutionLoyalty from './AmendmentResolutionLoyalty';
import styles from './OrderAmendmentHistorySection.module.css';

interface OrderAmendmentHistoryRecordProps {
  readonly record: OrderAmendmentHistory;
  readonly language: string;
}

function roleLabel(role: string, t: ReturnType<typeof useTranslation>['t']): string {
  const roles: Record<string, readonly [string, string]> = {
    Server: ['orderAmendments.history_role_server', 'Server'],
    Cashier: ['orderAmendments.history_role_cashier', 'Cashier'],
    Admin: ['orderAmendments.history_role_admin', 'Administrator'],
  };
  const label = roles[role];
  return label
    ? t(label[0], { defaultValue: label[1] })
    : t('orderAmendments.history_role_staff', { defaultValue: 'Staff' });
}

function itemTitle(item: OrderItemDto, t: ReturnType<typeof useTranslation>['t']): string {
  return (
    item.productName ||
    item.menuName ||
    item.variationName ||
    t('orderAmendments.catalog_item', { defaultValue: 'Catalog item' })
  );
}

function changeLabel(change: OrderAmendmentChangeSnapshot, t: ReturnType<typeof useTranslation>['t']): string {
  const kind = t(`orderAmendments.kind_${change.kind.toLowerCase()}`, { defaultValue: change.kind });
  const range = change.wholeLine
    ? t('orderAmendments.whole_line', { defaultValue: 'whole line' })
    : `#${change.startOrdinal}–#${change.startOrdinal + change.quantity - 1}`;
  return t('orderAmendments.history_change', {
    defaultValue: '{{kind}} · {{item}} · {{range}}',
    kind,
    item: itemTitle(change.previous, t),
    range,
  });
}

function localizedTime(value: string, language: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(language || 'en', { dateStyle: 'medium', timeStyle: 'short' });
}

function amount(value: number, currency: string | null | undefined, language: string, unavailable: string): string {
  return formatAmendmentMinorAmount(value, currency, language) ?? unavailable;
}

export default function OrderAmendmentHistoryRecord({ record, language }: Readonly<OrderAmendmentHistoryRecordProps>) {
  const { t } = useTranslation();
  const recordedAt = record.committedAt ?? record.createdAt;
  const role = roleLabel(record.actorRole, t);
  const financial = record.financialResolution;
  const unavailable = t('orderAmendments.currency_unavailable', { defaultValue: 'Currency unavailable' });
  const status = (value: string) => t(`orderAmendments.state_${value.toLowerCase()}`, { defaultValue: value });
  return (
    <li className={styles.record}>
      <header className={styles.recordHeader}>
        <span className={styles.stateBadge}>
          {t('orderAmendments.history_committed', { defaultValue: 'Committed' })}
        </span>
        <span>{t('orderAmendments.history_by_role', { defaultValue: 'By {{role}}', role })}</span>
        <time dateTime={recordedAt} dir="auto">
          {localizedTime(recordedAt, language)}
        </time>
      </header>
      <ul className={styles.changes}>
        {record.changes.map((change, index) => (
          <li key={`${change.orderItemId}-${change.kind}-${change.startOrdinal}-${index}`}>
            <strong>{changeLabel(change, t)}</strong>
            <div className={styles.snapshot}>
              <span>{t('orderAmendments.history_before', { defaultValue: 'Before' })}</span>
              <OrderLineSummary line={orderItemToLineSummary(change.previous)} />
            </div>
            {change.current && (
              <div className={styles.snapshot}>
                <span>{t('orderAmendments.history_after', { defaultValue: 'After' })}</span>
                <OrderLineSummary line={orderItemToLineSummary(change.current)} />
              </div>
            )}
            {change.replacementDispatchedOrderNumber && (
              <p className={styles.linkedOrder}>
                {t('orderAmendments.history_replacement_dispatch', {
                  defaultValue: 'Replacement fulfilment: {{orderNumber}}',
                  orderNumber: change.replacementDispatchedOrderNumber,
                })}
              </p>
            )}
          </li>
        ))}
      </ul>
      {record.supplementOrder && (
        <section
          className={styles.supplement}
          aria-label={t('orderAmendments.history_supplement', { defaultValue: 'Linked supplement order' })}
        >
          <h4>
            {t('orderAmendments.history_supplement', { defaultValue: 'Linked supplement order' })} ·{' '}
            {record.supplementOrder.orderNumber}
          </h4>
          <ul className={styles.supplementItems}>
            {record.supplementOrder.items.map((item) => (
              <li key={item.id}>
                <strong>
                  {item.quantity}× {itemTitle(item, t)}
                </strong>
                <OrderLineSummary line={orderItemToLineSummary(item)} />
              </li>
            ))}
          </ul>
          <p className={styles.supplementTotal}>
            {t('orderAmendments.supplement_total', { defaultValue: 'Supplement total' })}:{' '}
            {formatOrderCurrency(record.supplementOrder.total, record.supplementOrder)}
          </p>
        </section>
      )}
      {record.supplementOrderId && !record.supplementOrder && (
        <p className={styles.linkedOrder}>
          {t('orderAmendments.history_supplement_unavailable', {
            defaultValue: 'Linked supplement details are unavailable.',
          })}
        </p>
      )}
      <section
        className={styles.financial}
        aria-label={t('orderAmendments.history_financial_effect', { defaultValue: 'Recorded financial effect' })}
      >
        <h4>{t('orderAmendments.history_financial_effect', { defaultValue: 'Recorded financial effect' })}</h4>
        <dl>
          <div>
            <dt>{t('orderAmendments.added_amount', { defaultValue: 'Added' })}</dt>
            <dd>{amount(financial.addedAmountMinor, financial.currency, language, unavailable)}</dd>
          </div>
          <div>
            <dt>{t('orderAmendments.removed_value', { defaultValue: 'Removed unit value' })}</dt>
            <dd>{amount(financial.removedUnitValueMinor, financial.currency, language, unavailable)}</dd>
          </div>
          <div>
            <dt>{t('orderAmendments.net_change', { defaultValue: 'Net account change' })}</dt>
            <dd>{amount(financial.netAccountDeltaMinor, financial.currency, language, unavailable)}</dd>
          </div>
          <div>
            <dt>{t('orderAmendments.potential_credit', { defaultValue: 'Potential credit' })}</dt>
            <dd>{amount(financial.potentialCreditMinor, financial.currency, language, unavailable)}</dd>
          </div>
          <div>
            <dt>{t('orderAmendments.resolution', { defaultValue: 'Financial resolution' })}</dt>
            <dd>{status(financial.resolutionStatus)}</dd>
          </div>
          <div>
            <dt>{t('orderAmendments.credit', { defaultValue: 'Credit' })}</dt>
            <dd>{status(financial.creditState)}</dd>
          </div>
          <div>
            <dt>{t('orderAmendments.loyalty', { defaultValue: 'Loyalty' })}</dt>
            <dd>{status(financial.loyaltyState)}</dd>
          </div>
          <div>
            <dt>{t('orderAmendments.refund', { defaultValue: 'Refund' })}</dt>
            <dd>{status(financial.refundState)}</dd>
          </div>
        </dl>
        <p>
          {t('orderAmendments.history_no_money_change', {
            defaultValue:
              'These are recorded adjustment values and statuses. This amendment did not collect or refund money; use a separate authorized payment or refund flow to move money.',
          })}
        </p>
      </section>
      <AmendmentResolutionLoyalty value={financial.loyalty} />
      <AmendmentResolutionEntry record={record} />
    </li>
  );
}
