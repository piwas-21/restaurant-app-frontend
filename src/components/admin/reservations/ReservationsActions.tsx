import React from 'react';
import { Download, FileText, Check, X } from 'lucide-react';
import styles from './ReservationsActions.module.css';

interface ReservationsActionsProps {
  selectedCount: number;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onBulkConfirm: () => void;
  onBulkCancel: () => void;
  onClearSelection: () => void;
  exportCSVLabel: string;
  exportPDFLabel: string;
  selectedLabel: string;
  confirmSelectedLabel: string;
  cancelSelectedLabel: string;
  clearSelectionLabel: string;
}

export const ReservationsActions: React.FC<ReservationsActionsProps> = ({
  selectedCount,
  onExportCSV,
  onExportPDF,
  onBulkConfirm,
  onBulkCancel,
  onClearSelection,
  exportCSVLabel,
  exportPDFLabel,
  selectedLabel,
  confirmSelectedLabel,
  cancelSelectedLabel,
  clearSelectionLabel,
}) => {
  return (
    <div className={styles.actionsBar}>
      <div className={styles.exportButtons}>
        <button onClick={onExportCSV} className={styles.exportButton}>
          <Download size={16} />
          {exportCSVLabel}
        </button>
        <button onClick={onExportPDF} className={styles.exportButton}>
          <FileText size={16} />
          {exportPDFLabel}
        </button>
      </div>

      {selectedCount > 0 && (
        <div className={styles.bulkActionsBar}>
          <span className={styles.selectionCount}>
            {selectedCount} {selectedLabel}
          </span>
          <button onClick={onBulkConfirm} className={styles.bulkConfirmButton}>
            <Check size={16} />
            {confirmSelectedLabel}
          </button>
          <button onClick={onBulkCancel} className={styles.bulkCancelButton}>
            <X size={16} />
            {cancelSelectedLabel}
          </button>
          <button onClick={onClearSelection} className={styles.clearSelectionButton}>
            {clearSelectionLabel}
          </button>
        </div>
      )}
    </div>
  );
};
