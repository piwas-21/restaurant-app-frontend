'use client';

import { AlertCircle, CheckCircle, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { useOrderOperationalNotes } from '@/hooks/useOrderOperationalNotes';
import type { OrderDto } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';
import styles from '../OrderDetails.module.css';

interface OrderDetailsNotesSectionProps {
  order: OrderDto;
  notesExpanded: boolean;
  setNotesExpanded: (expanded: boolean) => void;
}

export default function OrderDetailsNotesSection({
  order,
  notesExpanded,
  setNotesExpanded,
}: OrderDetailsNotesSectionProps) {
  const { t, i18n } = useTranslation();
  const { notes, draft, isLoading, isSaving, loadingError, savingError, setText, setAudience, save } =
    useOrderOperationalNotes(order.id, notesExpanded);
  const loadingErrorMessage = loadingError
    ? (getErrorMessage(loadingError) ?? t('cashier.operational_note_load_error'))
    : null;
  const savingErrorMessage = savingError
    ? (getErrorMessage(savingError) ?? t('cashier.operational_note_save_error'))
    : null;
  const notesContentId = `operational-notes-${order.id}`;
  const locale = i18n?.language || 'en';

  const formatCreatedAt = (createdAt: string): string => {
    const date = new Date(createdAt);
    return Number.isNaN(date.getTime())
      ? createdAt
      : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  return (
    <section className={styles.notesSection} aria-busy={isLoading}>
      <button
        type="button"
        className={styles.notesHeader}
        aria-expanded={notesExpanded}
        aria-controls={notesContentId}
        onClick={() => setNotesExpanded(!notesExpanded)}
      >
        <span className={styles.notesHeaderLeft}>
          <AlertCircle size={18} aria-hidden="true" />
          <span className={styles.notesTitle}>{t('cashier.operational_notes_title')}</span>
          {!isLoading && notes.length > 0 && <span className={styles.notesBadge}>{notes.length}</span>}
        </span>
        <ChevronDown className={notesExpanded ? styles.notesChevronOpen : styles.notesChevron} aria-hidden="true" />
      </button>

      {notesExpanded && (
        <div id={notesContentId} className={styles.notesContent}>
          {loadingErrorMessage && <p role="alert">{loadingErrorMessage}</p>}
          {!isLoading && !loadingErrorMessage && notes.length === 0 && (
            <p className={styles.notesEmpty}>{t('cashier.operational_note_empty')}</p>
          )}
          {notes.length > 0 && (
            <ul className={styles.notesList} aria-label={t('cashier.operational_notes_title')}>
              {notes.map((note) => {
                const audienceKey =
                  note.audience === 'Kitchen'
                    ? 'cashier.operational_note_audience_kitchen'
                    : 'cashier.operational_note_audience_staff';
                return (
                  <li key={note.id} className={styles.existingNote}>
                    <p className={styles.noteText}>{note.text}</p>
                    <div className={styles.noteMetadata}>
                      <span className={styles.noteAudience}>{t(audienceKey)}</span>
                      <span>{note.createdBy}</span>
                      <time dateTime={note.createdAt}>{formatCreatedAt(note.createdAt)}</time>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <form
            className={styles.noteForm}
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <fieldset className={styles.audienceFieldset} disabled={isSaving}>
              <legend className={styles.audienceLegend}>{t('cashier.operational_note_audience_label')}</legend>
              <label className={styles.audienceOption}>
                <input
                  type="radio"
                  name={`operational-note-audience-${order.id}`}
                  checked={draft.audience === 'Kitchen'}
                  onChange={() => setAudience('Kitchen')}
                />
                {t('cashier.operational_note_audience_kitchen')}
              </label>
              <label className={styles.audienceOption}>
                <input
                  type="radio"
                  name={`operational-note-audience-${order.id}`}
                  checked={draft.audience === 'Staff'}
                  onChange={() => setAudience('Staff')}
                />
                {t('cashier.operational_note_audience_staff')}
              </label>
            </fieldset>
            <FormField label={t('cashier.operational_note_text_label')} error={savingErrorMessage ?? undefined}>
              <textarea
                className={styles.noteTextarea}
                value={draft.text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
                maxLength={500}
                required
                disabled={isSaving}
              />
            </FormField>
            <div className={styles.noteFooter}>
              <span className={styles.charCount}>{draft.text.length}/500</span>
              <button className={styles.noteButton} type="submit" disabled={!draft.text.trim() || isSaving}>
                <CheckCircle size={16} aria-hidden="true" />
                {t(isSaving ? 'cashier.operational_note_saving' : 'cashier.operational_note_save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
