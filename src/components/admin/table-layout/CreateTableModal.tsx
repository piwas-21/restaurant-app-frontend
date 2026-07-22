import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreateTableDto, TableDto } from '@/types/reservation';
import styles from './CreateTableModal.module.css';

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTable: (tableData: CreateTableDto) => Promise<TableDto>;
  existingTableNumbers: string[];
  canvasWidth: number;
  canvasHeight: number;
}

export const CreateTableModal: React.FC<CreateTableModalProps> = ({
  isOpen,
  onClose,
  onCreateTable,
  existingTableNumbers,
  canvasWidth,
  canvasHeight,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    tableNumber: '',
    maxGuests: 4,
    isOutdoor: false,
    isActive: true,
    notes: '',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.tableNumber.trim()) {
      setError(t('create_table_enter_number', 'Please enter a table number'));
      return;
    }

    // Check if table number already exists
    if (existingTableNumbers.includes(formData.tableNumber)) {
      setError(t('table_already_exists', 'Table {{number}} already exists', { number: formData.tableNumber }));
      return;
    }

    try {
      setCreating(true);

      // Place new table in the centre of the canvas (markers centre-anchor).
      const newTableData: CreateTableDto = {
        tableNumber: formData.tableNumber,
        maxGuests: formData.maxGuests,
        isActive: formData.isActive,
        isOutdoor: formData.isOutdoor,
        positionX: canvasWidth / 2,
        positionY: canvasHeight / 2,
        notes: formData.notes || undefined,
      };

      await onCreateTable(newTableData);

      // Reset form
      setFormData({
        tableNumber: '',
        maxGuests: 4,
        isOutdoor: false,
        isActive: true,
        notes: '',
      });

      onClose();
    } catch (error: any) {
      setError(error.message || t('failed_create_table', 'Failed to create table'));
    } finally {
      setCreating(false);
    }
  };

  const handleOverlayClick = () => {
    if (!creating) {
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>{t('create_new_table', 'Create New Table')}</h2>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="tableNumber">{t('table_number', 'Table Number')} *</label>
            <input
              id="tableNumber"
              type="text"
              value={formData.tableNumber}
              onChange={(e) => setFormData((prev) => ({ ...prev, tableNumber: e.target.value }))}
              placeholder={t('table_number_placeholder', 'e.g., T1, A1, etc.')}
              required
              disabled={creating}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="maxGuests">{t('max_guests', 'Max Guests')}</label>
            <input
              id="maxGuests"
              type="number"
              min="1"
              max="20"
              value={formData.maxGuests}
              onChange={(e) => setFormData((prev) => ({ ...prev, maxGuests: parseInt(e.target.value) || 1 }))}
              disabled={creating}
            />
          </div>

          <div className={styles.formGroup}>
            <label>{t('location', 'Location')}</label>
            <div className={styles.chipGroup}>
              <button
                type="button"
                className={`${styles.chip} ${formData.isOutdoor ? styles.chipActive : ''}`}
                onClick={() => setFormData((prev) => ({ ...prev, isOutdoor: !prev.isOutdoor }))}
                disabled={creating}
              >
                <span className={styles.chipLabel}>{t('outdoor', 'Outdoor')}</span>
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>{t('status', 'Status')}</label>
            <div className={styles.chipGroup}>
              <button
                type="button"
                className={`${styles.chip} ${formData.isActive ? styles.chipActive : ''}`}
                onClick={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
                disabled={creating}
              >
                <span className={styles.chipLabel}>{t('active', 'Active')}</span>
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="notes">{t('notes_optional', 'Notes (optional)')}</label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder={t('notes_placeholder', 'e.g., Near window, Quiet corner, etc.')}
              rows={3}
              maxLength={500}
              disabled={creating}
            />
            <small className={styles.charCounter}>
              {t('characters_count', '{{count}}/500 characters', { count: formData.notes.length })}
            </small>
          </div>

          <div className={styles.buttonGroup}>
            <button type="button" onClick={onClose} className={styles.cancelButton} disabled={creating}>
              {t('cancel', 'Cancel')}
            </button>
            <button type="submit" disabled={creating} className={styles.submitButton}>
              {creating ? t('creating', 'Creating...') : t('create_table', 'Create Table')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
