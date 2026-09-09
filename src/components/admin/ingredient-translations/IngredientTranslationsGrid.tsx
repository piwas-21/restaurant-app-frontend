'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { getLanguageNativeName, LANGUAGE_CODES } from '@/config/languageConfig';
import IngredientRow from './IngredientRow';
import type { IngredientEntry } from '@/utils/ingredientTranslationEntries';
import type { EntryEdits } from '@/hooks/admin/useIngredientTranslations';
import styles from './IngredientTranslationsGrid.module.css';

interface IngredientTranslationsGridProps {
  readonly entries: readonly IngredientEntry[];
  readonly edits: Readonly<Record<string, EntryEdits>>;
  readonly dirtyKeys: ReadonlySet<string>;
  readonly savingKey: string | null;
  readonly onEdit: (entryKey: string, locale: string, name: string) => void;
  readonly onSave: (entry: IngredientEntry) => void;
}

/**
 * The manager's table: one row per distinct ingredient or sauce, one input per supported
 * language, in the SAME order `LANGUAGE_CODES` fixes for every other translation screen.
 *
 * It scrolls horizontally rather than squeezing the ten locale columns — the identity column
 * sticks, so the row never loses its "what am I editing" anchor while a translator scrolls
 * between `العربية` and `中文`.
 */
export default function IngredientTranslationsGrid({
  entries,
  edits,
  dirtyKeys,
  savingKey,
  onEdit,
  onSave,
}: Readonly<IngredientTranslationsGridProps>) {
  const { t } = useTranslation();

  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.identity} scope="col">
              {t('ingredients')}
            </th>
            {LANGUAGE_CODES.map((locale) => (
              <th key={locale} className={styles.localeCell} scope="col">
                {getLanguageNativeName(locale)}
              </th>
            ))}
            <th className={styles.actions} scope="col" aria-label={t('save')} />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <IngredientRow
              key={entry.key}
              entry={entry}
              edits={edits[entry.key] ?? {}}
              isDirty={dirtyKeys.has(entry.key)}
              isSaving={savingKey === entry.key}
              onEdit={(locale, name) => onEdit(entry.key, locale, name)}
              onSave={() => onSave(entry)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
