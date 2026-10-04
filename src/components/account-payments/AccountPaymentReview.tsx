'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import FormField from '@/components/design-system/FormField';
import StatusBadge from '@/components/design-system/StatusBadge';
import { formatAccountPaymentMinor, parseAccountContributionMinor } from '@/lib/accountPaymentMoney';
import { mapFrozenAccountPaymentAllocations } from '@/lib/accountPaymentReviewScope';
import { useAccountPaymentExpiry } from '@/hooks/useAccountPaymentExpiry';
import type { AccountPaymentOperation } from '@/types/accountPayments';
import type { PendingAccountPayment } from '@/lib/pendingAccountPayment';
import type { TableServiceSessionDto } from '@/types/order';
import AccountPaymentCashCalculator from './AccountPaymentCashCalculator';
import styles from './AccountPaymentCollection.module.css';

interface Props {
  readonly session: TableServiceSessionDto;
  readonly operation: AccountPaymentOperation;
  readonly pending: PendingAccountPayment | null;
  readonly disabled: boolean;
  readonly recoveryReleaseEnabled?: boolean;
  readonly recoveryCollectionEnabled?: boolean;
  readonly onReserve: () => Promise<void>;
  readonly onCollect: () => Promise<void>;
  readonly onRelease: () => Promise<void>;
  readonly onCheck: () => Promise<void>;
}

export default function AccountPaymentReview({
  session,
  operation,
  pending,
  disabled,
  recoveryReleaseEnabled = false,
  recoveryCollectionEnabled = false,
  onReserve,
  onCollect,
  onRelease,
  onCheck,
}: Props) {
  const { t, i18n } = useTranslation();
  const [received, setReceived] = useState('');
  const [collected, setCollected] = useState(false);
  const [notCollected, setNotCollected] = useState(false);
  const quoted = operation.state === 'Quoted';
  const reserved = operation.state === 'Reserved';
  const expiry = quoted ? operation.quoteExpiresAt : operation.reservationExpiresAt;
  const expired = useAccountPaymentExpiry(expiry);
  const intent = pending?.kind === 'payment' ? pending.stage : null;
  const collectionUnknown = intent === 'collecting';
  const releaseUnknown = intent === 'releasing';
  const unknownWrite = collectionUnknown || releaseUnknown;
  const terminal = ['Captured', 'Released', 'Failed'].includes(operation.state);
  const canRelease =
    recoveryReleaseEnabled &&
    pending?.kind === 'payment' &&
    pending.serviceSessionId.toLowerCase() === session.serviceSessionId.toLowerCase() &&
    operation.serviceSessionId.toLowerCase() === session.serviceSessionId.toLowerCase() &&
    pending.request.operationId.toLowerCase() === operation.operationId.toLowerCase() &&
    ['Quoted', 'Reserved'].includes(operation.state);
  const cashReceived = parseAccountContributionMinor(received, operation.currency);
  const canCollect =
    collected &&
    (operation.paymentMethod !== 'Cash' || (cashReceived !== null && cashReceived >= operation.amountMinor));
  const money = formatAccountPaymentMinor(operation.amountMinor, operation.currency, i18n.language || 'en');
  const allocationScope = mapFrozenAccountPaymentAllocations(operation, session);
  const modeKeys = {
    Items: 'accountPayments.mode_items',
    Equal: 'accountPayments.mode_equal',
    Amount: 'accountPayments.mode_amount',
  } as const;
  const modeLabel = t(modeKeys[operation.mode]);

  return (
    <section className={styles.review} aria-label={t('accountPayments.review')}>
      <h4>{money ?? t('cashier.tables.currency_unknown')}</h4>
      <StatusBadge tone={operation.state === 'Captured' ? 'success' : 'neutral'}>
        {t(`accountPayments.state.${operation.state}`)}
      </StatusBadge>
      <p>{modeLabel}</p>
      {operation.mode === 'Equal' && operation.equalShareOrdinal !== null && (
        <p>{t('accountPayments.share_number', { number: operation.equalShareOrdinal })}</p>
      )}
      <div>
        <h5>{t('accountPayments.frozen_scope')}</h5>
        {allocationScope.complete ? (
          <ul aria-label={t('accountPayments.frozen_scope')}>
            {allocationScope.lines.map((line, index) => (
              <li key={`${line.orderNumber}:${line.startOrdinal}:${index}`}>
                <strong dir="auto">{line.orderNumber}</strong>
                {line.itemName ? (
                  <span dir="auto"> · {line.itemName}</span>
                ) : (
                  <span> · {t('accountPayments.shared_charge')}</span>
                )}
                <div>
                  {t('accountPayments.unit_range', { first: line.startOrdinal, last: line.endOrdinal })} ·{' '}
                  {formatAccountPaymentMinor(line.amountMinor, operation.currency, i18n.language || 'en') ??
                    t('cashier.tables.currency_unknown')}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p role="alert" className={styles.warning}>
            {t('accountPayments.scope_unavailable')}
          </p>
        )}
      </div>
      <p>
        {operation.paymentMethod === 'Cash' ? t('cashier.table_bill.method_cash') : t('payment_card_at_restaurant')}
      </p>
      {unknownWrite && <p className={styles.warning}>{t('accountPayments.result_unknown')}</p>}
      {!terminal && expired && !unknownWrite && <p className={styles.warning}>{t('accountPayments.expired')}</p>}
      {quoted && !unknownWrite && (
        <StaffButton
          variant="primary"
          disabled={disabled || expired || !allocationScope.complete}
          onClick={() => void onReserve()}
        >
          {t('accountPayments.reserve')}
        </StaffButton>
      )}
      {reserved && !unknownWrite && (
        <>
          {operation.paymentMethod === 'Cash' ? (
            <AccountPaymentCashCalculator
              amountMinor={operation.amountMinor}
              currency={operation.currency}
              received={received}
              onChange={setReceived}
              disabled={disabled || expired}
            />
          ) : (
            <p className={styles.note}>{t('cashier.standalone_card_instruction')}</p>
          )}
          <FormField label={t('accountPayments.physical_collection_confirm')}>
            <input
              type="checkbox"
              checked={collected}
              onChange={(event) => setCollected(event.target.checked)}
              disabled={disabled || expired}
            />
          </FormField>
          <StaffButton
            variant="primary"
            disabled={disabled || expired || !allocationScope.complete || !canCollect}
            onClick={() => void onCollect()}
          >
            {t('accountPayments.record_collection')}
          </StaffButton>
        </>
      )}
      {(quoted || reserved) && !unknownWrite && (
        <div className={styles.cancel}>
          <FormField label={t('accountPayments.no_money_collected')}>
            <input
              type="checkbox"
              checked={notCollected}
              onChange={(event) => setNotCollected(event.target.checked)}
              disabled={!canRelease || unknownWrite}
            />
          </FormField>
          <StaffButton disabled={!canRelease || !notCollected || collected} onClick={() => void onRelease()}>
            {t('accountPayments.release')}
          </StaffButton>
        </div>
      )}
      {unknownWrite && (
        <StaffButton
          disabled={releaseUnknown ? !canRelease : !recoveryCollectionEnabled || !allocationScope.complete || !reserved}
          onClick={() => void (collectionUnknown ? onCollect() : onRelease())}
        >
          {t('accountPayments.retry_original')}
        </StaffButton>
      )}
      {!terminal && <StaffButton onClick={() => void onCheck()}>{t('accountPayments.check_result')}</StaffButton>}
    </section>
  );
}
