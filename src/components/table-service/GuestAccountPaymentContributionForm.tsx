'use client';

import { useMemo, useState } from 'react';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import type { TableGuestAccountDto } from '@/types/tableGuestVisit';
import type { GuestAccountPaymentAccount, GuestPaymentEqualShareSummary } from '@/types/guestAccountPayments';
import { accountContributionInput, formatAccountPaymentMinor } from '@/lib/accountPaymentMoney';
import type { GuestPaymentQuoteChoice } from '@/hooks/tableGuest/useGuestPaymentContributionActions';
import {
  createGuestAccountPaymentContributionSchema,
  type GuestAccountPaymentContributionFormValues,
  type GuestAccountPaymentContributionQuote,
} from '@/schemas/guestAccountPaymentContribution.schema';
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
  const [shareCount, setShareCount] = useState(Math.min(2, account.limits.maximumEqualShares));
  const [localError, setLocalError] = useState<ContributionError>('');
  const contributionSchema = useMemo(
    () => createGuestAccountPaymentContributionSchema(account, activePlan),
    [account, activePlan],
  );
  const { control, register, watch, setValue, handleSubmit } = useForm<
    GuestAccountPaymentContributionFormValues,
    unknown,
    GuestAccountPaymentContributionQuote
  >({
    resolver: zodResolver(contributionSchema),
    defaultValues: { mode: 'Amount', amountInput: defaultAmount(account), quantities: {}, shareOrdinal: null },
  });
  const mode = watch('mode');
  const quantities = watch('quantities');
  const shareOrdinal = watch('shareOrdinal');
  const onlineLimits = account.limits.online;

  const submit = handleSubmit(
    async (quote) => {
      setLocalError('');
      if (disabled) return;
      await onReview(quote);
    },
    (errors) => setLocalError(toContributionError(contributionMessage(errors, mode))),
  );

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <fieldset className={styles.modes}>
        <legend>{t('table_guest_payment_method')}</legend>
        <div className={styles.modeList}>
          <Controller
            name="mode"
            control={control}
            render={({ field }) => (
              <>
                <ModeOption
                  mode="Amount"
                  selected={field.value}
                  label={t('table_guest_payment_amount')}
                  onChoose={(value) => {
                    field.onChange(value);
                    setLocalError('');
                  }}
                  inputRef={field.ref}
                  name={field.name}
                  onBlur={field.onBlur}
                />
                <ModeOption
                  mode="Items"
                  selected={field.value}
                  label={t('table_guest_payment_items')}
                  onChoose={(value) => {
                    field.onChange(value);
                    setLocalError('');
                  }}
                  inputRef={field.ref}
                  name={field.name}
                  onBlur={field.onBlur}
                />
                <ModeOption
                  mode="Equal"
                  selected={field.value}
                  label={t('table_guest_payment_equal')}
                  onChoose={(value) => {
                    field.onChange(value);
                    setLocalError('');
                  }}
                  inputRef={field.ref}
                  name={field.name}
                  onBlur={field.onBlur}
                />
              </>
            )}
          />
        </div>
      </fieldset>
      {mode === 'Amount' && (
        <FormField label={t('table_guest_payment_amount_label')}>
          <input
            className={styles.amountInput}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            {...register('amountInput', { onChange: () => setLocalError('') })}
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
            onQuantityChange={(key, value) => {
              setValue('quantities', { ...quantities, [key]: value }, { shouldDirty: true });
              setLocalError('');
            }}
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
          onShareOrdinalChange={(value) => {
            setValue('shareOrdinal', value, { shouldDirty: true });
            setLocalError('');
          }}
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
  inputRef,
  name,
  onBlur,
}: Readonly<{
  mode: ContributionMode;
  selected: ContributionMode;
  label: string;
  onChoose: (mode: ContributionMode) => void;
  inputRef: (element: HTMLInputElement | null) => void;
  name: string;
  onBlur: () => void;
}>) {
  return (
    <label className={styles.modeOption}>
      <input
        ref={inputRef}
        type="radio"
        name={name}
        value={mode}
        checked={selected === mode}
        onChange={() => onChoose(mode)}
        onBlur={onBlur}
      />
      <span>{label}</span>
    </label>
  );
}

function defaultAmount(account: GuestAccountPaymentAccount): string {
  const minimum = account.limits.online?.minimumAmountMinor ?? 0;
  return accountContributionInput(minimum) ?? '';
}

function toContributionError(value: string | undefined): Exclude<ContributionError, ''> {
  if (value === 'minimum' || value === 'maximum' || value === 'select_units' || value === 'select_share') return value;
  return 'invalid_amount';
}

function contributionMessage(
  errors: FieldErrors<GuestAccountPaymentContributionFormValues>,
  mode: ContributionMode,
): string | undefined {
  if (mode === 'Amount') return fieldErrorMessage(errors.amountInput);
  if (mode === 'Items') return fieldErrorMessage(errors.quantities);
  return fieldErrorMessage(errors.shareOrdinal);
}

function fieldErrorMessage(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object' || !('message' in value)) return undefined;
  return typeof value.message === 'string' ? value.message : undefined;
}
