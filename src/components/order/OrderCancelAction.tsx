'use client';

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import StaffButton from '@/components/design-system/StaffButton';
import { cancellationReasonMaxLength, orderCancellationSchema } from '@/schemas/orderCancellation.schema';
import { cancelOrder } from '@/services/orderService';
import type { OrderDto } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';
import styles from './OrderCancelAction.module.css';

interface Props {
  readonly order: OrderDto;
  readonly disabled?: boolean;
  readonly onChanged: () => void;
}

export default function OrderCancelAction({ order, disabled = false, onChanged }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const allowed = order.permittedActions?.some((action) => action.action === 'CancelOrder' && action.allowed);
  if (!allowed) return null;

  const confirm = async () => {
    if (inFlight.current || disabled) return;
    const validated = orderCancellationSchema(
      t('staff_cancel_reason_too_long', { max: cancellationReasonMaxLength }),
    ).safeParse({ cancellationReason: reason });
    setReasonError(validated.success ? null : validated.error.issues[0].message);
    if (!validated.success) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await cancelOrder(order.id, { ...validated.data, expectedVersion: order.version });
      setOpen(false);
      setReason('');
      onChanged();
    } catch (failure: unknown) {
      setError(getErrorMessage(failure) ?? t('error_unexpected'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <StaffButton
        disabled={disabled || busy}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {t('cancel_order')}
      </StaffButton>
      <BaseModal
        isOpen={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={t('cancel_order')}
        size="sm"
        isPending={busy}
        footer={
          <>
            <StaffButton disabled={busy} onClick={() => setOpen(false)}>
              {t('back')}
            </StaffButton>
            <StaffButton variant="danger" disabled={busy || disabled} onClick={() => void confirm()}>
              {busy ? t('loading') : t('cancel_order')}
            </StaffButton>
          </>
        }
      >
        <div className={styles.content}>
          <p>{t('staff_cancel_confirm')}</p>
          <FormField label={t('staff_cancel_reason')} error={reasonError ?? undefined}>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={cancellationReasonMaxLength}
              disabled={busy}
              rows={3}
            />
          </FormField>
          {error && <p role="alert">{error}</p>}
        </div>
      </BaseModal>
    </>
  );
}
