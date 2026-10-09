'use client';

import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import type { AccountPaymentAccount } from '@/types/accountPaymentAccount';
import type {
  AccountManualPaymentMethod,
  CreateAccountEqualSharePlanRequest,
  CreateAccountPaymentQuoteRequest,
} from '@/types/accountPayments';
import type { TableServiceSessionDto } from '@/types/order';
import { accountAllocationKey, selectAccountPaymentUnits } from '@/lib/accountPaymentSelection';
import { formatAccountPaymentMinor, parseAccountContributionMinor } from '@/lib/accountPaymentMoney';
import AccountPaymentBasicFields from './AccountPaymentBasicFields';
import AccountPaymentShareFields, { type AccountPaymentChoice } from './AccountPaymentShareFields';
import styles from './AccountPaymentCollection.module.css';

type PaymentBase = Pick<
  CreateAccountPaymentQuoteRequest,
  'operationId' | 'expectedAccountRevision' | 'paymentMethod' | 'tipMinor'
>;
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
  const [shares, setShares] = useState('2');
  const [ordinal, setOrdinal] = useState('');
  const [customAmounts, setCustomAmounts] = useState<string[]>(['', '']);
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
  const createSharePlan = async () => {
    const shareCount = Number(shares);
    const validShareCount =
      Number.isSafeInteger(shareCount) &&
      shareCount >= 2 &&
      shareCount <= account.limits.maximumEqualShares &&
      shareCount <= account.availableMinor;
    if (!validShareCount) {
      setError(t('accountPayments.invalid_shares'));
      return;
    }
    const request: CreateAccountEqualSharePlanRequest = {
      operationId: crypto.randomUUID(),
      expectedAccountRevision: account.accountRevision,
      shareCount,
      ...(plan ? { supersedesPlanId: plan.planId } : {}),
    };
    if (choice === 'CustomAmount') {
      const amounts = customAmounts
        .slice(0, shareCount)
        .map((value) => parseAccountContributionMinor(value, account.currency));
      const totalAmount = amounts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
      const amountsAreValid =
        amounts.length === shareCount &&
        amounts.every((value) => value !== null && Number.isSafeInteger(value) && value > 0) &&
        Number.isSafeInteger(totalAmount) &&
        totalAmount === account.availableMinor;
      if (!amountsAreValid) {
        setError(t('accountPayments.custom_amounts_must_match_balance'));
        return;
      }
      request.customAmountsMinor = amounts as number[];
    }
    await onPlan(request);
  };

  const quoteShare = async (paymentBase: PaymentBase) => {
    const slot = plan?.slots.find((value) => value.ordinal === Number(ordinal) && value.isAvailable);
    if (!plan || !slot) {
      setError(t('accountPayments.choose_share'));
      return;
    }
    const request =
      choice === 'Equal'
        ? { ...paymentBase, mode: 'Equal' as const, equalSharePlanId: plan.planId, equalShareOrdinal: slot.ordinal }
        : {
            ...paymentBase,
            mode: 'CustomAmount' as const,
            customSharePlanId: plan.planId,
            customShareOrdinal: slot.ordinal,
          };
    await onQuote(request);
  };

  const quoteItems = async (paymentBase: PaymentBase) => {
    const selectedUnits = selectAccountPaymentUnits(
      account.availableAllocations,
      quantities,
      account.limits.maximumSelectedUnits,
    );
    if (!selectedUnits) {
      setError(t('accountPayments.choose_items'));
      return;
    }
    await onQuote({ ...paymentBase, mode: 'Items', selectedUnits });
  };

  const quoteAmount = async (paymentBase: PaymentBase) => {
    const amountMinor = parseAccountContributionMinor(amount, account.currency);
    const amountIsValid = amountMinor !== null && amountMinor > 0 && amountMinor <= account.availableMinor;
    if (!amountIsValid || amountMinor === null) {
      setError(t('accountPayments.invalid_amount'));
      return;
    }
    await onQuote({ ...paymentBase, mode: 'Amount', amountMinor });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    setError(null);
    const base = {
      operationId: crypto.randomUUID(),
      expectedAccountRevision: account.accountRevision,
      paymentMethod: method,
    };
    if (isSplitChoice && !planMatchesChoice) {
      await createSharePlan();
      return;
    }
    const tipMinor = parseAccountContributionMinor(tip || '0', account.currency);
    if (tipMinor === null) {
      setError(t('cashier.table_bill.error.tip'));
      return;
    }
    const paymentBase = { ...base, tipMinor };
    if (isSplitChoice && planMatchesChoice) {
      await quoteShare(paymentBase);
      return;
    }
    if (choice === 'Items') {
      await quoteItems(paymentBase);
      return;
    }
    if (choice === 'Full') {
      await onQuote({ ...paymentBase, mode: 'Full' });
      return;
    }
    await quoteAmount(paymentBase);
  };

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <AccountPaymentBasicFields
        choice={choice}
        amount={amount}
        tip={tip}
        method={method}
        error={error}
        disabled={disabled}
        showTip={choice === 'Full' || choice === 'Amount' || choice === 'Items' || planMatchesChoice}
        canSubmit={!disabled && account.availableMinor > 0}
        isCreatingPlan={isSplitChoice && !planMatchesChoice}
        onChoiceChange={(nextChoice) => {
          setChoice(nextChoice);
          setTip('');
          setError(null);
        }}
        onAmountChange={setAmount}
        onTipChange={setTip}
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
