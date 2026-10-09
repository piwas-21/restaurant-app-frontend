'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import CheckboxField from '@/components/design-system/CheckboxField';
import StaffButton from '@/components/design-system/StaffButton';
import { formatAccountPaymentMinor } from '@/lib/accountPaymentMoney';
import { resolutionApprovalFormSchema, type ResolutionApprovalForm } from '@/schemas/amendmentResolutionForm.schema';
import type { AmendmentResolutionQuote } from '@/types/amendmentResolution';
import AmendmentResolutionAmounts from './AmendmentResolutionAmounts';
import styles from './AmendmentResolution.module.css';

interface Props {
  readonly quote: AmendmentResolutionQuote;
  readonly disabled: boolean;
  readonly onSettle: () => Promise<void>;
}

export default function AmendmentResolutionReview({ quote, disabled, onSettle }: Props) {
  const { t, i18n } = useTranslation();
  const tillLegs = quote.refundLegs.filter((leg) => leg.requiresTillConfirmation);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResolutionApprovalForm>({
    resolver: zodResolver(resolutionApprovalFormSchema),
    defaultValues: { acknowledged: false },
  });
  const submit = handleSubmit(async () => onSettle());
  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <AmendmentResolutionAmounts value={quote} />
      <p>{t('orderAmendments.resolution_review_help')}</p>
      <ul className={styles.legs}>
        {quote.refundLegs.map((leg) => (
          <li key={leg.paymentId}>
            <strong>
              {t(
                leg.custody === 'StripeDirect'
                  ? 'orderAmendments.resolution_online'
                  : 'orderAmendments.resolution_till',
              )}
              {' · '}
              {formatAccountPaymentMinor(leg.amountMinor, quote.currency, i18n.language)}
            </strong>
            <span dir="ltr" className={styles.reference}>
              {leg.paymentId}
            </span>
          </li>
        ))}
      </ul>
      {tillLegs.length > 0 && <p className={styles.notice}>{t('orderAmendments.resolution_manual_after_start')}</p>}
      <Controller
        name="acknowledged"
        control={control}
        render={({ field }) => (
          <CheckboxField
            label={t('orderAmendments.resolution_acknowledge')}
            checked={field.value}
            onChange={field.onChange}
            disabled={disabled}
            error={errors.acknowledged ? t('orderAmendments.resolution_acknowledgement_required') : undefined}
          />
        )}
      />
      <p className={styles.muted}>
        {t('orderAmendments.quote_expires', {
          time: new Date(quote.expiresAt).toLocaleTimeString(i18n.language || 'en'),
        })}
      </p>
      <StaffButton type="submit" variant="primary" disabled={disabled}>
        {t('orderAmendments.resolution_confirm')}
      </StaffButton>
    </form>
  );
}
