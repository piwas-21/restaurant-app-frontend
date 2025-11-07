import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, QrCode, Trash2 } from 'lucide-react';
import type { TableDto } from '@/types/reservation';
import styles from './TableActionsPopup.module.css';

interface TableActionsPopupProps {
  table: TableDto;
  position: { x: number; y: number };
  onEdit: () => void;
  onViewQR: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function TableActionsPopup({
  table,
  position,
  onEdit,
  onViewQR,
  onDelete,
  onClose,
}: TableActionsPopupProps) {
  const { t } = useTranslation();
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={popupRef}
      className={styles.popup}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
      }}
    >
      <div className={styles.popupHeader}>
        <h3>{t('table', 'Table')} {table.tableNumber}</h3>
        <div className={styles.tableBadge}>
          <span className={styles.badgeIcon}>👥</span>
          {table.maxGuests} {t('guests', 'guests')}
        </div>
      </div>

      <div className={styles.actions}>
        <button
          onClick={onEdit}
          className={styles.actionButton}
          aria-label={t('edit', 'Edit')}
        >
          <Settings size={20} />
          <span>{t('edit', 'Edit')}</span>
        </button>

        <button
          onClick={onViewQR}
          className={styles.actionButton}
          aria-label={t('view_qr_code', 'View QR Code')}
        >
          <QrCode size={20} />
          <span>{t('view_qr_code', 'View QR Code')}</span>
        </button>

        <button
          onClick={onDelete}
          className={`${styles.actionButton} ${styles.deleteButton}`}
          aria-label={t('delete_table', 'Delete Table')}
        >
          <Trash2 size={20} />
          <span>{t('delete_table', 'Delete Table')}</span>
        </button>
      </div>
    </div>
  );
}
