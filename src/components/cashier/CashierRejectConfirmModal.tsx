'use client';

// The destructive half of the cashier confirm modal (plan S2), split out to keep each file under
// the §4 modal limit. A rejection IS the existing cancel — the guest is told and the order is
// dead — so it gets the shared AlertDialog danger step and a REQUIRED reason, never window.confirm.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import FormField from '@/components/design-system/FormField';
import AlertDialog from '@/components/design-system/AlertDialog';
import { getErrorMessage } from '@/utils/apiClient';
import styles from './CashierConfirmModal.module.css';

const cancellationReasonSchema = z.string().trim().min(1);

interface CashierRejectConfirmModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onReject: (reason: string) => Promise<void>;
  readonly isBusy: boolean;
  readonly isRejection?: boolean;
}

export default function CashierRejectConfirmModal({
  isOpen,
  onClose,
  onReject,
  isBusy,
  isRejection = false,
}: CashierRejectConfirmModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const runReject = async () => {
    const parsed = cancellationReasonSchema.safeParse(reason);
    if (!parsed.success) {
      setError(t('provide_cancellation_reason'));
      return;
    }
    try {
      await onReject(parsed.data);
      setReason('');
      setError(null);
    } catch (error) {
      setError(getErrorMessage(error) ?? t('cashier.reject_order_failed'));
    }
  };

  return (
    <AlertDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => void runReject()}
      title={t(isRejection ? 'cashier.reject_order_confirm_title' : 'cashier.cancel_order_confirm_title')}
      variant="danger"
      confirmLabel={t(isRejection ? 'cashier.reject_order_action' : 'cancel_order')}
      isConfirming={isBusy}
    >
      <p className={styles.alertBody}>{t(isRejection ? 'cashier.reject_order_warning' : 'cancel_order_warning')}</p>
      <FormField label={t('cancellation_reason')} error={error ?? undefined} className={styles.customField}>
        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setError(null);
          }}
          rows={3}
          disabled={isBusy}
          placeholder={t('cancellation_reason_placeholder')}
        />
      </FormField>
    </AlertDialog>
  );
}
