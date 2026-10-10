'use client';

import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import FormField from '@/components/design-system/FormField';
import StaffButton from '@/components/design-system/StaffButton';
import TipSelector from '@/components/checkout/TipSelector';
import { accountContributionInput, parseAccountContributionMinor } from '@/lib/accountPaymentMoney';
import type { AccountManualPaymentMethod } from '@/types/accountPayments';
import styles from './AccountPaymentCollection.module.css';
import fields from './AccountPaymentBasicFields.module.css';
import type { AccountPaymentChoice } from './AccountPaymentShareFields';

interface Props {
  readonly choice: AccountPaymentChoice;
  readonly amount: string;
  readonly tip: string;
  readonly tipSubtotalMinor: number;
  readonly currency: string;
  readonly locale: string;
  readonly method: AccountManualPaymentMethod;
  readonly error: string | null;
  readonly disabled: boolean;
  readonly showTip: boolean;
  readonly canSubmit: boolean;
  readonly isCreatingPlan: boolean;
  readonly children: ReactNode;
  readonly onChoiceChange: (choice: AccountPaymentChoice) => void;
  readonly onSplitSelect: () => void;
  readonly onAmountChange: (value: string) => void;
  readonly onTipChange: (value: string) => void;
  readonly onTipValidityChange: (valid: boolean) => void;
  readonly onMethodChange: (method: AccountManualPaymentMethod) => void;
}

export default function AccountPaymentBasicFields({
  choice,
  amount,
  tip,
  tipSubtotalMinor,
  currency,
  locale,
  method,
  error,
  disabled,
  showTip,
  canSubmit,
  isCreatingPlan,
  children,
  onChoiceChange,
  onSplitSelect,
  onAmountChange,
  onTipChange,
  onTipValidityChange,
  onMethodChange,
}: Props) {
  const { t } = useTranslation();
  const splitSelected = choice === 'Equal' || choice === 'CustomAmount';

  return (
    <>
      <fieldset className={fields.choiceGroup} disabled={disabled}>
        <legend>{t('accountPayments.contribution')}</legend>
        <div className={fields.choiceTiles}>
          <label className={`${fields.choiceTile} ${choice === 'Full' ? fields.choiceTileSelected : ''}`}>
            <input
              className={fields.choiceRadio}
              type="radio"
              name="account-payment-choice"
              value="Full"
              checked={choice === 'Full'}
              onChange={() => onChoiceChange('Full')}
            />
            <span>{t('accountPayments.full_balance')}</span>
          </label>
          <label className={`${fields.choiceTile} ${choice === 'Items' ? fields.choiceTileSelected : ''}`}>
            <input
              className={fields.choiceRadio}
              type="radio"
              name="account-payment-choice"
              value="Items"
              checked={choice === 'Items'}
              onChange={() => onChoiceChange('Items')}
            />
            <span>{t('accountPayments.selected_items')}</span>
          </label>
          <label className={`${fields.choiceTile} ${choice === 'Amount' ? fields.choiceTileSelected : ''}`}>
            <input
              className={fields.choiceRadio}
              type="radio"
              name="account-payment-choice"
              value="Amount"
              checked={choice === 'Amount'}
              onChange={() => onChoiceChange('Amount')}
            />
            <span>{t('accountPayments.custom_amount')}</span>
          </label>
          <label className={`${fields.choiceTile} ${splitSelected ? fields.choiceTileSelected : ''}`}>
            <input
              className={fields.choiceRadio}
              type="radio"
              name="account-payment-choice"
              value="Split"
              checked={splitSelected}
              onChange={onSplitSelect}
            />
            <span>{t('accountPayments.split')}</span>
          </label>
        </div>
      </fieldset>
      {splitSelected && (
        <fieldset className={fields.splitGroup} disabled={disabled}>
          <legend>{t('accountPayments.split_type')}</legend>
          <div className={fields.splitTiles}>
            <label className={`${fields.choiceTile} ${choice === 'Equal' ? fields.choiceTileSelected : ''}`}>
              <input
                className={fields.choiceRadio}
                type="radio"
                name="account-payment-split-type"
                value="Equal"
                checked={choice === 'Equal'}
                onChange={() => onChoiceChange('Equal')}
              />
              <span>{t('accountPayments.equal_shares')}</span>
            </label>
            <label className={`${fields.choiceTile} ${choice === 'CustomAmount' ? fields.choiceTileSelected : ''}`}>
              <input
                className={fields.choiceRadio}
                type="radio"
                name="account-payment-split-type"
                value="CustomAmount"
                checked={choice === 'CustomAmount'}
                onChange={() => onChoiceChange('CustomAmount')}
              />
              <span>{t('accountPayments.custom_guest_shares')}</span>
            </label>
          </div>
        </fieldset>
      )}
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
        <details className={fields.tipDetails}>
          <summary>{t('accountPayments.add_optional_tip')}</summary>
          <TipSelector
            key={choice}
            subtotal={tipSubtotalMinor / 100}
            selectedTipAmount={(parseAccountContributionMinor(tip || '0', currency, locale) ?? 0) / 100}
            onTipChange={(value) => onTipChange(accountContributionInput(Math.round(value * 100)) ?? '')}
            onValidityChange={onTipValidityChange}
            currency={currency}
            locale={locale}
            disabled={disabled}
          />
        </details>
      )}
      <fieldset className={fields.methodGroup} disabled={disabled}>
        <legend>{t('cashier.payment_method')}</legend>
        <div className={fields.paymentMethods}>
          <label className={`${fields.methodTile} ${method === 'Cash' ? fields.choiceTileSelected : ''}`}>
            <input
              className={fields.choiceRadio}
              type="radio"
              name="account-payment-method"
              value="Cash"
              checked={method === 'Cash'}
              onChange={() => onMethodChange('Cash')}
            />
            <span>{t('accountPayments.method_cash')}</span>
          </label>
          <label className={`${fields.methodTile} ${method === 'CreditCard' ? fields.choiceTileSelected : ''}`}>
            <input
              className={fields.choiceRadio}
              type="radio"
              name="account-payment-method"
              value="CreditCard"
              checked={method === 'CreditCard'}
              onChange={() => onMethodChange('CreditCard')}
            />
            <span>{t('accountPayments.method_card')}</span>
          </label>
        </div>
      </fieldset>
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
