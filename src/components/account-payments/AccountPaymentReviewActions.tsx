'use client';

import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import FormField from '@/components/design-system/FormField';
import StaffButton from '@/components/design-system/StaffButton';
import type { AccountPaymentOperation } from '@/types/accountPayments';
import AccountPaymentCashCalculator from './AccountPaymentCashCalculator';
import styles from './AccountPaymentCollection.module.css';

interface Props {
  readonly operation: AccountPaymentOperation;
  readonly quoted: boolean;
  readonly reserved: boolean;
  readonly legacyCashRelease: boolean;
  readonly collectionUnknown: boolean;
  readonly unknownWrite: boolean;
  readonly releaseUnknown: boolean;
  readonly terminal: boolean;
  readonly cashReconciliationNeeded: boolean;
  readonly allocationScopeComplete: boolean;
  readonly cashDueMinor: number | null;
  readonly cashReceivedMinor: number | null;
  readonly received: string;
  readonly disabled: boolean;
  readonly expired: boolean;
  readonly collected: boolean;
  readonly notCollected: boolean;
  readonly canCollect: boolean;
  readonly canReserve: boolean;
  readonly canRelease: boolean;
  readonly recoveryCollectionEnabled: boolean;
  readonly onReceivedChange: (received: string) => void;
  readonly onCollectedChange: (collected: boolean) => void;
  readonly onNotCollectedChange: (notCollected: boolean) => void;
  readonly onReserve: () => Promise<void>;
  readonly onCollect: (receivedMinor?: number) => Promise<void>;
  readonly onRelease: (noMoneyConfirmed?: boolean) => Promise<void>;
  readonly onCheck: () => Promise<void>;
}

function PaymentWriteActions(props: Props) {
  const { t } = useTranslation();
  let tenderInstructions: ReactNode = null;
  if (props.reserved && !props.unknownWrite && !props.legacyCashRelease) {
    if (props.operation.paymentMethod === 'Cash') {
      if (props.cashDueMinor !== null) {
        tenderInstructions = (
          <AccountPaymentCashCalculator
            dueAmountMinor={props.cashDueMinor}
            currency={props.operation.currency}
            received={props.received}
            onChange={props.onReceivedChange}
            disabled={props.disabled || props.expired}
          />
        );
      }
    } else {
      tenderInstructions = <p className={styles.note}>{t('cashier.standalone_card_instruction')}</p>;
    }
  }

  return (
    <>
      {props.quoted && !props.unknownWrite && (
        <StaffButton variant="primary" disabled={!props.canReserve} onClick={() => void props.onReserve()}>
          {t('accountPayments.reserve')}
        </StaffButton>
      )}
      {props.reserved && !props.unknownWrite && (
        <>
          {tenderInstructions}
          {!props.legacyCashRelease && (
            <>
              <FormField label={t('accountPayments.physical_collection_confirm')}>
                <input
                  type="checkbox"
                  checked={props.collected}
                  onChange={(event) => props.onCollectedChange(event.target.checked)}
                  disabled={props.disabled || props.expired}
                />
              </FormField>
              <StaffButton
                variant="primary"
                disabled={props.disabled || props.expired || !props.allocationScopeComplete || !props.canCollect}
                onClick={() =>
                  void props.onCollect(
                    props.operation.paymentMethod === 'Cash' ? (props.cashReceivedMinor ?? undefined) : undefined,
                  )
                }
              >
                {t('accountPayments.record_collection')}
              </StaffButton>
            </>
          )}
        </>
      )}
    </>
  );
}

function PaymentRecoveryActions(props: Props) {
  const { t } = useTranslation();
  return (
    <>
      {(props.quoted || props.reserved) && !props.unknownWrite && (
        <div className={styles.cancel}>
          <FormField label={t('accountPayments.no_money_collected')}>
            <input
              type="checkbox"
              checked={props.notCollected}
              onChange={(event) => props.onNotCollectedChange(event.target.checked)}
              disabled={!props.canRelease || props.unknownWrite}
            />
          </FormField>
          <StaffButton
            disabled={!props.canRelease || !props.notCollected || props.collected}
            onClick={() => void props.onRelease(props.notCollected)}
          >
            {t('accountPayments.release')}
          </StaffButton>
        </div>
      )}
      {props.unknownWrite && !props.terminal && (
        <StaffButton
          disabled={
            props.releaseUnknown
              ? !props.canRelease
              : !props.recoveryCollectionEnabled || !props.allocationScopeComplete || !props.reserved
          }
          onClick={() => void (props.collectionUnknown ? props.onCollect() : props.onRelease())}
        >
          {t('accountPayments.retry_original')}
        </StaffButton>
      )}
      {(!props.terminal || props.cashReconciliationNeeded) && (
        <StaffButton onClick={() => void props.onCheck()}>{t('accountPayments.check_result')}</StaffButton>
      )}
    </>
  );
}

export default function AccountPaymentReviewActions({
  operation,
  quoted,
  reserved,
  legacyCashRelease,
  collectionUnknown,
  unknownWrite,
  releaseUnknown,
  terminal,
  cashReconciliationNeeded,
  allocationScopeComplete,
  cashDueMinor,
  cashReceivedMinor,
  received,
  disabled,
  expired,
  collected,
  notCollected,
  canCollect,
  canReserve,
  canRelease,
  recoveryCollectionEnabled,
  onReceivedChange,
  onCollectedChange,
  onNotCollectedChange,
  onReserve,
  onCollect,
  onRelease,
  onCheck,
}: Props) {
  return (
    <>
      <PaymentWriteActions
        operation={operation}
        quoted={quoted}
        reserved={reserved}
        legacyCashRelease={legacyCashRelease}
        collectionUnknown={collectionUnknown}
        unknownWrite={unknownWrite}
        releaseUnknown={releaseUnknown}
        terminal={terminal}
        cashReconciliationNeeded={cashReconciliationNeeded}
        allocationScopeComplete={allocationScopeComplete}
        cashDueMinor={cashDueMinor}
        cashReceivedMinor={cashReceivedMinor}
        received={received}
        disabled={disabled}
        expired={expired}
        collected={collected}
        notCollected={notCollected}
        canCollect={canCollect}
        canReserve={canReserve}
        canRelease={canRelease}
        recoveryCollectionEnabled={recoveryCollectionEnabled}
        onReceivedChange={onReceivedChange}
        onCollectedChange={onCollectedChange}
        onNotCollectedChange={onNotCollectedChange}
        onReserve={onReserve}
        onCollect={onCollect}
        onRelease={onRelease}
        onCheck={onCheck}
      />
      <PaymentRecoveryActions
        operation={operation}
        quoted={quoted}
        reserved={reserved}
        legacyCashRelease={legacyCashRelease}
        collectionUnknown={collectionUnknown}
        unknownWrite={unknownWrite}
        releaseUnknown={releaseUnknown}
        terminal={terminal}
        cashReconciliationNeeded={cashReconciliationNeeded}
        allocationScopeComplete={allocationScopeComplete}
        cashDueMinor={cashDueMinor}
        cashReceivedMinor={cashReceivedMinor}
        received={received}
        disabled={disabled}
        expired={expired}
        collected={collected}
        notCollected={notCollected}
        canCollect={canCollect}
        canReserve={canReserve}
        canRelease={canRelease}
        recoveryCollectionEnabled={recoveryCollectionEnabled}
        onReceivedChange={onReceivedChange}
        onCollectedChange={onCollectedChange}
        onNotCollectedChange={onNotCollectedChange}
        onReserve={onReserve}
        onCollect={onCollect}
        onRelease={onRelease}
        onCheck={onCheck}
      />
    </>
  );
}
