'use client';

import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import type { TableGuestAccountDto } from '@/types/tableGuestVisit';
import type { GuestAccountPaymentAccount, GuestPaymentEqualShareSummary } from '@/types/guestAccountPayments';
import { selectAccountPaymentUnits } from '@/lib/accountPaymentSelection';
import {
  accountContributionInput,
  formatAccountPaymentMinor,
  parseAccountContributionMinor,
} from '@/lib/accountPaymentMoney';
import type { GuestPaymentQuoteChoice } from '@/hooks/tableGuest/useGuestPaymentContributionActions';
import { AllocationChoices, EqualShareChoices } from './GuestAccountPaymentChoices';
import styles from './GuestAccountPayment.module.css';

interface GuestAccountPaymentContributionFormProps {
  readonly account: GuestAccountPaymentAccount;
  readonly tableAccount: TableGuestAccountDto | null;
  readonly activePlan: GuestPaymentEqualShareSummary | null;
  readonly disabled: boolean;
  readonly onReview: (quote: GuestPaymentQuoteChoice) => Promise<boolean>;
  readonly onCreatePlan: (shareCount: number) => Promise<boolean>;
}

type ContributionMode = 'Amount' | 'Items' | 'Equal';
type ContributionError = 'invalid_amount' | 'minimum' | 'maximum' | 'select_units' | 'select_share' | '';
const CONTRIBUTION_ERROR_KEYS: Readonly<Record<Exclude<ContributionError, ''>, string>> = {
  invalid_amount: 'table_guest_payment_invalid_amount',
  minimum: 'table_guest_payment_minimum',
  maximum: 'table_guest_payment_maximum',
  select_units: 'table_guest_payment_select_units_required',
  select_share: 'table_guest_payment_select_share',
};

export default function GuestAccountPaymentContributionForm({
  account,
  tableAccount,
  activePlan,
  disabled,
  onReview,
  onCreatePlan,
}: GuestAccountPaymentContributionFormProps) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<ContributionMode>('Amount');
  const [amountInput, setAmountInput] = useState(defaultAmount(account));
  const [quantities, setQuantities] = useState<Readonly<Record<string, number>>>({});
  const [shareCount, setShareCount] = useState(Math.min(2, account.limits.maximumEqualShares));
  const [shareOrdinal, setShareOrdinal] = useState<number | null>(null);
  const [localError, setLocalError] = useState<ContributionError>('');
  const selectedUnits = selectAccountPaymentUnits(
    account.availableAllocations.filter((value) => value.orderItemId !== null),
    quantities,
    account.limits.maximumSelectedUnits,
  );
  const onlineLimits = account.limits.online;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError('');
    if (!onlineLimits) return;
    if (mode === 'Amount') {
      const amountMinor = parseAccountContributionMinor(amountInput, onlineLimits.currency);
      if (amountMinor === null) {
        setLocalError('invalid_amount');
        return;
      }
      if (amountMinor < onlineLimits.minimumAmountMinor) {
        setLocalError('minimum');
        return;
      }
      if (amountMinor > onlineLimits.maximumAmountMinor || amountMinor > account.availableMinor) {
        setLocalError('maximum');
        return;
      }
      await onReview({ mode: 'Amount', paymentMethod: 'OnlinePayment', amountMinor });
      return;
    }
    if (mode === 'Items') {
      if (!selectedUnits) {
        setLocalError('select_units');
        return;
      }
      await onReview({ mode: 'Items', paymentMethod: 'OnlinePayment', selectedUnits });
      return;
    }
    const selectedShare = activePlan?.slots.find((slot) => slot.ordinal === shareOrdinal && slot.isAvailable);
    if (!activePlan || !selectedShare) {
      setLocalError('select_share');
      return;
    }
    if (selectedShare.amountMinor < onlineLimits.minimumAmountMinor) {
      setLocalError('minimum');
      return;
    }
    if (selectedShare.amountMinor > onlineLimits.maximumAmountMinor) {
      setLocalError('maximum');
      return;
    }
    await onReview({
      mode: 'Equal',
      paymentMethod: 'OnlinePayment',
      equalSharePlanId: activePlan.planId,
      equalShareOrdinal: selectedShare.ordinal,
    });
  };

  const chooseMode = (value: ContributionMode) => {
    setMode(value);
    setLocalError('');
  };

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <fieldset className={styles.modes}>
        <legend>{t('table_guest_payment_method')}</legend>
        <div className={styles.modeList}>
          <ModeOption mode="Amount" selected={mode} label={t('table_guest_payment_amount')} onChoose={chooseMode} />
          <ModeOption mode="Items" selected={mode} label={t('table_guest_payment_items')} onChoose={chooseMode} />
          <ModeOption mode="Equal" selected={mode} label={t('table_guest_payment_equal')} onChoose={chooseMode} />
        </div>
      </fieldset>
      {mode === 'Amount' && (
        <FormField label={t('table_guest_payment_amount_label')}>
          <input
            className={styles.amountInput}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            aria-describedby="guest-payment-limits"
          />
        </FormField>
      )}
      {mode === 'Items' && (
        <fieldset className={styles.choices}>
          <legend>{t('table_guest_payment_units')}</legend>
          <AllocationChoices
            account={account}
            tableAccount={tableAccount}
            quantities={quantities}
            onQuantityChange={(key, value) => setQuantities({ ...quantities, [key]: value })}
          />
        </fieldset>
      )}
      {mode === 'Equal' && (
        <EqualShareChoices
          account={account}
          activePlan={activePlan}
          disabled={disabled}
          shareCount={shareCount}
          shareOrdinal={shareOrdinal}
          onShareCountChange={setShareCount}
          onShareOrdinalChange={setShareOrdinal}
          onCreatePlan={onCreatePlan}
        />
      )}
      {onlineLimits && (
        <p id="guest-payment-limits" className={styles.muted}>
          {formatAccountPaymentMinor(onlineLimits.minimumAmountMinor, onlineLimits.currency, i18n.language)}
          {' – '}
          {formatAccountPaymentMinor(onlineLimits.maximumAmountMinor, onlineLimits.currency, i18n.language)}
        </p>
      )}
      {localError && (
        <p className={styles.error} role="alert">
          {t(CONTRIBUTION_ERROR_KEYS[localError])}
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="submit"
          className={`${styles.button} ${styles.primary}`}
          disabled={disabled || !onlineLimits || account.availableMinor <= 0}
        >
          {t('table_guest_payment_review')}
        </button>
      </div>
    </form>
  );
}

function ModeOption({
  mode,
  selected,
  label,
  onChoose,
}: Readonly<{
  mode: ContributionMode;
  selected: ContributionMode;
  label: string;
  onChoose: (mode: ContributionMode) => void;
}>) {
  return (
    <label className={styles.modeOption}>
      <input
        type="radio"
        name="guest-payment-mode"
        value={mode}
        checked={selected === mode}
        onChange={() => onChoose(mode)}
      />
      <span>{label}</span>
    </label>
  );
}

function defaultAmount(account: GuestAccountPaymentAccount): string {
  const minimum = account.limits.online?.minimumAmountMinor ?? 0;
  return accountContributionInput(minimum) ?? '';
}
