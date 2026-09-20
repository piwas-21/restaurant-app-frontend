'use client';

// Pending delivery/takeaway decision: approve/confirm now, set preparation time, or reject.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import type { OrderDto } from '@/types/order';
import { formatCurrency } from '@/utils/currency';
import { getErrorMessage } from '@/utils/apiClient';
import CashierRejectConfirmModal from './CashierRejectConfirmModal';
import styles from './CashierConfirmModal.module.css';

const customMinutesSchema = z.object({ minutes: z.coerce.number().int().min(1).max(600) });

const PRESET_MINUTES = [15, 30, 45];

interface CashierConfirmModalProps {
  readonly order: OrderDto | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (orderId: string, preparationMinutes: number) => Promise<void>;
  readonly onReject: (orderId: string, reason: string) => Promise<void>;
  /** The tenant's flow for THIS order's type; unknown/unavailable reads as direct. */
  readonly confirmationFlow?: 'direct' | 'acknowledge';
}

function channelLabel(type: string, t: (key: string) => string): string {
  if (type === 'DineIn') return t('cashier.workspace.channel_dine_in');
  if (type === 'Delivery') return t('cashier.workspace.channel_delivery');
  if (type === 'Takeaway') return t('cashier.workspace.channel_takeaway');
  return type;
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

  useEffect(() => {
    if (isOpen) return;
    setActionError(null);
    setCustomError(null);
    setCustomMinutes('');
    setCancelStepOpen(false);
  }, [isOpen]);

  const runConfirm = async (preparationMinutes: number) => {
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

  const summary = [
    { label: t('order_number'), value: order?.orderNumber ?? '' },
    { label: t('type'), value: order ? channelLabel(order.type, t) : '' },
    { label: t('customer'), value: order?.customerName || t('cashier.workspace.guest') },
    ...(order?.customerPhone ? [{ label: t('phone'), value: order.customerPhone }] : []),
    { label: t('cashier.workspace.order_total'), value: order ? formatCurrency(order.total) : '' },
  ];

  return (
    <>
      <BaseModal
        isOpen={isOpen && Boolean(order)}
        onClose={onClose}
        title={confirmationFlow === 'acknowledge' ? t('cashier.approve_order_title') : t('cashier.confirm_order_title')}
        size="sm"
        isPending={busy}
      >
        <div className={styles.body}>
          <dl className={styles.summary}>
            {summary.map((row) => (
              <div key={row.label} className={styles.summaryRow}>
                <dt>{row.label}</dt>
                <dd dir="auto">{row.value}</dd>
              </div>
            ))}
          </dl>

          {actionError && (
            <p className={styles.actionError} role="alert">
              {actionError}
            </p>
          )}

          <button
            type="button"
            className={`${styles.actionButton} ${styles.primaryAction}`}
            onClick={() => void runConfirm(0)}
            disabled={busy}
          >
            {t('cashier.confirm_now')}
          </button>

          <div className={styles.divider} role="separator" />

          <p className={styles.sectionLabel}>{t('cashier.confirm_with_preparation')}</p>
          <div className={styles.presets}>
            {PRESET_MINUTES.map((minutes) => (
              <button
                type="button"
                key={minutes}
                className={styles.actionButton}
                onClick={() => void runConfirm(minutes)}
                disabled={busy}
              >
                {t('cashier.confirm_preset_minutes', { minutes })}
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
          <button type="button" className={styles.actionButton} onClick={submitCustom} disabled={busy}>
            {t('common.confirm')}
          </button>

          <div className={`${styles.divider} ${styles.dividerDanger}`} role="separator" />

          <button
            type="button"
            className={`${styles.actionButton} ${styles.dangerAction}`}
            onClick={() => setCancelStepOpen(true)}
            disabled={busy}
          >
            {t('cancel_order')}
          </button>
        </div>
      </BaseModal>

      <CashierRejectConfirmModal
        isOpen={cancelStepOpen}
        onClose={() => setCancelStepOpen(false)}
        onReject={(reason) => runReject(reason)}
        isBusy={busy}
      />
    </>
  );
}
