'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { OptionSetEntry, OptionSetKind } from '@/types/optionSet';
import { formatCurrency } from '@/utils/currency';
import styles from './OptionSetEditorWorkspace.module.css';

interface Props {
  readonly name: string;
  readonly kind: OptionSetKind | '';
  readonly entries: readonly OptionSetEntry[];
}

export default function OptionSetEntriesPreview({ name, kind, entries }: Props) {
  const { t } = useTranslation();
  if (!kind || entries.length === 0) return null;
  return (
    <aside className={styles.guestPreview} aria-label={t('option_set_editor_preview_title')}>
      <h3>{t('option_set_editor_preview_title')}</h3>
      <p>{t('option_set_editor_preview_help')}</p>
      <strong dir="auto">{name || t('option_set_name')}</strong>
      <ol>
        {entries.map((entry, index) => {
          const price =
            kind === 'bundleChoice'
              ? entry.additionalPrice
              : kind === 'ingredient' || kind === 'sauce'
                ? entry.price
                : 0;
          return (
            <li key={entry.id ?? `${entry.name}-${index}`}>
              <span dir="auto">{entry.name || t('option_set_entry_name')}</span>
              {price > 0 && <span>+{formatCurrency(price)}</span>}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
