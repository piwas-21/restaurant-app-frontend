'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import StaffButton from '@/components/design-system/StaffButton';
import { formatAccountPaymentMinor, parseAccountContributionMinor } from '@/lib/accountPaymentMoney';
import { manualRefundFormSchema, type ManualRefundForm } from '@/schemas/amendmentResolutionForm.schema';
import type { AmendmentResolutionContext } from '@/schemas/amendmentResolutionContext.schema';
import type { AmendmentResolutionQuoteRequest } from '@/types/amendmentResolution';
import styles from './AmendmentResolution.module.css';

interface Props {
  readonly context: AmendmentResolutionContext;
  readonly disabled: boolean;
  readonly onReview: (request: Omit<AmendmentResolutionQuoteRequest, 'clientOperationId'>) => Promise<void>;
}

export default function AmendmentResolutionManualForm({ context, disabled, onReview }: Props) {
  const { t, i18n } = useTranslation();
  const schema = useMemo(() => manualRefundFormSchema(context), [context]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ManualRefundForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      payments: context.manualRefundCandidates.map((payment) => ({ paymentId: payment.paymentId, amount: '' })),
    },
  });
  const submit = handleSubmit(async ({ payments }) => {
    const manualRefunds = payments.flatMap((payment) => {
      if (payment.amount.trim() === '') return [];
      const amountMinor = parseAccountContributionMinor(payment.amount, context.currency);
      return amountMinor !== null && amountMinor > 0 ? [{ paymentId: payment.paymentId, amountMinor }] : [];
    });
    await onReview({
      expectedOrderVersion: context.expectedOrderVersion,
      expectedAccountRevision: context.expectedAccountRevision ?? null,
      currency: context.currency,
      manualRefunds,
    });
  });
  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <p>{t('orderAmendments.resolution_manual_help')}</p>
      {context.manualRefundCandidates.map((payment, index) => {
        const method = t(
          payment.paymentMethod === 'Cash' ? 'orderAmendments.resolution_cash' : 'orderAmendments.resolution_card',
        );
        const amount = formatAccountPaymentMinor(payment.availableMinor, context.currency, i18n.language);
        return (
          <FormField
            key={payment.paymentId}
            label={t('orderAmendments.resolution_manual_amount', { method, amount, reference: payment.paymentId })}
            error={errors.payments?.[index]?.amount ? t('orderAmendments.resolution_invalid_amount') : undefined}
          >
            <input
              inputMode="decimal"
              autoComplete="off"
              disabled={disabled}
              {...register(`payments.${index}.amount`)}
            />
          </FormField>
        );
      })}
      {errors.payments?.message && (
        <p className={styles.error} role="alert">
          {t('orderAmendments.resolution_invalid_amount')}
        </p>
      )}
      <StaffButton type="submit" variant="primary" disabled={disabled}>
        {t('orderAmendments.resolution_review')}
      </StaffButton>
    </form>
  );
}
