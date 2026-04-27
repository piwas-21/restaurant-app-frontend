import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TableDto } from '@/types/reservation';
import styles from './TablePropertiesSidebar.module.css';

interface TablePropertiesSidebarProps {
  selectedTable: TableDto | null;
  currentCanvasSize: { width: number; height: number };
  onUpdateTable: (updates: Partial<TableDto>) => void;
  onDeleteTable: () => void;
  onViewQRCode: () => void;
}

export default function TablePropertiesSidebar({
  selectedTable,
  currentCanvasSize,
  onUpdateTable,
  onDeleteTable,
  onViewQRCode,
}: TablePropertiesSidebarProps) {
  const { t } = useTranslation();

  if (!selectedTable) {
    return (
      <div className={styles.sidebar}>
        <div className={styles.noSelection}>
          {t('click_table_edit_properties', 'Click on a table to edit its properties')}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <h2>{t('table_properties', 'Table Properties')}</h2>
      </div>

      <div className={styles.formGroup}>
        <label>{t('table_number', 'Table Number')}</label>
        <input
          type="text"
          value={selectedTable.tableNumber}
          onChange={(e) => onUpdateTable({ tableNumber: e.target.value })}
          className={styles.input}
          placeholder={t('table_number_placeholder', 'e.g., 1, 2, 3')}
        />
      </div>

      <div className={styles.formGroup}>
        <label>{t('max_guests', 'Max Guests')}</label>
        <input
          type="number"
          value={selectedTable.maxGuests}
          onChange={(e) => onUpdateTable({ maxGuests: parseInt(e.target.value) || 1 })}
          className={styles.input}
          min="1"
          max="20"
        />
      </div>

      <div className={styles.formGroup}>
        <label>{t('shape', 'Shape')}</label>
        <select
          value={selectedTable.shape || 'circle'}
          onChange={(e) => onUpdateTable({ shape: e.target.value })}
          className={styles.select}
        >
          <option value="circle">{t('circle', 'Circle')}</option>
          <option value="square">{t('square', 'Square')}</option>
          <option value="rectangle">{t('rectangle', 'Rectangle')}</option>
        </select>
      </div>

      <div className={styles.formGroup}>
        <label>{t('status', 'Status')}</label>
        <div className={styles.chipContainer}>
          <button
            type="button"
            onClick={() => onUpdateTable({ isActive: !selectedTable.isActive })}
            className={`${styles.chip} ${selectedTable.isActive ? styles.chipActive : styles.chipInactive}`}
          >
            {selectedTable.isActive ? `✓ ${t('active', 'Active')}` : `○ ${t('inactive', 'Inactive')}`}
          </button>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label>{t('location', 'Location')}</label>
        <div className={styles.chipContainer}>
          <button
            type="button"
            onClick={() => onUpdateTable({ isOutdoor: false })}
            className={`${styles.chip} ${!selectedTable.isOutdoor ? styles.chipSelected : ''}`}
          >
            🏠 {t('indoor', 'Indoor')}
          </button>
          <button
            type="button"
            onClick={() => onUpdateTable({ isOutdoor: true })}
            className={`${styles.chip} ${selectedTable.isOutdoor ? styles.chipSelected : ''}`}
          >
            🌳 {t('outdoor', 'Outdoor')}
          </button>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label>{t('notes_visible_customers', 'Notes (visible to customers)')}</label>
        <textarea
          value={selectedTable.notes || ''}
          onChange={(e) => onUpdateTable({ notes: e.target.value })}
          className={styles.textarea}
          placeholder={t('notes_placeholder', 'e.g., Near window, Quiet corner, etc.')}
          rows={3}
          maxLength={500}
        />
        <small className={styles.charCount}>
          {t('characters_count', '{{count}}/500 characters', { count: (selectedTable.notes || '').length })}
        </small>
      </div>

      <div className={styles.formGroup}>
        <label>
          {t('position_x', 'Position X: {{x}}px ({{percent}}%)', {
            x: selectedTable.positionX.toFixed(1),
            percent: ((selectedTable.positionX / currentCanvasSize.width) * 100).toFixed(1),
          })}
        </label>
      </div>

      <div className={styles.formGroup}>
        <label>
          {t('position_y', 'Position Y: {{y}}px ({{percent}}%)', {
            y: selectedTable.positionY.toFixed(1),
            percent: ((selectedTable.positionY / currentCanvasSize.height) * 100).toFixed(1),
          })}
        </label>
      </div>

      <div className={styles.formGroup} style={{ marginTop: '1.5rem' }}>
        <button onClick={onViewQRCode} className={styles.qrButton}>
          📱 {t('view_qr_code', 'View QR Code')}
        </button>
        <button onClick={onDeleteTable} className={styles.deleteButton}>
          {t('delete_table', 'Delete Table')}
        </button>
      </div>
    </div>
  );
}
