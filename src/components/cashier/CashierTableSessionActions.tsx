'use client';

import Link from '@/components/TenantLink';
import { Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import type { TableServiceSessionDto } from '@/types/order';
import { tableSessionActions, tableSessionAddRoundPath } from '@/lib/cashierTableSession';
import buttonStyles from '@/components/design-system/StaffButton.module.css';
import styles from './CashierTableSession.module.css';

interface Props {
  readonly session: TableServiceSessionDto;
  readonly legacyConflict: boolean;
  readonly writesLocked: boolean;
  readonly onShowCloseConfirm: () => void;
  readonly onShowReleaseConfirm: () => void;
  readonly onShowClearConfirm: () => void;
}

export default function CashierTableSessionActions({
  session,
  legacyConflict,
  writesLocked,
  onShowCloseConfirm,
  onShowReleaseConfirm,
  onShowClearConfirm,
}: Props) {
  const { t } = useTranslation();
  const actions = tableSessionActions(session);
  const closeAllowed = actions.has('close');
  const addRoundHref = tableSessionAddRoundPath(session);
  const addRoundIdentityUnavailable = session.status === 'Open' && !addRoundHref;
  const addRoundAllowed =
    session.status === 'Open' && !session.isTableReleased && !writesLocked && !legacyConflict && Boolean(addRoundHref);
  const releaseAllowed = session.status === 'Open' && !session.isTableReleased && session.canReleaseTable !== false;

  return (
    <>
      <div className={styles.actionRow}>
        {releaseAllowed && (
          <StaffButton variant="secondary" onClick={onShowReleaseConfirm} disabled={writesLocked}>
            {t('cashier.tables.release_table')}
          </StaffButton>
        )}
        {session.status === 'Open' && !session.isTableReleased && (
          <StaffButton variant="danger" onClick={onShowClearConfirm} disabled={writesLocked}>
            {t('cashier.tables.clear_and_release')}
          </StaffButton>
        )}
        <StaffButton
          variant="danger"
          onClick={onShowCloseConfirm}
          disabled={writesLocked || !closeAllowed}
          aria-describedby={!closeAllowed ? 'cashier-table-close-hint' : undefined}
        >
          {t('cashier.tables.close')}
        </StaffButton>
        <StaffButton onClick={() => window.print()} disabled={writesLocked}>
          <Printer size={17} aria-hidden="true" />
          {t('cashier.tables.print_bill')}
        </StaffButton>
        {addRoundAllowed && addRoundHref ? (
          <Link className={`btn btn-secondary ${buttonStyles.touch}`} href={addRoundHref}>
            {t('cashier.tables.add_round')}
          </Link>
        ) : (
          <StaffButton disabled>{t('cashier.tables.add_round')}</StaffButton>
        )}
        {!closeAllowed && session.status === 'Open' && (
          <span id="cashier-table-close-hint" className={styles.muted}>
            {t('cashier.tables.close_not_ready')}
          </span>
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
