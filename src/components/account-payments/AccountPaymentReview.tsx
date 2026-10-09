'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import { formatAccountPaymentMinor, parseAccountContributionMinor } from '@/lib/accountPaymentMoney';
import { canCollectReviewedCash, readAccountCashEvidence } from '@/lib/accountCashEvidence';
import {
  accountCashCollectionMatchesIntent,
  type AccountCashCollectionIntent,
} from '@/lib/accountCashCollectionIntent';
import { mapFrozenAccountPaymentAllocations } from '@/lib/accountPaymentReviewScope';
import { useAccountPaymentExpiry } from '@/hooks/useAccountPaymentExpiry';
import type { AccountPaymentOperation } from '@/types/accountPayments';
import type { PendingAccountPayment } from '@/lib/pendingAccountPayment';
import type { TableServiceSessionDto } from '@/types/order';
import AccountPaymentCashEvidence from './AccountPaymentCashEvidence';
import AccountPaymentReviewActions from './AccountPaymentReviewActions';
import styles from './AccountPaymentCollection.module.css';

function canReleaseReviewedOperation(
  recoveryReleaseEnabled: boolean,
  pending: PendingAccountPayment | null,
  operation: AccountPaymentOperation,
  session: TableServiceSessionDto,
): boolean {
  return (
    recoveryReleaseEnabled &&
    pending?.kind === 'payment' &&
    pending.serviceSessionId.toLowerCase() === session.serviceSessionId.toLowerCase() &&
    operation.serviceSessionId.toLowerCase() === session.serviceSessionId.toLowerCase() &&
    pending.request.operationId.toLowerCase() === operation.operationId.toLowerCase() &&
    ['Quoted', 'Reserved'].includes(operation.state)
  );
}

function isLegacyCashRelease(
  collectionUnknown: boolean,
  operation: AccountPaymentOperation,
  cashIntent: AccountCashCollectionIntent | undefined,
  reserved: boolean,
  canRelease: boolean,
): boolean {
  return collectionUnknown && operation.paymentMethod === 'Cash' && !cashIntent && reserved && canRelease;
}

function canCollectReviewedOperation(
  collected: boolean,
  operation: AccountPaymentOperation,
  cashReceived: number | null,
  cashDueMinor: number | null,
): boolean {
  if (!collected || operation.paymentMethod === 'Cash') {
    return (
      collected &&
      operation.paymentMethod === 'Cash' &&
      cashReceived !== null &&
      cashDueMinor !== null &&
      canCollectReviewedCash(operation, cashReceived)
    );
  }
  return true;
}

function needsCashReconciliation(pending: PendingAccountPayment | null, operation: AccountPaymentOperation): boolean {
  return (
    operation.paymentMethod === 'Cash' &&
    operation.state === 'Captured' &&
    pending?.kind === 'payment' &&
    pending.serviceSessionId.toLowerCase() === operation.serviceSessionId.toLowerCase() &&
    pending.request.operationId.toLowerCase() === operation.operationId.toLowerCase() &&
    (!pending.cashIntent || !accountCashCollectionMatchesIntent(pending.cashIntent, operation))
  );
}

function canReserveReviewedOperation(
  disabled: boolean,
  expired: boolean,
  operation: AccountPaymentOperation,
  allocationScopeComplete: boolean,
  cashEvidenceStatus: 'missing' | 'invalid' | 'valid' | null,
): boolean {
  return (
    !disabled &&
    !expired &&
    allocationScopeComplete &&
    (operation.paymentMethod !== 'Cash' || cashEvidenceStatus === 'valid')
  );
}

interface Props {
  readonly session: TableServiceSessionDto;
  readonly operation: AccountPaymentOperation;
  readonly pending: PendingAccountPayment | null;
  readonly disabled: boolean;
  readonly recoveryReleaseEnabled?: boolean;
  readonly recoveryCollectionEnabled?: boolean;
  readonly onReserve: () => Promise<void>;
  readonly onCollect: (receivedMinor?: number) => Promise<void>;
  readonly onRelease: (noMoneyConfirmed?: boolean) => Promise<void>;
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
  const terminal = ['Captured', 'Released', 'Failed'].includes(operation.state);
  const canRelease = canReleaseReviewedOperation(recoveryReleaseEnabled, pending, operation, session);
  const cashEvidence = operation.paymentMethod === 'Cash' ? readAccountCashEvidence(operation) : null;
  const cashDueMinor = cashEvidence?.status === 'valid' ? cashEvidence.settlement.dueAmountMinor : null;
  const cashReceived = parseAccountContributionMinor(received, operation.currency);
  const cashIntent = pending?.kind === 'payment' ? pending.cashIntent : undefined;
  const legacyCashRelease = isLegacyCashRelease(collectionUnknown, operation, cashIntent, reserved, canRelease);
  const unknownWrite = releaseUnknown || (collectionUnknown && !legacyCashRelease);
  const allocationScope = mapFrozenAccountPaymentAllocations(operation, session);
  const canCollect = canCollectReviewedOperation(collected, operation, cashReceived, cashDueMinor);
  const canReserve = canReserveReviewedOperation(
    disabled,
    expired,
    operation,
    allocationScope.complete,
    cashEvidence?.status ?? null,
  );
  const cashReconciliationNeeded = needsCashReconciliation(pending, operation);
  const money = formatAccountPaymentMinor(operation.amountMinor, operation.currency, i18n.language || 'en');
  const modeKeys = {
    Full: 'accountPayments.mode_full',
    Items: 'accountPayments.mode_items',
    Equal: 'accountPayments.mode_equal',
    Amount: 'accountPayments.mode_amount',
    CustomAmount: 'accountPayments.mode_custom_guest_share',
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
      {operation.mode === 'CustomAmount' && operation.customShareOrdinal !== null && (
        <p>{t('accountPayments.share_number', { number: operation.customShareOrdinal })}</p>
      )}
      {(operation.tipMinor ?? 0) > 0 && (
        <div>
          <p>
            {t('cashier.tables.payment_tip')}:{' '}
            {formatAccountPaymentMinor(operation.tipMinor ?? 0, operation.currency, i18n.language || 'en') ??
              t('cashier.tables.currency_unknown')}
          </p>
          <p className={styles.note}>{t('cashier.tables.tip_food_refund_notice')}</p>
        </div>
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
      {operation.paymentMethod === 'Cash' && (
        <AccountPaymentCashEvidence
          operation={operation}
          intent={cashIntent}
          unattested={cashReconciliationNeeded && !cashIntent}
        />
      )}
      {(unknownWrite || legacyCashRelease) && <p className={styles.warning}>{t('accountPayments.result_unknown')}</p>}
      {!terminal && expired && !unknownWrite && <p className={styles.warning}>{t('accountPayments.expired')}</p>}
      <AccountPaymentReviewActions
        operation={operation}
        quoted={quoted}
        reserved={reserved}
        legacyCashRelease={legacyCashRelease}
        collectionUnknown={collectionUnknown}
        unknownWrite={unknownWrite}
        releaseUnknown={releaseUnknown}
        terminal={terminal}
        cashReconciliationNeeded={cashReconciliationNeeded}
        allocationScopeComplete={allocationScope.complete}
        cashDueMinor={cashDueMinor}
        cashReceivedMinor={cashReceived}
        received={received}
        disabled={disabled}
        expired={expired}
        collected={collected}
        notCollected={notCollected}
        canCollect={canCollect}
        canReserve={canReserve}
        canRelease={canRelease}
        recoveryCollectionEnabled={recoveryCollectionEnabled}
        onReceivedChange={setReceived}
        onCollectedChange={setCollected}
        onNotCollectedChange={setNotCollected}
        onReserve={onReserve}
        onCollect={onCollect}
        onRelease={onRelease}
        onCheck={onCheck}
      />
    </section>
  );
}
