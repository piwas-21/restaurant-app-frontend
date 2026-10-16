import { useRef, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { updateOrderStatus } from '@/services/cashierService';
import { orderStatusLabel } from '@/lib/orderStatus';
import { getErrorMessage } from '@/utils/apiClient';
import type { OrderDto } from '@/types/order';
import styles from './CashierTicketActions.module.css';

interface Props {
  readonly order: OrderDto;
  readonly isFresh: boolean;
  readonly approvalRequired: boolean;
  readonly onChanged: () => void;
}

/** Explicit one-tap actions, only from the current server capability snapshot. */
export default function CashierOrderStatusActions({ order, isFresh, approvalRequired, onChanged }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const actions = isFresh
    ? (order.permittedActions ?? []).filter(
        (action) =>
          action.allowed &&
          !action.requiresReason &&
          action.action !== 'CancelOrder' &&
          !(approvalRequired && action.action === 'Accept') &&
          (action.targetStatus || action.action === 'MarkReady'),
      )
    : [];
  const changeStatus = async (target: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await updateOrderStatus(order.id, target, order.version);
      onChanged();
    } catch (reason: unknown) {
      setError(getErrorMessage(reason) ?? t('cashier.workspace.mark_ready_failed'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      {actions.map((action) => {
        const target = action.targetStatus ?? 'Ready';
        return (
          <button
            key={action.action}
            type="button"
            className={`${styles.actionButton} ${styles.primaryAction}`}
            onClick={() => void changeStatus(target)}
            disabled={busy}
          >
            <CheckCircle size={17} aria-hidden="true" />
            {target === 'Ready'
              ? t('cashier.workspace.mark_ready')
              : t('cashier.workspace.set_status', { status: orderStatusLabel(target, t) })}
          </button>
        );
      })}
      {error && (
        <p className={styles.actionError} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
