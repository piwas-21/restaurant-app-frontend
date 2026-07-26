'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { OrderType } from '@/types/order';
import { ALL_ORDER_TYPES } from '@/utils/orderChannels';
import { useCategoryChannelsAdmin } from '@/hooks/admin/useCategoryChannelsAdmin';
import { getCategoryDisplayName } from '@/utils/categoryNameMapper';
import styles from './CategoryOrderTypeMatrix.module.css';

const ORDER_TYPE_LABEL_KEY: Record<OrderType, { key: string; fallback: string }> = {
  [OrderType.DineIn]: { key: 'order_type_dine_in', fallback: 'Dine In' },
  [OrderType.Takeaway]: { key: 'order_type_takeaway', fallback: 'Takeaway' },
  [OrderType.Delivery]: { key: 'order_type_delivery', fallback: 'Delivery' },
};

/**
 * The category × order-type availability matrix (rows = categories, columns = order types) — the
 * single write surface for category-level channel availability. `EditCategoryModal` shows the
 * effective value read-only and links here, so there is only ever one writer for the field.
 *
 * Products inherit their category's channels unless they override; per-item exceptions live in the
 * product editor.
 */
export default function CategoryOrderTypeMatrix() {
  const { t } = useTranslation();
  const { categories, loading, savingId, selectedTypes, toggle, isDirty, reset, save } = useCategoryChannelsAdmin();

  if (loading) {
    return <p className={styles.loading}>{t('common.loading', 'Loading...')}</p>;
  }

  if (categories.length === 0) {
    return <p className={styles.empty}>{t('no_categories_found', 'No categories found')}</p>;
  }

  return (
    <div className={styles.container}>
      <p className={styles.intro}>
        {t(
          'category_order_types_intro',
          'Choose which order types each category can be ordered through. Items inherit their category unless you override them individually.',
        )}
      </p>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('category', 'Category')}</th>
              {ALL_ORDER_TYPES.map((orderType) => (
                <th scope="col" key={orderType} className={styles.channelColumn}>
                  {t(ORDER_TYPE_LABEL_KEY[orderType].key, ORDER_TYPE_LABEL_KEY[orderType].fallback)}
                </th>
              ))}
              <th scope="col" aria-label={t('actions', 'Actions')} />
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const selected = selectedTypes(category);
              const isOffSale = selected.length === 0;
              const dirty = isDirty(category.id);
              const busy = savingId !== null;
              const displayName = getCategoryDisplayName(category.name, t);

              return (
                <tr key={category.id} className={isOffSale ? styles.warningRow : undefined}>
                  <td>
                    <span className={styles.categoryName}>{displayName}</span>
                    {typeof category.productCount === 'number' && (
                      <span className={styles.productCount}>
                        {t('items_count', '{{count}} items', { count: category.productCount })}
                      </span>
                    )}
                    {isOffSale && (
                      <span className={styles.warning}>
                        {t('category_off_sale_warning', 'Not orderable on any order type')}
                      </span>
                    )}
                  </td>

                  {ALL_ORDER_TYPES.map((orderType) => {
                    const label = t(ORDER_TYPE_LABEL_KEY[orderType].key, ORDER_TYPE_LABEL_KEY[orderType].fallback);
                    return (
                      <td key={orderType} className={styles.checkboxCell}>
                        <input
                          type="checkbox"
                          checked={selected.includes(orderType)}
                          disabled={busy}
                          onChange={() => toggle(category.id, orderType)}
                          aria-label={t('category_order_type_toggle_aria', '{{category}} available for {{orderType}}', {
                            category: displayName,
                            orderType: label,
                          })}
                        />
                      </td>
                    );
                  })}

                  <td>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.resetButton}
                        onClick={() => reset(category.id)}
                        disabled={!dirty || busy}
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                      <button
                        type="button"
                        className={styles.saveButton}
                        onClick={() => void save(category.id)}
                        disabled={!dirty || busy}
                      >
                        {savingId === category.id ? t('saving', 'Saving...') : t('save', 'Save')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
