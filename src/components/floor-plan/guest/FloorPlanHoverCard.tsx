'use client';

import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import type { GuestTableInfo } from './guestMapState';
import { tableStatusLabel } from './tableStatusLabel';
import styles from './FloorPlanHoverCard.module.css';

/**
 * The desktop hover preview (FLOOR-PLAN-REVAMP §4.2, WCAG SC 1.4.13). It is
 * dismissible (Esc / the close button), hoverable (the pointer can enter it — it
 * keeps `pointer-events`), and persistent (it stays until dismissed or the
 * pointer leaves both it and the table). Positioned beside the table by the
 * orchestrator so it never covers the table it describes. It is a *preview* —
 * selecting still writes to the booking docket.
 */
interface FloorPlanHoverCardProps {
  info: GuestTableInfo;
  party: number;
  position: CSSProperties;
  onClose: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

export default function FloorPlanHoverCard({
  info,
  party,
  position,
  onClose,
  onPointerEnter,
  onPointerLeave,
}: Readonly<FloorPlanHoverCardProps>) {
  const { t } = useTranslation();
  const { table, zone } = info;
  const statusText = tableStatusLabel(info.state, table.maxGuests, party, t);

  // A supplementary preview (not a modal) — no ARIA landmark role; the h4 gives
  // it a name and it stays dismissible/hoverable/persistent (SC 1.4.13).
  return (
    <div className={styles.hoverCard} style={position} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      <button type="button" className={styles.hoverClose} onClick={onClose} aria-label={t('dismiss', 'Dismiss')}>
        ×
      </button>
      <h4 className={styles.hoverTitle}>{t('table_number', 'Table {{number}}', { number: table.tableNumber })}</h4>
      <dl className={styles.hoverList}>
        <dt>{t('seats', 'Seats')}</dt>
        <dd>{table.maxGuests}</dd>
        <dt>{t('where', 'Where')}</dt>
        <dd>
          {zone ?? t('floor_plan', 'Floor plan')}
          {table.isOutdoor ? ` · ${t('outdoor', 'outdoor')}` : ''}
        </dd>
        {table.notes ? (
          <>
            <dt>{t('note', 'Note')}</dt>
            <dd>{table.notes}</dd>
          </>
        ) : null}
        <dt>{t('status', 'Status')}</dt>
        <dd>{statusText}</dd>
      </dl>
    </div>
  );
}
