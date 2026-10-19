import { useState } from 'react';
import { Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import StatusBadge from '@/components/design-system/StatusBadge';
import StaffButton from '@/components/design-system/StaffButton';
import { useModuleEnabled } from '@/contexts/ModulesContext';
import { useCashierBillPrint } from '@/hooks/cashier/useCashierBillPrint';
import styles from './BillPrintButton.module.css';
import type { CashierPrintTarget } from '@/services/cashierPrintingService';

const STATUS_KEYS = {
  Queued: 'billPrint.status.Queued',
  Claimed: 'billPrint.status.Claimed',
  Sent: 'billPrint.status.Sent',
  Failed: 'billPrint.status.Failed',
  Unknown: 'billPrint.status.Unknown',
  Expired: 'billPrint.status.Expired',
} as const;

interface Props {
  readonly label: string;
  readonly target: CashierPrintTarget;
  readonly onBrowserPrint: () => void;
  readonly disabled?: boolean;
}

export default function BillPrintButton({ label, target, onBrowserPrint, disabled }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const printing = useCashierBillPrint(target, open);
  const enabled = useModuleEnabled('printing');
  return (
    <>
      <StaffButton onClick={() => setOpen(true)} disabled={disabled}>
        <Printer size={17} aria-hidden="true" />
        {label}
      </StaffButton>
      <BaseModal isOpen={open} onClose={() => setOpen(false)} title={label} size="sm" isPending={printing.busy}>
        <div className={styles.options}>
          <p>{t('billPrint.choose')}</p>
          <StaffButton onClick={onBrowserPrint}>{t('billPrint.browser')}</StaffButton>
          {enabled && (
            <>
              <p>{t('billPrint.printerHint')}</p>
              <StaffButton
                variant="primary"
                disabled={printing.busy}
                onClick={() => void printing.send(Boolean(printing.job))}
              >
                {t(printing.job ? 'billPrint.another' : 'billPrint.connected')}
              </StaffButton>
              {printing.job && (
                <div role="status">
                  <StatusBadge>{t(STATUS_KEYS[printing.job.status])}</StatusBadge>
                </div>
              )}
              {printing.failed && <p role="alert">{printing.error ?? t('billPrint.failed')}</p>}
            </>
          )}
        </div>
      </BaseModal>
    </>
  );
}
