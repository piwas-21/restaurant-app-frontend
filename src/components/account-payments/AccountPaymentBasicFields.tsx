'use client';

import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import FormField from '@/components/design-system/FormField';
import StaffButton from '@/components/design-system/StaffButton';
import type { AccountManualPaymentMethod } from '@/types/accountPayments';
import styles from './AccountPaymentCollection.module.css';
import type { AccountPaymentChoice } from './AccountPaymentShareFields';

interface Props {
  readonly choice: AccountPaymentChoice;
  readonly amount: string;
  readonly tip: string;
  readonly method: AccountManualPaymentMethod;
  readonly error: string | null;
  readonly disabled: boolean;
  readonly showTip: boolean;
  readonly canSubmit: boolean;
  readonly isCreatingPlan: boolean;
  readonly children: ReactNode;
  readonly onChoiceChange: (choice: AccountPaymentChoice) => void;
  readonly onAmountChange: (value: string) => void;
  readonly onTipChange: (value: string) => void;
  readonly onMethodChange: (method: AccountManualPaymentMethod) => void;
}

export default function AccountPaymentBasicFields({
  choice,
  amount,
  tip,
  method,
  error,
  disabled,
  showTip,
  canSubmit,
  isCreatingPlan,
  children,
  onChoiceChange,
  onAmountChange,
  onTipChange,
  onMethodChange,
}: Props) {
  const { t } = useTranslation();
  return (
    <>
      <FormField label={t('accountPayments.contribution')}>
        <select
          value={choice}
          onChange={(event) => onChoiceChange(event.target.value as AccountPaymentChoice)}
          disabled={disabled}
        >
          <option value="Full">{t('accountPayments.full_balance')}</option>
          <option value="Items">{t('accountPayments.selected_items')}</option>
          <option value="Amount">{t('accountPayments.custom_amount')}</option>
          <option value="Equal">{t('accountPayments.equal_shares')}</option>
          <option value="CustomAmount">{t('accountPayments.custom_guest_shares')}</option>
        </select>
      </FormField>
      {children}
      {choice === 'Amount' && (
        <FormField label={t('accountPayments.amount')}>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            disabled={disabled}
          />
        </FormField>
      )}
      {showTip && (
        <FormField label={t('cashier.tables.payment_tip')}>
          <input
            inputMode="decimal"
            value={tip}
            onChange={(event) => onTipChange(event.target.value)}
            disabled={disabled}
          />
        </FormField>
      )}
      <FormField label={t('cashier.payment_method')}>
        <select
          value={method}
          onChange={(event) => onMethodChange(event.target.value as AccountManualPaymentMethod)}
          disabled={disabled}
        >
          <option value="Cash">{t('cashier.table_bill.method_cash')}</option>
          <option value="CreditCard">{t('payment_card_at_restaurant')}</option>
        </select>
      </FormField>
      {method === 'CreditCard' && <p className={styles.note}>{t('cashier.standalone_card_instruction')}</p>}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <StaffButton type="submit" variant="primary" disabled={!canSubmit}>
        {isCreatingPlan ? t('accountPayments.create_plan') : t('accountPayments.review')}
      </StaffButton>
    </>
  );
}
