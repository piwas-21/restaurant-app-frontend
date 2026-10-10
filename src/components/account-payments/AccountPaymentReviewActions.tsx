'use client';

import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import CheckboxField from '@/components/design-system/CheckboxField';
import StaffButton from '@/components/design-system/StaffButton';
import type { AccountPaymentOperation } from '@/types/accountPayments';
import AccountPaymentCashCalculator from './AccountPaymentCashCalculator';
import styles from './AccountPaymentCollection.module.css';

interface SharedActionProps {
  readonly quoted: boolean;
  readonly reserved: boolean;
  readonly unknownWrite: boolean;
  readonly allocationScopeComplete: boolean;
  readonly collected: boolean;
  readonly onCollect: (receivedMinor?: number) => Promise<void>;
}

interface WriteActionProps extends SharedActionProps {
  readonly operation: AccountPaymentOperation;
  readonly legacyCashRelease: boolean;
  readonly cashDueMinor: number | null;
  readonly cashReceivedMinor: number | null;
  readonly received: string;
  readonly disabled: boolean;
  readonly expired: boolean;
  readonly canCollect: boolean;
  readonly canReserve: boolean;
  readonly onReceivedChange: (received: string) => void;
  readonly onReserve: () => Promise<void>;
}

interface RecoveryActionProps extends SharedActionProps {
  readonly collectionUnknown: boolean;
  readonly reserveUnknown: boolean;
  readonly releaseUnknown: boolean;
  readonly terminal: boolean;
  readonly cashReconciliationNeeded: boolean;
  readonly notCollected: boolean;
  readonly canRelease: boolean;
  readonly recoveryCollectionEnabled: boolean;
  readonly onNotCollectedChange: (notCollected: boolean) => void;
  readonly onRelease: (noMoneyConfirmed?: boolean) => Promise<void>;
  readonly onCheck: () => Promise<void>;
}

type Props = WriteActionProps & RecoveryActionProps;

function PaymentWriteActions(props: WriteActionProps) {
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
            <StaffButton
              variant="primary"
              disabled={props.disabled || props.expired || !props.allocationScopeComplete || !props.canCollect}
              onClick={() =>
                void props.onCollect(
                  props.operation.paymentMethod === 'Cash' ? (props.cashReceivedMinor ?? undefined) : undefined,
                )
              }
            >
              {t(
                props.operation.paymentMethod === 'Cash'
                  ? 'accountPayments.record_cash_received'
                  : 'accountPayments.record_terminal_payment',
              )}
            </StaffButton>
          )}
        </>
      )}
    </>
  );
}

function PaymentRecoveryActions(props: RecoveryActionProps) {
  const { t } = useTranslation();
  return (
    <>
      {(props.quoted || props.reserved) && !props.unknownWrite && (
        <div className={styles.cancel}>
          <CheckboxField
            label={t('accountPayments.no_money_collected')}
            checked={props.notCollected}
            onChange={props.onNotCollectedChange}
            disabled={!props.canRelease || props.unknownWrite}
          />
          <StaffButton
            disabled={!props.canRelease || !props.notCollected || props.collected}
            onClick={() => void props.onRelease(props.notCollected)}
          >
            {t('accountPayments.release')}
          </StaffButton>
        </div>
      )}
      {props.unknownWrite && !props.reserveUnknown && !props.terminal && (
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
  reserveUnknown,
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
        unknownWrite={unknownWrite}
        allocationScopeComplete={allocationScopeComplete}
        cashDueMinor={cashDueMinor}
        cashReceivedMinor={cashReceivedMinor}
        received={received}
        disabled={disabled}
        expired={expired}
        collected={collected}
        canCollect={canCollect}
        canReserve={canReserve}
        onReceivedChange={onReceivedChange}
        onReserve={onReserve}
        onCollect={onCollect}
      />
      <PaymentRecoveryActions
        quoted={quoted}
        reserved={reserved}
        collectionUnknown={collectionUnknown}
        reserveUnknown={reserveUnknown}
        unknownWrite={unknownWrite}
        releaseUnknown={releaseUnknown}
        terminal={terminal}
        cashReconciliationNeeded={cashReconciliationNeeded}
        allocationScopeComplete={allocationScopeComplete}
        collected={collected}
        notCollected={notCollected}
        canRelease={canRelease}
        recoveryCollectionEnabled={recoveryCollectionEnabled}
        onNotCollectedChange={onNotCollectedChange}
        onCollect={onCollect}
        onRelease={onRelease}
        onCheck={onCheck}
      />
    </>
  );
}
