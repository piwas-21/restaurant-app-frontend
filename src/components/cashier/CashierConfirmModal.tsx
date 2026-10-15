'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import type { OrderDto } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';
import { customMinutesSchema, PRESET_MINUTES } from './cashierConfirmModalConfig';
import CashierRejectConfirmModal from './CashierRejectConfirmModal';
import CashierApprovalOrderDetails from './CashierApprovalOrderDetails';
import styles from './CashierConfirmModal.module.css';

interface CashierConfirmModalProps {
  readonly order: OrderDto | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (orderId: string, preparationMinutes: number | null) => Promise<void>;
  readonly onReject: (orderId: string, reason: string) => Promise<void>;
  /** The tenant's flow for THIS order's type; unknown/unavailable reads as direct. */
  readonly confirmationFlow?: 'direct' | 'acknowledge';
}

export default function CashierConfirmModal({
  order,
  isOpen,
  onClose,
  onConfirm,
  onReject,
  confirmationFlow = 'direct',
}: CashierConfirmModalProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [cancelStepOpen, setCancelStepOpen] = useState(false);
  const isReviewFlow = confirmationFlow === 'acknowledge';
  const defaultPreparationMinutes =
    typeof order?.effectivePreparationMinutes === 'number' && order.effectivePreparationMinutes >= 0
      ? order.effectivePreparationMinutes
      : null;
  const primaryActionLabel =
    defaultPreparationMinutes !== null
      ? t(isReviewFlow ? 'cashier.approve_with_preparation' : 'cashier.confirm_with_estimated_preparation', {
          minutes: defaultPreparationMinutes,
        })
      : t(isReviewFlow ? 'cashier.approve_order_action' : 'cashier.confirm_order_action');

  useEffect(() => {
    if (isOpen) return;
    setActionError(null);
    setCustomError(null);
    setCustomMinutes('');
    setCancelStepOpen(false);
  }, [isOpen]);

  const runConfirm = async (preparationMinutes: number | null) => {
    if (!order) return;
    setBusy(true);
    setActionError(null);
    try {
      await onConfirm(order.id, preparationMinutes);
      setCustomMinutes('');
      onClose();
    } catch (error) {
      setActionError(getErrorMessage(error) ?? t('cashier.approve_order_failed'));
    } finally {
      setBusy(false);
    }
  };

  const submitCustom = () => {
    const parsed = customMinutesSchema.safeParse({ minutes: customMinutes });
    if (!parsed.success) {
      setCustomError(t('cashier.confirm_custom_minutes_invalid'));
      return;
    }
    setCustomError(null);
    void runConfirm(parsed.data.minutes);
  };

  const runReject = async (reason: string) => {
    if (!order) return;
    setBusy(true);
    setActionError(null);
    try {
      await onReject(order.id, reason);
      setCancelStepOpen(false);
      onClose();
    } finally {
      // Let the nested danger step catch a failed request and keep its required reason visible;
      // swallowing here made it look successful and erased the cashier's text.
      setBusy(false);
    }
  };

  return (
    <>
      <BaseModal
        isOpen={isOpen && Boolean(order)}
        onClose={onClose}
        title={confirmationFlow === 'acknowledge' ? t('cashier.approve_order_title') : t('cashier.confirm_order_title')}
        size="lg"
        isPending={busy}
        footer={
          <div className={styles.footerActions}>
            <button
              type="button"
              className={`${styles.actionButton} ${styles.primaryAction}`}
              onClick={() => void runConfirm(defaultPreparationMinutes)}
              disabled={busy}
            >
              {primaryActionLabel}
            </button>
            <button
              type="button"
              className={`${styles.actionButton} ${styles.dangerAction}`}
              onClick={() => setCancelStepOpen(true)}
              disabled={busy}
            >
              {t(isReviewFlow ? 'cashier.reject_order_action' : 'cancel_order')}
            </button>
          </div>
        }
      >
        <div className={styles.body}>
          {order && <CashierApprovalOrderDetails order={order} preparationMinutes={defaultPreparationMinutes} />}

          {actionError && (
            <p className={styles.actionError} role="alert">
              {actionError}
            </p>
          )}

          <p className={styles.sectionLabel}>
            {t(isReviewFlow ? 'cashier.choose_preparation_time' : 'cashier.confirm_with_preparation')}
          </p>
          <div className={styles.presets}>
            {PRESET_MINUTES.map((minutes) => (
              <button
                type="button"
                key={minutes}
                className={styles.actionButton}
                onClick={() => void runConfirm(minutes)}
                disabled={busy}
              >
                {t(isReviewFlow ? 'cashier.approve_preset_minutes' : 'cashier.confirm_preset_minutes', { minutes })}
              </button>
            ))}
          </div>

          <FormField label={t('custom_minutes')} error={customError ?? undefined} className={styles.customField}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              value={customMinutes}
              onChange={(event) => {
                setCustomMinutes(event.target.value);
                setCustomError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitCustom();
              }}
              disabled={busy}
            />
          </FormField>
          <button
            type="button"
            className={`${styles.actionButton} ${isReviewFlow ? styles.primaryAction : ''}`}
            onClick={submitCustom}
            disabled={busy}
          >
            {t(isReviewFlow ? 'cashier.approve_order_action' : 'common.confirm')}
          </button>
        </div>
      </BaseModal>

      <CashierRejectConfirmModal
        isOpen={cancelStepOpen}
        onClose={() => setCancelStepOpen(false)}
        onReject={(reason) => runReject(reason)}
        isBusy={busy}
        isRejection={isReviewFlow}
      />
    </>
  );
}
