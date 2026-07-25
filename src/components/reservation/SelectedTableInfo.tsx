import { useTranslation } from 'react-i18next';
import { TableDto } from '@/types/reservation';

interface SelectedTableInfoProps {
  selectedTables: TableDto[];
  requestCombineTables: boolean;
  onToggleCombine: () => void;
  /** Per-template CSS module (ADR-006 reservations surface — the CartPage
   *  pattern): classic passes ./SelectedTableInfo.module.css, craft its re-skin. */
  styles: Readonly<Record<string, string>>;
}

/**
 * The booking-panel "Your Tables" docket: one line per selected table with its
 * number, seat count, indoor/outdoor location and any table note. This is the
 * single place table details appear — the floor plan has no popup.
 */
export default function SelectedTableInfo({
  selectedTables,
  requestCombineTables,
  onToggleCombine,
  styles,
}: Readonly<SelectedTableInfoProps>) {
  const { t } = useTranslation();

  if (selectedTables.length === 0) {
    return null;
  }

  return (
    <>
      {/* Selected tables docket */}
      <div className={styles.selectedTableInfo}>
        <div className={styles.tableLabel}>
          {selectedTables.length === 1 ? t('table', 'Table') : t('tables', 'Tables')}:
        </div>
        <ul className={styles.tableList}>
          {selectedTables.map((table) => (
            <li key={table.id} className={styles.tableLine}>
              <span className={styles.tableLineNumber}>{table.tableNumber}</span>
              <span className={styles.tableLineMeta}>
                {table.maxGuests} {t('seats', 'seats')} ·{' '}
                {table.isOutdoor ? t('outdoor', 'Outdoor') : t('indoor', 'Indoor')}
              </span>
              {table.notes && <span className={styles.tableLineNotes}>{table.notes}</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* Combine Tables Chip */}
      {selectedTables.length > 1 && (
        <button
          type="button"
          onClick={onToggleCombine}
          className={`${styles.combineChip} ${requestCombineTables ? styles.combineChipActive : ''}`}
        >
          <span className={styles.combineChipIcon}>{requestCombineTables ? '✓' : '+'}</span>
          {t('request_combine_tables', 'Request to combine these tables')}
        </button>
      )}
    </>
  );
}
