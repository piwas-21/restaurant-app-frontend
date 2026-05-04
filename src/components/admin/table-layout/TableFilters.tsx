import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './TableFilters.module.css';

interface TableFiltersProps {
  filters: {
    showIndoor: boolean;
    showOutdoor: boolean;
    showActive: boolean;
    showInactive: boolean;
  };
  onFilterChange: (filters: TableFiltersProps['filters']) => void;
}

export default function TableFilters({ filters, onFilterChange }: TableFiltersProps) {
  const { t } = useTranslation();

  const handleToggle = (key: keyof typeof filters) => {
    onFilterChange({ ...filters, [key]: !filters[key] });
  };

  return (
    <div className={styles.filters}>
      <div className={styles.filterSection}>
        <div className={styles.chipContainer}>
          <button
            type="button"
            onClick={() => handleToggle('showIndoor')}
            className={`${styles.chip} ${filters.showIndoor ? styles.chipActive : styles.chipInactive}`}
          >
            🏠 {t('indoor', 'Indoor')}
          </button>
          <button
            type="button"
            onClick={() => handleToggle('showOutdoor')}
            className={`${styles.chip} ${filters.showOutdoor ? styles.chipActive : styles.chipInactive}`}
          >
            🌳 {t('outdoor', 'Outdoor')}
          </button>
        </div>
      </div>

      <div className={styles.filterSection}>
        <div className={styles.chipContainer}>
          <button
            type="button"
            onClick={() => handleToggle('showActive')}
            className={`${styles.chip} ${filters.showActive ? styles.chipActive : styles.chipInactive}`}
          >
            ✓ {t('active', 'Active')}
          </button>
          <button
            type="button"
            onClick={() => handleToggle('showInactive')}
            className={`${styles.chip} ${filters.showInactive ? styles.chipActive : styles.chipInactive}`}
          >
            ○ {t('inactive', 'Inactive')}
          </button>
        </div>
      </div>
    </div>
  );
}
