'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CheckboxField from '@/components/design-system/CheckboxField';
import FormField from '@/components/design-system/FormField';
import type { AccountPaymentAccount } from '@/types/accountPaymentAccount';
import type {
  AccountManualPaymentMethod,
  CreateAccountEqualSharePlanRequest,
  CreateAccountPaymentQuoteRequest,
} from '@/types/accountPayments';
import type { TableServiceSessionDto } from '@/types/order';
import { accountAllocationKey } from '@/lib/accountPaymentSelection';
import {
  accountContributionInput,
  formatAccountPaymentMinor,
  parseAccountContributionMinor,
} from '@/lib/accountPaymentMoney';
import AccountPaymentBasicFields from './AccountPaymentBasicFields';
import AccountPaymentShareFields, { type AccountPaymentChoice } from './AccountPaymentShareFields';
import { useAccountPaymentSelectionSubmit } from '@/hooks/accountPayments/useAccountPaymentSelectionSubmit';
import { accountPaymentItemCheckboxStyles } from './accountPaymentItemCheckboxStyles';
import styles from './AccountPaymentCollection.module.css';
import fields from './AccountPaymentBasicFields.module.css';

interface Props {
  readonly account: AccountPaymentAccount;
  readonly session: TableServiceSessionDto;
  readonly disabled: boolean;
  readonly onQuote: (request: CreateAccountPaymentQuoteRequest) => Promise<void>;
  readonly onPlan: (request: CreateAccountEqualSharePlanRequest) => Promise<void>;
}

export default function AccountPaymentSelectionForm({ account, session, disabled, onQuote, onPlan }: Props) {
  const { t, i18n } = useTranslation();
  const [choice, setChoice] = useState<AccountPaymentChoice>('Full');
  const [method, setMethod] = useState<AccountManualPaymentMethod>('Cash');
  const [amount, setAmount] = useState('');
  const [tip, setTip] = useState('');
  const [tipValid, setTipValid] = useState(true);
  const [shares, setShares] = useState('2');
  const [ordinal, setOrdinal] = useState('');
  const [customAmounts, setCustomAmounts] = useState<string[]>(['', '']);
  const [customSharesAttempted, setCustomSharesAttempted] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const plan = account.activeEqualSharePlan;
  const planMatchesChoice = Boolean(
    plan &&
    (plan.isCustom ?? false) === (choice === 'CustomAmount') &&
    (choice === 'Equal' || choice === 'CustomAmount'),
  );
  const money = (minor: number) =>
    formatAccountPaymentMinor(minor, account.currency, i18n.language || 'en') ?? t('cashier.tables.currency_unknown');
  const items = new Map(
    (session.bill.accountItems ?? []).map((entry) => [`${entry.orderId}:${entry.orderItemId}`, entry]),
  );
  const isSplitChoice = choice === 'Equal' || choice === 'CustomAmount';
  const locale = i18n.language || 'en';
  const customCount = Math.min(Number(shares) || 0, account.limits.maximumEqualShares);
  const customParsed = customAmounts
    .slice(0, customCount)
    .map((value) => parseAccountContributionMinor(value, account.currency, locale));
  const customTotalMinor = customParsed.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const customRemainderMinor = account.availableMinor - customTotalMinor;
  const customErrors = Array.from({ length: customCount }, (_, index) => {
    const value = customAmounts[index] ?? '';
    if (!customSharesAttempted) return undefined;
    if (!value.trim()) return t('accountPayments.custom_share_required', { number: index + 1 });
    const parsed = customParsed[index];
    if (parsed === null) return t('accountPayments.custom_share_invalid');
    return parsed === 0 ? t('accountPayments.custom_share_positive') : undefined;
  });
  const selectedSlot = plan?.slots.find((value) => value.ordinal === Number(ordinal));
  const itemSubtotalMinor = account.availableAllocations.reduce((sum, allocation) => {
    if (allocation.orderItemId === null) return sum;
    return sum + allocation.minorPerUnit * (quantities[accountAllocationKey(allocation)] ?? 0);
  }, 0);
  let tipSubtotalMinor = account.availableMinor;
  if (choice === 'Amount') {
    tipSubtotalMinor = parseAccountContributionMinor(amount, account.currency, locale) ?? 0;
  } else if (choice === 'Items') {
    tipSubtotalMinor = itemSubtotalMinor;
  } else if (choice === 'Equal' || choice === 'CustomAmount') {
    tipSubtotalMinor = selectedSlot?.amountMinor ?? 0;
  }
  const submit = useAccountPaymentSelectionSubmit({
    account,
    choice,
    method,
    amount,
    tip,
    shares,
    ordinal,
    customAmounts,
    quantities,
    locale,
    plan,
    planMatchesChoice,
    tipValid,
    disabled,
    onQuote,
    onPlan,
    onError: setError,
    onCustomSharesAttempted: () => setCustomSharesAttempted(true),
  });

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <AccountPaymentBasicFields
        choice={choice}
        amount={amount}
        tip={tip}
        tipSubtotalMinor={tipSubtotalMinor}
        currency={account.currency}
        locale={locale}
        method={method}
        error={error}
        disabled={disabled}
        showTip={choice === 'Full' || choice === 'Amount' || choice === 'Items' || planMatchesChoice}
        canSubmit={!disabled && account.availableMinor > 0 && tipValid}
        isCreatingPlan={isSplitChoice && !planMatchesChoice}
        onChoiceChange={(nextChoice) => {
          setChoice(nextChoice);
          setTip('');
          setTipValid(true);
          setError(null);
        }}
        onSplitSelect={() => {
          setChoice(plan?.isCustom ? 'CustomAmount' : 'Equal');
          setTip('');
          setTipValid(true);
          setError(null);
        }}
        onAmountChange={setAmount}
        onTipChange={setTip}
        onTipValidityChange={setTipValid}
        onMethodChange={setMethod}
      >
        {choice === 'Full' && <p>{money(account.availableMinor)}</p>}
        {choice === 'Items' && (
          <fieldset disabled={disabled} className={styles.items}>
            <legend>{t('accountPayments.selected_items')}</legend>
            {account.availableAllocations
              .filter((allocation) => allocation.orderItemId !== null)
              .map((allocation) => {
                const key = accountAllocationKey(allocation);
                const entry = items.get(`${allocation.orderId}:${allocation.orderItemId}`);
                const title =
                  entry?.itemSnapshot.productName || entry?.itemSnapshot.menuName || t('cashier.tables.unknown_item');
                const quantity = quantities[key] ?? 0;
                const maximum = Math.min(allocation.unitCount, account.limits.maximumSelectedUnits);
                return (
                  <div
                    key={key}
                    className={quantity > 0 ? `${fields.itemOption} ${fields.itemOptionSelected}` : fields.itemOption}
                  >
                    <CheckboxField
                      styles={accountPaymentItemCheckboxStyles}
                      label={`${title} · ${money(allocation.minorPerUnit)}`}
                      checked={quantity > 0}
                      disabled={disabled}
                      onChange={(checked) => setQuantities((current) => ({ ...current, [key]: checked ? 1 : 0 }))}
                    />
                    {quantity > 0 && maximum > 1 && (
                      <FormField label={t('accountPayments.selected_quantity')} className={fields.itemQuantity}>
                        <input
                          type="number"
                          min={1}
                          max={maximum}
                          value={quantity}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setQuantities((current) => ({
                              ...current,
                              [key]: Number.isSafeInteger(next) ? Math.max(1, Math.min(maximum, next)) : 1,
                            }));
                          }}
                          disabled={disabled}
                        />
                      </FormField>
                    )}
                  </div>
                );
              })}
            <p className={styles.note}>{t('accountPayments.item_remaining_note')}</p>
          </fieldset>
        )}
        <AccountPaymentShareFields
          choice={choice}
          plan={plan}
          planMatchesChoice={planMatchesChoice}
          shares={shares}
          customAmounts={customAmounts}
          ordinal={ordinal}
          disabled={disabled}
          maximumShares={account.limits.maximumEqualShares}
          money={money}
          customErrors={customErrors}
          remainderLabel={
            customRemainderMinor < 0
              ? t('accountPayments.custom_balance_over', { amount: money(Math.abs(customRemainderMinor)) })
              : t('accountPayments.custom_balance_remaining', { amount: money(customRemainderMinor) })
          }
          onFillRemainder={(index) => {
            const otherValues = customAmounts.slice(0, customCount).filter((_, itemIndex) => itemIndex !== index);
            const parsedOthers = otherValues.map((value) =>
              value.trim() ? parseAccountContributionMinor(value, account.currency, locale) : 0,
            );
            if (parsedOthers.includes(null)) {
              setCustomSharesAttempted(true);
              setError(t('accountPayments.custom_amounts_must_match_balance'));
              return;
            }
            const remainder =
              account.availableMinor - parsedOthers.reduce<number>((sum, value) => sum + (value ?? 0), 0);
            if (!Number.isSafeInteger(remainder) || remainder <= 0) {
              setError(t('accountPayments.custom_balance_over', { amount: money(Math.abs(remainder)) }));
              return;
            }
            setCustomAmounts((current) => {
              const next = [...current];
              next[index] = accountContributionInput(remainder) ?? '';
              return next;
            });
            setCustomSharesAttempted(true);
            setError(null);
          }}
          onSharesChange={setShares}
          onCustomAmountChange={(index, value) =>
            setCustomAmounts((current) => {
              const next = [...current];
              next[index] = value;
              return next;
            })
          }
          onOrdinalChange={setOrdinal}
        />
        {choice === 'Equal' && <p className={styles.note}>{t('accountPayments.equal_note')}</p>}
      </AccountPaymentBasicFields>
    </form>
  );
}
