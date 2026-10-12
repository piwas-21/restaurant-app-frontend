'use client';

import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import StaffButton from '@/components/design-system/StaffButton';
import { formatTableMoney } from '@/lib/cashierTableSession';
import type { TableServiceSessionDto } from '@/types/order';

interface Props {
  readonly session: TableServiceSessionDto;
  readonly isOpen: boolean;
  readonly isPending: boolean;
  readonly error?: string | null;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

export default function FreeTableConfirmationModal({ session, isOpen, isPending, error, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const outstanding = formatTableMoney(session.outstanding, session) ?? t('cashier.tables.currency_unknown');
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      isPending={isPending}
      title={t('cashier.tables.release_confirm_title')}
      footer={
        <>
          <StaffButton onClick={onClose} disabled={isPending}>
            {t('cashier.tables.cancel')}
          </StaffButton>
          <StaffButton variant="primary" onClick={onConfirm} disabled={isPending}>
            {t('cashier.tables.release_table')}
          </StaffButton>
        </>
      }
    >
      {error && <p role="alert">{error}</p>}
      <p>{t('staff_table_reuse.confirm', { table: session.tableLabel || session.tableNumber })}</p>
      <p>{t('cashier.tables.release_confirm_preserves')}</p>
      <p>{t('staff_table_reuse.balance', { amount: outstanding })}</p>
    </BaseModal>
  );
}
