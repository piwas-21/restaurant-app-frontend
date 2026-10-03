'use client';

import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import StaffButton from '@/components/design-system/StaffButton';
import type { AccountPaymentAccount } from '@/types/accountPaymentAccount';
import type {
  AccountManualPaymentMethod,
  CreateAccountEqualSharePlanRequest,
  CreateAccountPaymentQuoteRequest,
} from '@/types/accountPayments';
import type { TableServiceSessionDto } from '@/types/order';
import { accountAllocationKey, selectAccountPaymentUnits } from '@/lib/accountPaymentSelection';
import { formatAccountPaymentMinor, parseAccountContributionMinor } from '@/lib/accountPaymentMoney';
import styles from './AccountPaymentCollection.module.css';

type Choice = 'Full' | 'Amount' | 'Items' | 'Equal';
interface Props {
  readonly account: AccountPaymentAccount;
  readonly session: TableServiceSessionDto;
  readonly disabled: boolean;
  readonly onQuote: (request: CreateAccountPaymentQuoteRequest) => Promise<void>;
  readonly onPlan: (request: CreateAccountEqualSharePlanRequest) => Promise<void>;
}

export default function AccountPaymentSelectionForm({ account, session, disabled, onQuote, onPlan }: Props) {
  const { t, i18n } = useTranslation();
  const [choice, setChoice] = useState<Choice>('Full');
  const [method, setMethod] = useState<AccountManualPaymentMethod>('Cash');
  const [amount, setAmount] = useState('');
  const [shares, setShares] = useState('2');
  const [ordinal, setOrdinal] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const plan = account.activeEqualSharePlan;
  const money = (minor: number) =>
    formatAccountPaymentMinor(minor, account.currency, i18n.language || 'en') ?? t('cashier.tables.currency_unknown');
  const items = new Map(
    (session.bill.accountItems ?? []).map((entry) => [`${entry.orderId}:${entry.orderItemId}`, entry]),
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    setError(null);
    const base = {
      operationId: crypto.randomUUID(),
      expectedAccountRevision: account.accountRevision,
      paymentMethod: method,
    };
    if (choice === 'Equal' && !plan) {
      const shareCount = Number(shares);
      if (
        !Number.isSafeInteger(shareCount) ||
        shareCount < 2 ||
        shareCount > account.limits.maximumEqualShares ||
        shareCount > account.availableMinor
      ) {
        setError(t('accountPayments.invalid_shares'));
        return;
      }
      await onPlan({ operationId: base.operationId, expectedAccountRevision: account.accountRevision, shareCount });
      return;
    }
    if (choice === 'Equal' && plan) {
      const slot = plan.slots.find((value) => value.ordinal === Number(ordinal) && value.isAvailable);
      if (!slot) {
        setError(t('accountPayments.choose_share'));
        return;
      }
      await onQuote({ ...base, mode: 'Equal', equalSharePlanId: plan.planId, equalShareOrdinal: slot.ordinal });
      return;
    }
    if (choice === 'Items') {
      const selectedUnits = selectAccountPaymentUnits(
        account.availableAllocations,
        quantities,
        account.limits.maximumSelectedUnits,
      );
      if (!selectedUnits) {
        setError(t('accountPayments.choose_items'));
        return;
      }
      await onQuote({ ...base, mode: 'Items', selectedUnits });
      return;
    }
    const amountMinor =
      choice === 'Full' ? account.availableMinor : parseAccountContributionMinor(amount, account.currency);
    if (amountMinor === null || amountMinor <= 0 || amountMinor > account.availableMinor) {
      setError(t('accountPayments.invalid_amount'));
      return;
    }
    await onQuote({ ...base, mode: 'Amount', amountMinor });
  };

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <FormField label={t('accountPayments.contribution')}>
        <select
          value={choice}
          onChange={(event) => {
            setChoice(event.target.value as Choice);
            setError(null);
          }}
          disabled={disabled}
        >
          <option value="Full">{t('accountPayments.full_balance')}</option>
          <option value="Items">{t('accountPayments.selected_items')}</option>
          <option value="Amount">{t('accountPayments.custom_amount')}</option>
          <option value="Equal">{t('accountPayments.equal_shares')}</option>
        </select>
      </FormField>
      {choice === 'Full' && <p>{money(account.availableMinor)}</p>}
      {choice === 'Amount' && (
        <FormField label={t('accountPayments.amount')}>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={disabled}
          />
        </FormField>
      )}
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
              return (
                <FormField key={key} label={`${title} · ${money(allocation.minorPerUnit)}`}>
                  <input
                    type="number"
                    min={0}
                    max={Math.min(allocation.unitCount, account.limits.maximumSelectedUnits)}
                    value={quantities[key] ?? 0}
                    onChange={(event) =>
                      setQuantities((current) => ({ ...current, [key]: Number(event.target.value) }))
                    }
                  />
                </FormField>
              );
            })}
          <p className={styles.note}>{t('accountPayments.item_remaining_note')}</p>
        </fieldset>
      )}
      {choice === 'Equal' &&
        (plan ? (
          <FormField label={t('accountPayments.choose_share')}>
            <select value={ordinal} onChange={(event) => setOrdinal(event.target.value)} disabled={disabled}>
              <option value="">{t('accountPayments.choose_share')}</option>
              {plan.slots.map((slot) => (
                <option key={slot.ordinal} value={slot.ordinal} disabled={!slot.isAvailable}>
                  {t('accountPayments.share_number', { number: slot.ordinal })} · {money(slot.amountMinor)}
                  {!slot.isAvailable ? ` · ${t('accountPayments.share_unavailable')}` : ''}
                </option>
              ))}
            </select>
          </FormField>
        ) : (
          <FormField label={t('accountPayments.people')}>
            <input
              type="number"
              min={2}
              max={account.limits.maximumEqualShares}
              value={shares}
              onChange={(event) => setShares(event.target.value)}
              disabled={disabled}
            />
          </FormField>
        ))}
      {choice === 'Equal' && <p className={styles.note}>{t('accountPayments.equal_note')}</p>}
      <FormField label={t('cashier.payment_method')}>
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value as AccountManualPaymentMethod)}
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
      <StaffButton type="submit" variant="primary" disabled={disabled || account.availableMinor <= 0}>
        {choice === 'Equal' && !plan ? t('accountPayments.create_plan') : t('accountPayments.review')}
      </StaffButton>
    </form>
  );
}
