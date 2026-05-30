'use client';

import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { OrderDto } from '@/types/order';
import styles from '../OrderDetails.module.css';

interface OrderDetailsNotesSectionProps {
  order: OrderDto;
  notesExpanded: boolean;
  setNotesExpanded: (expanded: boolean) => void;
  noteText: string;
  setNoteText: (text: string) => void;
}

/**
 * The collapsible order-notes section (existing note + add-note form) of the cashier OrderDetails.
 * Extracted verbatim from OrderDetails (Sprint 4/6 god-file decomposition).
 */
export default function OrderDetailsNotesSection({
  order,
  notesExpanded,
  setNotesExpanded,
  noteText,
  setNoteText,
}: OrderDetailsNotesSectionProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.notesSection}>
      <div className={styles.notesHeader} onClick={() => setNotesExpanded(!notesExpanded)}>
        <div className={styles.notesHeaderLeft}>
          <AlertCircle size={18} />
          <span className={styles.notesTitle}>{t('cashier.order_notes', 'Order Notes')}</span>
          {order.notes && <span className={styles.notesBadge}>1</span>}
        </div>
        <span>{notesExpanded ? '▼' : '▶'}</span>
      </div>

      {notesExpanded && (
        <div className={styles.notesContent}>
          {order.notes && (
            <div className={styles.existingNote}>
              <p className={styles.noteText}>{order.notes}</p>
            </div>
          )}

          <div className={styles.noteForm}>
            <div className={styles.noteFormHeader}>{t('cashier.add_note', 'Add Note')}</div>
            <p className={styles.noteHint}>
              {t('cashier.note_hint', 'Document order modifications, special requests, or important information.')}
            </p>
            <textarea
              className={styles.noteTextarea}
              placeholder={t('cashier.note_placeholder', 'e.g., Customer requested extra napkins...')}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <div className={styles.noteFooter}>
              <span className={styles.charCount}>{noteText.length}/500</span>
              <button
                className={styles.noteButton}
                disabled={!noteText.trim()}
                onClick={() => {
                  // In future, call API to save note
                  alert('Note saved (API integration pending)');
                  setNoteText('');
                }}
              >
                <CheckCircle size={16} />
                {t('cashier.save_note', 'Save Note')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
