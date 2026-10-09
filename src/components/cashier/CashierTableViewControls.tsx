'use client';

import { List, Map, RefreshCw } from 'lucide-react';
import StaffButton from '@/components/design-system/StaffButton';
import { useTranslation } from 'react-i18next';
import styles from './CashierTablesWorkspace.module.css';

type TableView = 'map' | 'list';

interface Props {
  readonly view: TableView;
  readonly disabled: boolean;
  readonly isLoading: boolean;
  readonly onViewChange: (view: TableView) => void;
  readonly onRefresh: () => void;
}

export default function CashierTableViewControls({ view, disabled, isLoading, onViewChange, onRefresh }: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.headerActions}>
      <fieldset className={styles.viewToggle} aria-label={t('cashier.tables.view_toggle')}>
        <StaffButton
          variant={view === 'map' ? 'primary' : 'secondary'}
          className={styles.viewButton}
          aria-pressed={view === 'map'}
          onClick={() => onViewChange('map')}
        >
          <Map size={17} aria-hidden="true" /> {t('cashier.tables.map')}
        </StaffButton>
        <StaffButton
          variant={view === 'list' ? 'primary' : 'secondary'}
          className={styles.viewButton}
          aria-pressed={view === 'list'}
          onClick={() => onViewChange('list')}
        >
          <List size={17} aria-hidden="true" /> {t('cashier.tables.list')}
        </StaffButton>
      </fieldset>
      <StaffButton onClick={onRefresh} disabled={disabled || isLoading}>
        <RefreshCw size={17} aria-hidden="true" /> {t('cashier.workspace.refresh')}
      </StaffButton>
    </div>
  );
}
