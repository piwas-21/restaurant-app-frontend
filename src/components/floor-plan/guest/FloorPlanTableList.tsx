'use client';

import { useTranslation } from 'react-i18next';
import type { GuestTableInfo } from './guestMapState';
import { tableStatusLabel } from './tableStatusLabel';
import styles from './FloorPlanTableList.module.css';

// Stable, non-index keys for the decorative seat pips (Sonar S6479); one per
// seat up to a sensible cap — a card need not draw twenty dots.
const PIP_KEYS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12'];

/**
 * The List view (FLOOR-PLAN-REVAMP §4.2) — every table as a card: number, seat
 * pips, zone, note, status and a Select button. Grouped under zone headings,
 * filtered by the active zone chip. This is the mobile alternative to the map
 * and the screen-reader experience on every device, so a guest can always book
 * without touching the map (acceptance criterion 2).
 */
interface FloorPlanTableListProps {
  infos: GuestTableInfo[];
  party: number;
  zoneFilter: string | null;
  onSelectTable: (id: string) => void;
}

function groupByZone(infos: GuestTableInfo[]): Array<[string, GuestTableInfo[]]> {
  const groups = new Map<string, GuestTableInfo[]>();
  for (const info of infos) {
    const key = info.zone ?? '';
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(info);
    } else {
      groups.set(key, [info]);
    }
  }
  return [...groups.entries()];
}

export default function FloorPlanTableList({
  infos,
  party,
  zoneFilter,
  onSelectTable,
}: Readonly<FloorPlanTableListProps>) {
  const { t } = useTranslation();
  const visible = zoneFilter ? infos.filter((i) => i.zone === zoneFilter) : infos;

  if (visible.length === 0) {
    return <p className={styles.listEmpty}>{t('no_tables_here', 'No tables in this area right now.')}</p>;
  }

  return (
    <div className={styles.list}>
      {groupByZone(visible).map(([zone, group]) => (
        <section
          key={zone || 'unzoned'}
          className={styles.listGroup}
          aria-label={zone || t('floor_plan', 'Floor plan')}
        >
          {zone && <h3 className={styles.listHeading}>{zone}</h3>}
          {group.map((info) => {
            const { table } = info;
            const selected = info.state === 'selected';
            const disabled = info.state === 'booked' || info.state === 'small';
            const status = tableStatusLabel(info.state, table.maxGuests, party, t);
            return (
              <div key={table.id} className={styles.listCard} data-selected={selected}>
                <div className={styles.listCardTop}>
                  <span className={styles.listNumber}>{table.tableNumber}</span>
                  <span className={styles.pips} aria-hidden="true">
                    {PIP_KEYS.slice(0, table.maxGuests).map((key) => (
                      <i key={key} className={styles.pip} />
                    ))}
                  </span>
                </div>
                <div className={styles.listMeta}>
                  {t('seats_count', '{{count}} seats', { count: table.maxGuests })}
                  {table.notes ? ` · ${table.notes}` : ''}
                </div>
                <div className={styles.listMeta}>{status}</div>
                <button
                  type="button"
                  className={styles.listSelect}
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => onSelectTable(table.id)}
                >
                  {selected ? t('selected', 'Selected') : t('select', 'Select')}
                </button>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
