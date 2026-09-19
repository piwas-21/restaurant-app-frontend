import { useTranslation } from 'react-i18next';
import { orderStatusMeta, type OrderStatusBadgeFill } from '@/lib/orderStatus';
import { orderStatusPresentation } from '@/lib/orderStatusPresentation';
import StatusBadge from './StatusBadge';
import statusStyles from '@/styles/orderStatus.module.css';

interface OrderStatusBadgeProps {
  readonly status: string | null | undefined;
}

const BADGE_FILL_CLASS: Record<OrderStatusBadgeFill, string> = {
  pending: statusStyles.statusPending,
  confirmed: statusStyles.statusConfirmed,
  preparing: statusStyles.statusPreparing,
  ready: statusStyles.statusReady,
  cancelled: statusStyles.statusCancelled,
  completed: statusStyles.statusCompleted,
};

/** Shared domain-status renderer; unknown values remain neutral instead of looking completed. */
export default function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const { t } = useTranslation();
  const presentation = orderStatusPresentation(status, t);
  const className = orderStatusMeta(status)
    ? `${statusStyles.statusBadge} ${BADGE_FILL_CLASS[presentation.fill]}`
    : undefined;

  return (
    <StatusBadge tone={presentation.tone} className={className}>
      {presentation.label}
    </StatusBadge>
  );
}
