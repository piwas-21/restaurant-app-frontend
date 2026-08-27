'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import CheckboxField from '@/components/design-system/CheckboxField';
import type { GlobalIngredientSummary } from '@/services/globalIngredientService';
import styles from './GlobalIngredientPickerModal.module.css';

interface GlobalIngredientPickerRowProps {
  ingredient: GlobalIngredientSummary;
  checked: boolean;
  /** Already on the product: shown, but not offerable a second time. */
  alreadyAdded: boolean;
  onToggle: (checked: boolean) => void;
}

/**
 * One library row: tick box, the number of translations it carries, and a preview of them.
 *
 * The translation count is the row's real selling point — it is how many free-text inputs picking
 * this row saves — so it is rendered as a number with a translated `aria-label` rather than as an
 * interpolated "N languages" string, which would need per-locale plural forms in ten bundles to
 * avoid reading "1 languages".
 */
export default function GlobalIngredientPickerRow({
  ingredient,
  checked,
  alreadyAdded,
  onToggle,
}: GlobalIngredientPickerRowProps) {
  const { t } = useTranslation();
  const preview = ingredient.translations
    .slice(0, 3)
    .map((translation) => translation.name)
    .join(' · ');

  return (
    <li className={`${styles.row} ${alreadyAdded ? styles.rowDisabled : ''}`}>
      <CheckboxField
        label={ingredient.defaultName}
        checked={checked}
        disabled={alreadyAdded}
        description={alreadyAdded ? t('already_added') : undefined}
        onChange={onToggle}
      />
      <span className={styles.meta}>
        <span
          className={styles.badge}
          aria-label={t('ingredient_library_languages', { count: ingredient.translations.length })}
        >
          <Globe size={12} aria-hidden="true" />
          {ingredient.translations.length}
        </span>
        <span className={styles.preview}>{preview}</span>
      </span>
    </li>
  );
}
