'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import Switch from '@/components/design-system/Switch';
import type { ProductIngredient } from '@/types/menu';
import { EXCLUSION_GROUP_MAX_LENGTH } from '@/utils/exclusionGroup';
import styles from './ProductIngredientDetails.module.css';

/**
 * The panel behind a row's disclosure button: the ingredient's `isActive` flag and its choice group.
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
 *
 * The CHOICE GROUP (plan §9) is here rather than in the table for the same reason, from the other
 * side: the approved screen draws exactly six columns, the row component is already at 233 of its
 * 250 LOC, and a group key is an occasional advanced setting rather than a per-row fact an admin
 * scans. It is a free-text key scoped to this product — rows sharing it exclude each other — so it
 * needs no catalogue, no id and no second entity (D13).
 */
interface ProductIngredientDetailsProps {
  id: string;
  ingredient: ProductIngredient;
  onPatch: (patch: Partial<ProductIngredient>) => void;
}

export default function ProductIngredientDetails({ id, ingredient, onPatch }: Readonly<ProductIngredientDetailsProps>) {
  const { t } = useTranslation();

  return (
    // The mobile card layout keys off `data-detail-row` in IngredientGroup.module.css — this
    // sheet has no class of its own for the row, and a dead `styles.detailRow` here would be
    // invisible to jest (identity-obj-proxy) and tsc alike.
    <tr data-detail-row>
      <td colSpan={6} className={styles.detailCell} id={id}>
        <Switch
          className={styles.activeToggle}
          label={t('ingredient_is_active')}
          checked={ingredient.isActive}
          onChange={(event) => onPatch({ isActive: event.target.checked })}
        />
        <div className={styles.groupField}>
          <label className={styles.groupLabel} htmlFor={`${id}-choice-group`}>
            {t('ingredient_choice_group')}
          </label>
          <input
            id={`${id}-choice-group`}
            type="text"
            className={styles.groupInput}
            maxLength={EXCLUSION_GROUP_MAX_LENGTH}
            value={ingredient.exclusionGroup ?? ''}
            disabled={!ingredient.isOptional}
            aria-describedby={`${id}-choice-hint`}
            // Sent verbatim; the server trims it and stores a blank as NO GROUP, so clearing the
            // box is how a row leaves its group. Normalising here as well would put a second
            // opinion about the key in the client.
            onChange={(event) => onPatch({ exclusionGroup: event.target.value })}
          />
          <span className={styles.groupHint} id={`${id}-choice-hint`}>
            {ingredient.isOptional ? t('ingredient_choice_group_hint') : t('ingredient_choice_group_optional_required')}
          </span>
        </div>
      </td>
    </tr>
  );
}
