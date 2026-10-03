'use client';

import { useTranslation } from 'react-i18next';
import CheckboxField from '@/components/design-system/CheckboxField';
import type { DeliveryChannelCategorySummary } from '@/types/deliveryChannelMenuSelection';
import { categorySelectionState, type DeliveryChannelCategoryOverrideMap } from '@/utils/deliveryChannelMenuSelection';
import styles from './DeliveryChannelCategorySelectionPanel.module.css';

interface Props {
  readonly categories: readonly DeliveryChannelCategorySummary[];
  readonly selectedCategoryIds: ReadonlySet<string>;
  readonly overrides: DeliveryChannelCategoryOverrideMap;
  readonly disabled: boolean;
  readonly limitRecoveryError?: 'categoryLimit' | 'overrideLimit' | null;
  readonly onToggle: (categoryId: string, selected: boolean) => void;
}

export default function DeliveryChannelCategoryList({
  categories,
  selectedCategoryIds,
  overrides,
  disabled,
  limitRecoveryError = null,
  onToggle,
}: Readonly<Props>) {
  const { t } = useTranslation();
  if (categories.length === 0)
    return <p className={styles.empty}>{t('deliveryChannels.menuSelection.noCategories')}</p>;

  return (
    <ul className={styles.categoryList} aria-label={t('deliveryChannels.menuSelection.category')}>
      {categories.map((category) => {
        const state = categorySelectionState(category, selectedCategoryIds, overrides);
        let selectionDescription: string;
        if (state.indeterminate) {
          selectionDescription = t('deliveryChannels.menuSelection.categorySelection.partial');
        } else if (state.selected) {
          selectionDescription = t('deliveryChannels.menuSelection.categorySelection.all');
        } else {
          selectionDescription = t('deliveryChannels.menuSelection.categorySelection.empty');
        }
        return (
          <li key={category.categoryId}>
            <CheckboxField
              label={`${category.name} (${state.count}/${category.totalItemCount})`}
              description={selectionDescription}
              checked={state.selected}
              indeterminate={state.indeterminate}
              disabled={
                disabled ||
                (category.totalItemCount === 0 && !state.selected) ||
                (limitRecoveryError !== null && !state.selected)
              }
              onChange={(value) => onToggle(category.categoryId, value)}
              data-testid={`delivery-channel-category-${category.categoryId}`}
            />
          </li>
        );
      })}
    </ul>
  );
}
