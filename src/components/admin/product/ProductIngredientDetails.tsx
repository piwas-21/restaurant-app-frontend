'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import Switch from '@/components/design-system/Switch';
import type { ProductIngredient } from '@/types/menu';
import styles from './ProductIngredientDetails.module.css';

/**
 * The panel behind a row's disclosure button: the ingredient's `isActive` flag, and nothing else.
 *
 * It used to hold the per-locale names too, and said so in its own comment — *"they live here
 * until D2 takes the translations away"*. Slice S4 is that removal: the Translations tab
 * (`product-editor/translations/`) is now the ONE place any string on this item is translated, so
 * a second per-locale grid here would be a rival editor for the same field, which is exactly the
 * three-UI mess D2 exists to end.
 *
 * `isActive` stays because the other half of that comment still holds: the approved row screen
 * draws no control for it, and a shipped field with no control is a field the next save cannot
 * change.
 */
interface ProductIngredientDetailsProps {
  id: string;
  ingredient: ProductIngredient;
  onPatch: (patch: Partial<ProductIngredient>) => void;
}

export default function ProductIngredientDetails({ id, ingredient, onPatch }: Readonly<ProductIngredientDetailsProps>) {
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
      </td>
    </tr>
  );
}
