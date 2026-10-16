'use client';

import { useTranslation } from 'react-i18next';
import StaffTableCard from '@/components/table-service/StaffTableCard';
import { formatCurrency } from '@/utils/currency';
import { isKnownServerFloorTableState, type ServerFloorTable } from '@/types/serverWorkspace';
import { tableStatusLabel } from './serverFloorPresentation';
import { statusTone } from './serverTableWorkspacePresentation';

interface Props {
  readonly table: ServerFloorTable;
  readonly selected?: boolean;
  readonly isStale?: boolean;
  readonly onSelect?: (tableId: string) => void;
}

export default function ServerFloorTableCard({ table, selected = false, isStale = false, onSelect }: Props) {
  const { t, i18n } = useTranslation();
  const known = isKnownServerFloorTableState(table.state);
  const session = table.session;
  const balance = session?.remaining ?? table.legacy?.outstanding;
  const canStart = table.state === 'Available' && table.permittedActions.includes('StartTable');
  const label = t('cashier.tables.table_number', 'Table {{table}}', { table: table.tableLabel });
  let actionLabel = t('unavailable', 'Table details unavailable');
  if (known) actionLabel = canStart ? t('staff.add_order', 'Add order') : t('server.open_table', 'Open table details');
  return (
    <StaffTableCard
      label={label}
      status={tableStatusLabel(table, t)}
      tone={statusTone(table.state)}
      accessibleLabel={`${label}: ${actionLabel}`}
      selected={selected}
      disabled={!known || (canStart && isStale)}
      href={canStart ? undefined : `/server/tables/${encodeURIComponent(table.tableId)}`}
      onSelect={() => onSelect?.(table.tableId)}
      actionLabel={actionLabel}
    >
      <span>{t('seats_count', '{{count}} seats', { count: table.maxGuests })}</span>
      {(session || table.legacy) && (
        <span>
          {t('cashier.remaining')}:{' '}
          <span>{formatCurrency(balance ?? 0, i18n.language || 'en', session?.currency ?? undefined)}</span>
        </span>
      )}
      {table.activeRoundCount > 0 && (
        <span>
          {t('cashier.tables.rounds', { count: table.activeRoundCount })}
          {table.readyRoundCount > 0 && <> · {t('server.status_ready')}</>}
        </span>
      )}
      {table.reservation && (
        <span>
          {t('server.upcoming_reservation')}: <span dir="auto">{table.reservation.customerName}</span> ·{' '}
          {table.reservation.startTime}
        </span>
      )}
    </StaffTableCard>
  );
}
