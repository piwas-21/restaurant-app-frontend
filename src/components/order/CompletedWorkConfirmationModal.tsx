import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import StaffButton from '@/components/design-system/StaffButton';
import { orderStatusLabel } from '@/lib/orderStatus';
import type { OrderDto } from '@/types/order';

interface Props {
  readonly order: Pick<OrderDto, 'status'>;
  readonly target: string;
  readonly reason: string;
  readonly busy: boolean;
  readonly error?: string | null;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

export default function CompletedWorkConfirmationModal({
  order,
  target,
  reason,
  busy,
  error,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  return (
    <BaseModal
      isOpen
      title={t('staffCompletion.title')}
      size="md"
      onClose={onClose}
      isPending={busy}
      footer={
        <>
          <StaffButton onClick={onClose} disabled={busy}>
            {t('cancel')}
          </StaffButton>
          <StaffButton variant="primary" onClick={onConfirm} disabled={busy}>
            {t('staffCompletion.confirm')}
          </StaffButton>
        </>
      }
    >
      <p>
        {t('staffCompletion.status', {
          current: orderStatusLabel(order.status, t),
          target: orderStatusLabel(target, t),
        })}
      </p>
      <p>{t(reason === 'KitchenCorrectionUnresolved' ? 'staffCompletion.correction' : 'staffCompletion.work')}</p>
      <p>{t('staffCompletion.explanation')}</p>
      {error && <p role="alert">{error}</p>}
    </BaseModal>
  );
}
