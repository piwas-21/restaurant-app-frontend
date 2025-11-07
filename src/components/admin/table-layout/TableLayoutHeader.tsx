import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './TableLayoutHeader.module.css';

interface TableLayoutHeaderProps {
  saving: boolean;
  onCreateTable: () => void;
  onSaveLayout: () => void;
}

export default function TableLayoutHeader({
  saving,
  onCreateTable,
  onSaveLayout,
}: TableLayoutHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.header}>
      <div>
        <h1 className={styles.title}>{t('table_layout_editor', 'Table Layout Editor')}</h1>
        <p className={styles.subtitle}>{t('drag_tables_reposition', 'Drag tables to reposition them on the floor plan')}</p>
      </div>
      <div className={styles.headerActions}>
        <button
          onClick={onCreateTable}
          className={styles.createButton}
        >
          + {t('create_table', 'Create Table')}
        </button>
        <button
          onClick={onSaveLayout}
          disabled={saving}
          className={styles.saveButton}
        >
          {saving ? t('saving', 'Saving...') : t('save_layout', 'Save Layout')}
        </button>
      </div>
    </div>
  );
}
