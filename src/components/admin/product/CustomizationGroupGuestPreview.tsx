'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { ProductIngredient } from '@/app/admin/menu-management/interfaces';
import type { ProductCustomizationGroupDraft } from '@/types/menu';
import { formatCurrency } from '@/utils/currency';
import styles from './CustomizationGroupEditor.module.css';

export default function CustomizationGroupGuestPreview({
  group,
  ingredients,
}: {
  readonly group: ProductCustomizationGroupDraft;
  readonly ingredients: readonly ProductIngredient[];
}) {
  const { t } = useTranslation();
  let rule = t('catalogue_choose_range', { min: group.minSelection, max: group.maxSelection });
  if (group.minSelection === group.maxSelection) {
    rule = t('catalogue_choose_exactly', { count: group.minSelection });
  } else if (group.minSelection === 0) {
    rule = t('catalogue_choose_up_to', { count: group.maxSelection });
  }
  const options = [
    ...group.ingredientOptions.map((option) => {
      const ingredient = ingredients.find((row) => row.id === option.productIngredientId);
      return { name: ingredient?.name ?? option.productIngredientId, price: ingredient?.price ?? 0 };
    }),
    ...group.productOptions.map((option) => ({ name: option.optionProductName, price: option.additionalPrice })),
  ];
  return (
    <div className={styles.preview}>
      <span className={styles.previewLabel}>{t('choice_group_guest_preview')}</span>
      <strong dir="auto">{group.name || t('choice_group_name_placeholder')}</strong>
      {!group.isActive && <StatusBadge tone="neutral">{t('inactive')}</StatusBadge>}
      <span>{rule}</span>
      {options.length > 0 && (
        <p dir="auto">
          {options
            .map((option) => (option.price > 0 ? `${option.name} (+${formatCurrency(option.price)})` : option.name))
            .join(' · ')}
        </p>
      )}
      {group.includedFreeUnits > 0 && (
        <small>{t('choice_group_preview_included', { count: group.includedFreeUnits })}</small>
      )}
    </div>
  );
}
