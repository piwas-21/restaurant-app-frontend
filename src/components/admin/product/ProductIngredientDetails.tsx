'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_CODES } from '@/config/languageConfig';
import Switch from '@/components/design-system/Switch';
import type { ProductIngredient } from '@/types/menu';
import styles from './ProductIngredientDetails.module.css';

/**
 * The panel behind a row's globe button: the per-locale names, plus `isActive`.
 *
 * It exists because of a deviation from the approved screen, and the deviation is deliberate. The
 * Stitch row draws a globe glyph next to a translated name and offers no way to edit those names —
 * correct once the Translations tab of MENU-ITEM-EDITOR-REDESIGN-PLAN D2 exists, and that tab is a
 * later slice. `isActive` has no control on the screen at all. Both are shipped fields an admin can
 * set today, and a field with no control is a field the next save cannot change, so they live here
 * until D2 takes the translations away.
 */
interface ProductIngredientDetailsProps {
  id: string;
  ingredient: ProductIngredient;
  onPatch: (patch: Partial<ProductIngredient>) => void;
  onContentChange: (language: string, value: string) => void;
}

export default function ProductIngredientDetails({
  id,
  ingredient,
  onPatch,
  onContentChange,
}: Readonly<ProductIngredientDetailsProps>) {
  const { t } = useTranslation();

  return (
    <tr>
      <td colSpan={6} className={styles.detailCell} id={id}>
        <Switch
          className={styles.activeToggle}
          label={t('ingredient_is_active')}
          checked={ingredient.isActive}
          onChange={(event) => onPatch({ isActive: event.target.checked })}
        />
        <p className={styles.detailHint}>{t('multilingual_names')}</p>
        <div className={styles.translationsGrid}>
          {LANGUAGE_CODES.map((language) => (
            <label key={language} className={styles.translationField}>
              <span>{t(`language_${language}`)}</span>
              <input
                type="text"
                value={ingredient.content?.[language]?.name || ''}
                onChange={(event) => onContentChange(language, event.target.value)}
                placeholder={t('ingredient_name_in_language', { language: t(`language_${language}`) })}
              />
            </label>
          ))}
        </div>
      </td>
    </tr>
  );
}
