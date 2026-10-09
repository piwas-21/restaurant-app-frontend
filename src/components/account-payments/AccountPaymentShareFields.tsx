'use client';

import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import type { AccountEqualShareSummary } from '@/types/accountPaymentAccount';
import styles from './AccountPaymentCollection.module.css';

export type AccountPaymentChoice = 'Full' | 'Amount' | 'Items' | 'Equal' | 'CustomAmount';

interface Props {
  readonly choice: AccountPaymentChoice;
  readonly plan: AccountEqualShareSummary | null;
  readonly planMatchesChoice: boolean;
  readonly shares: string;
  readonly customAmounts: string[];
  readonly ordinal: string;
  readonly disabled: boolean;
  readonly maximumShares: number;
  readonly money: (minor: number) => string;
  readonly onSharesChange: (value: string) => void;
  readonly onCustomAmountChange: (index: number, value: string) => void;
  readonly onOrdinalChange: (value: string) => void;
}

export default function AccountPaymentShareFields({
  choice,
  plan,
  planMatchesChoice,
  shares,
  customAmounts,
  ordinal,
  disabled,
  maximumShares,
  money,
  onSharesChange,
  onCustomAmountChange,
  onOrdinalChange,
}: Props) {
  const { t } = useTranslation();
  const splitChoice = choice === 'Equal' || choice === 'CustomAmount';
  if (!splitChoice) return null;

  if (planMatchesChoice && plan) {
    return (
      <FormField label={t('accountPayments.choose_share')}>
        <select value={ordinal} onChange={(event) => onOrdinalChange(event.target.value)} disabled={disabled}>
          <option value="">{t('accountPayments.choose_share')}</option>
          {plan.slots.map((slot) => (
            <option key={slot.ordinal} value={slot.ordinal} disabled={!slot.isAvailable}>
              {t('accountPayments.share_number', { number: slot.ordinal })} · {money(slot.amountMinor)}
              {!slot.isAvailable ? ` · ${t('accountPayments.share_unavailable')}` : ''}
            </option>
          ))}
        </select>
      </FormField>
    );
  }

  return (
    <>
      {plan && <p className={styles.note}>{t('accountPayments.share_plan_will_be_replaced')}</p>}
      <FormField label={t('accountPayments.people')}>
        <input
          type="number"
          min={2}
          max={maximumShares}
          value={shares}
          onChange={(event) => onSharesChange(event.target.value)}
          disabled={disabled}
        />
      </FormField>
      {choice === 'CustomAmount' &&
        Array.from({ length: Math.min(Number(shares) || 0, maximumShares) }, (_, index) => (
          <FormField key={index} label={t('accountPayments.share_amount', { number: index + 1 })}>
            <input
              inputMode="decimal"
              value={customAmounts[index] ?? ''}
              onChange={(event) => onCustomAmountChange(index, event.target.value)}
              disabled={disabled}
            />
          </FormField>
        ))}
    </>
  );
}
