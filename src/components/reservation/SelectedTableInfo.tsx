import { useTranslation } from 'react-i18next';
import { TableDto } from '@/types/reservation';
import styles from './SelectedTableInfo.module.css';

interface SelectedTableInfoProps {
  selectedTables: TableDto[];
  requestCombineTables: boolean;
  onToggleCombine: () => void;
}

export default function SelectedTableInfo({
  selectedTables,
  requestCombineTables,
  onToggleCombine
}: SelectedTableInfoProps) {
  const { t } = useTranslation();

  if (selectedTables.length === 0) {
    return null;
  }

  return (
    <>
      {/* Selected Table Display */}
      <div className={styles.selectedTableInfo}>
        <div className={styles.tableLabel}>
          {selectedTables.length === 1 ? t('table', 'Table') : t('tables', 'Tables')}:
        </div>
        <div className={styles.tableValue}>
          {selectedTables.map(t => t.tableNumber).join(', ')}
        </div>
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
