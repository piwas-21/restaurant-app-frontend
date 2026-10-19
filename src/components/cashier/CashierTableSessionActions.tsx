'use client';

import Link from '@/components/TenantLink';
import BillPrintButton from '@/components/order/BillPrintButton';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import type { TableServiceSessionDto } from '@/types/order';
import { tableSessionActions, tableSessionAddRoundPath } from '@/lib/cashierTableSession';
import buttonStyles from '@/components/design-system/StaffButton.module.css';
import styles from './CashierTableSession.module.css';
import { CASHIER_COLLECTION_PATH } from '@/lib/cashierWorkspace';

interface Props {
  readonly session: TableServiceSessionDto;
  readonly legacyConflict: boolean;
  readonly writesLocked: boolean;
  readonly onShowCloseConfirm: () => void;
  readonly onShowReleaseConfirm: () => void;
}

export default function CashierTableSessionActions({
  session,
  legacyConflict,
  writesLocked,
  onShowCloseConfirm,
  onShowReleaseConfirm,
}: Props) {
  const { t } = useTranslation();
  const actions = tableSessionActions(session);
  const closeAllowed = actions.has('close');
  const addRoundHref = tableSessionAddRoundPath(session);
  const addRoundIdentityUnavailable = session.status === 'Open' && !addRoundHref;
  const addRoundAllowed =
    session.status === 'Open' && !session.isTableReleased && !writesLocked && !legacyConflict && Boolean(addRoundHref);
  const releaseAllowed = session.status === 'Open' && !session.isTableReleased && session.canReleaseTable !== false;
  const collectAllowed = actions.has('collect') && !writesLocked;
  const collectionParams = new URLSearchParams({ serviceSessionId: session.serviceSessionId });
  if (session.tableId) collectionParams.set('tableId', session.tableId);
  const collectionHref = `${CASHIER_COLLECTION_PATH}?${collectionParams.toString()}`;

  return (
    <>
      <div className={styles.actionRow}>
        {collectAllowed && (
          <Link className={`btn btn-primary ${buttonStyles.touch}`} href={collectionHref}>
            {t('server.bill.collect')}
          </Link>
        )}
        {releaseAllowed && (
          <StaffButton variant="secondary" onClick={onShowReleaseConfirm} disabled={writesLocked}>
            {t('cashier.tables.release_table')}
          </StaffButton>
        )}
        {closeAllowed && (
          <StaffButton variant="secondary" onClick={onShowCloseConfirm} disabled={writesLocked}>
            {t('cashier.tables.close')}
          </StaffButton>
        )}
        <BillPrintButton
          label={t('cashier.tables.print_bill')}
          disabled={writesLocked}
          target={{ serviceSessionId: session.serviceSessionId, expectedVersion: session.version }}
          onBrowserPrint={() => window.print()}
        />
        {addRoundAllowed && addRoundHref ? (
          <Link className={`btn btn-secondary ${buttonStyles.touch}`} href={addRoundHref}>
            {t('cashier.tables.add_round')}
          </Link>
        ) : (
          <StaffButton disabled>{t('cashier.tables.add_round')}</StaffButton>
        )}
      </div>
      {legacyConflict && <p className={styles.muted}>{t('cashier.tables.add_round_unavailable')}</p>}
      {addRoundIdentityUnavailable && (
        <output className={styles.statusOutput} aria-live="polite">
          {t('cashier.tables.add_round_identity_unavailable')}
        </output>
      )}
    </>
  );
}
