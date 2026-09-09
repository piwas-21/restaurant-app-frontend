'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { getLanguageNativeName, LANGUAGE_CODES } from '@/config/languageConfig';
import StatusBadge from '@/components/design-system/StatusBadge';
import { directionFor } from '@/lib/textDirection';
import type { IngredientEntry } from '@/utils/ingredientTranslationEntries';
import type { EntryEdits } from '@/hooks/admin/useIngredientTranslations';
import styles from './IngredientTranslationsGrid.module.css';

interface IngredientRowProps {
  readonly entry: IngredientEntry;
  /** The admin's unsaved edits for this entry, by locale. */
  readonly edits: EntryEdits;
  readonly isDirty: boolean;
  readonly onEdit: (locale: string, name: string) => void;
}

/**
 * One ingredient of the manager: its identity cell (default name, kind, how many products carry
 * it, which copies disagree or lack a locale) and one name input per supported language.
 *
 * An input shows the CONSENSUS reading of its locale across every copy; a red outline marks a
 * locale where copies disagree (the value shown is one of them), a dashed outline one where some
 * copies have no name at all. A tinted row marks UNSAVED edits — the page's sticky save bar
 * batch-applies them, one bulk-apply per entry that writes EVERY copy.
 */
export default function IngredientRow({ entry, edits, isDirty, onEdit }: Readonly<IngredientRowProps>) {
  const { t } = useTranslation();

  const conflictCount = LANGUAGE_CODES.filter((locale) => entry.cells[locale].disagreements > 0).length;
  const missingCount = LANGUAGE_CODES.filter((locale) => entry.cells[locale].missing > 0).length;

  return (
    <tr className={isDirty ? styles.dirtyRow : undefined}>
      <td className={styles.identity}>
        <span className={styles.ingredientName} dir="auto">
          {entry.defaultName}
        </span>
        <span className={styles.meta}>
          <StatusBadge tone={entry.isSauce ? 'warning' : 'neutral'}>
            {entry.isSauce ? t('sauces') : t('ingredients')}
          </StatusBadge>
          <span className={styles.usage} title={String(entry.copies.length)}>
            {entry.copies.length}
          </span>
          {conflictCount > 0 && <StatusBadge tone="danger">{t('ingredient_translations_conflict')}</StatusBadge>}
          {missingCount > 0 && <StatusBadge tone="warning">{t('ingredient_translations_incomplete')}</StatusBadge>}
          {!entry.globalIngredientId && (
            <StatusBadge tone="neutral">{t('ingredient_translations_unlinked')}</StatusBadge>
          )}
        </span>
      </td>
      {LANGUAGE_CODES.map((locale) => {
        const cell = entry.cells[locale];
        const value = edits[locale] ?? cell.value;
        return (
          <td key={locale} className={styles.localeCell}>
            <input
              type="text"
              className={`${styles.localeInput} ${cell.disagreements > 0 ? styles.conflict : ''} ${
                cell.missing > 0 ? styles.missing : ''
              }`}
              dir={directionFor(locale)}
              lang={locale}
              value={value}
              aria-label={`${getLanguageNativeName(locale)} · ${t('editor_translations_field_ingredient_name')}`}
              onChange={(event) => onEdit(locale, event.target.value)}
            />
          </td>
        );
      })}
    </tr>
  );
}
