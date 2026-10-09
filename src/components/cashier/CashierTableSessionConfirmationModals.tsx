'use client';

import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import StaffButton from '@/components/design-system/StaffButton';
import type { TableServiceSessionDto } from '@/types/order';
import { formatTableMoney, tableSessionCurrency, tableSessionEligibleOutstanding } from '@/lib/cashierTableSession';
import styles from './CashierTableSession.module.css';

interface Props {
  readonly session: TableServiceSessionDto;
  readonly tableDisplay: string;
  readonly isMutating: boolean;
  readonly showCloseConfirm: boolean;
  readonly showReleaseConfirm: boolean;
  readonly showClearConfirm: boolean;
  readonly onCloseConfirmChange: (open: boolean) => void;
  readonly onReleaseConfirmChange: (open: boolean) => void;
  readonly onClearConfirmChange: (open: boolean) => void;
  readonly onConfirmClose: () => void;
  readonly onConfirmRelease: () => void;
  readonly onConfirmClear: () => void;
}

export default function CashierTableSessionConfirmationModals({
  session,
  tableDisplay,
  isMutating,
  showCloseConfirm,
  showReleaseConfirm,
  showClearConfirm,
  onCloseConfirmChange,
  onReleaseConfirmChange,
  onClearConfirmChange,
  onConfirmClose,
  onConfirmRelease,
  onConfirmClear,
}: Props) {
  const { t } = useTranslation();
  const currencyKnown = tableSessionCurrency(session) !== null;
  const outstanding =
    formatTableMoney(tableSessionEligibleOutstanding(session), session) ?? t('cashier.tables.currency_unknown');
  const currencyWarning = !currencyKnown && <p className={styles.warning}>{t('cashier.tables.currency_unknown')}</p>;

  return (
    <>
      <BaseModal
        isOpen={showCloseConfirm}
        onClose={() => onCloseConfirmChange(false)}
        title={t('cashier.tables.close_confirm_title')}
        isPending={isMutating}
        footer={
          <div className={styles.formActions}>
            <StaffButton onClick={() => onCloseConfirmChange(false)} disabled={isMutating}>
              {t('cashier.tables.cancel')}
            </StaffButton>
            <StaffButton variant="danger" onClick={onConfirmClose} disabled={isMutating}>
              {isMutating ? t('cashier.tables.operation_checking') : t('cashier.tables.close_confirm_action')}
            </StaffButton>
          </div>
        }
      >
        <p>{t('cashier.tables.close_confirm_message', { table: tableDisplay })}</p>
        <p className={styles.muted}>{outstanding}</p>
        {currencyWarning}
      </BaseModal>
      <BaseModal
        isOpen={showReleaseConfirm}
        onClose={() => onReleaseConfirmChange(false)}
        title={t('cashier.tables.release_confirm_title')}
        isPending={isMutating}
        footer={
          <div className={styles.formActions}>
            <StaffButton onClick={() => onReleaseConfirmChange(false)} disabled={isMutating}>
              {t('cashier.tables.cancel')}
            </StaffButton>
            <StaffButton variant="primary" onClick={onConfirmRelease} disabled={isMutating}>
              {isMutating ? t('cashier.tables.operation_checking') : t('cashier.tables.release_table')}
            </StaffButton>
          </div>
        }
      >
        <p>{t('cashier.tables.release_confirm_message', { table: tableDisplay })}</p>
        <p className={styles.muted}>{t('cashier.tables.release_confirm_preserves')}</p>
        {currencyWarning}
      </BaseModal>
      <BaseModal
        isOpen={showClearConfirm}
        onClose={() => onClearConfirmChange(false)}
        title={t('cashier.tables.clear_confirm_title')}
        isPending={isMutating}
        footer={
          <div className={styles.formActions}>
            <StaffButton onClick={() => onClearConfirmChange(false)} disabled={isMutating}>
              {t('cashier.tables.cancel')}
            </StaffButton>
            <StaffButton variant="danger" onClick={onConfirmClear} disabled={isMutating}>
              {isMutating ? t('cashier.tables.operation_checking') : t('cashier.tables.clear_and_release')}
            </StaffButton>
          </div>
        }
      >
        <p>{t('cashier.tables.clear_confirm_message', { table: tableDisplay })}</p>
        <p className={styles.warning}>{t('cashier.tables.clear_confirm_limits')}</p>
      </BaseModal>
    </>
  );
}
