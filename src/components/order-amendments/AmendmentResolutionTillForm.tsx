'use client';

import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import CheckboxField from '@/components/design-system/CheckboxField';
import StaffButton from '@/components/design-system/StaffButton';
import { formatAccountPaymentMinor } from '@/lib/accountPaymentMoney';
import { AMENDMENT_TILL_REFERENCE_MAX_LENGTH } from '@/schemas/amendmentResolution.schema';
import { tillRefundFormSchema, type TillRefundForm } from '@/schemas/amendmentResolutionForm.schema';
import type { AmendmentResolutionQuote, AmendmentResolutionTillConfirmations } from '@/types/amendmentResolution';
import styles from './AmendmentResolution.module.css';

interface Props {
  readonly quote: AmendmentResolutionQuote;
  readonly disabled: boolean;
  readonly onConfirm: (confirmations: AmendmentResolutionTillConfirmations) => Promise<void>;
}

/** Only render after the server has accepted and persisted this exact refund operation. */
export default function AmendmentResolutionTillForm({ quote, disabled, onConfirm }: Props) {
  const { t, i18n } = useTranslation();
  const legs = quote.refundLegs.filter((leg) => leg.requiresTillConfirmation);
  const schema = useMemo(() => tillRefundFormSchema(quote), [quote]);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TillRefundForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      acknowledged: false,
      tillConfirmations: legs.map((leg) => ({ paymentId: leg.paymentId, tillReference: '' })),
    },
  });
  const submit = handleSubmit(async ({ tillConfirmations }) => onConfirm(tillConfirmations));
  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <p className={styles.notice}>{t('orderAmendments.resolution_till_help')}</p>
      {legs.map((leg, index) => (
        <FormField
          key={leg.paymentId}
          label={t('orderAmendments.resolution_reference', {
            reference: leg.paymentId,
            amount: formatAccountPaymentMinor(leg.amountMinor, quote.currency, i18n.language),
          })}
          error={
            errors.tillConfirmations?.[index]?.tillReference
              ? t('orderAmendments.resolution_invalid_reference')
              : undefined
          }
        >
          <input
            maxLength={AMENDMENT_TILL_REFERENCE_MAX_LENGTH}
            autoComplete="off"
            disabled={disabled}
            {...register(`tillConfirmations.${index}.tillReference`)}
          />
        </FormField>
      ))}
      <Controller
        name="acknowledged"
        control={control}
        render={({ field }) => (
          <CheckboxField
            label={t('orderAmendments.resolution_acknowledge_till')}
            checked={field.value}
            onChange={field.onChange}
            disabled={disabled}
            error={errors.acknowledged ? t('orderAmendments.resolution_acknowledgement_required') : undefined}
          />
        )}
      />
      <StaffButton type="submit" disabled={disabled} variant="primary">
        {t('orderAmendments.resolution_confirm_till')}
      </StaffButton>
    </form>
  );
}
