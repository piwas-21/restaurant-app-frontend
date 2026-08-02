'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_ORDER_TYPES } from '@/utils/orderChannels';
import { useCategoryChannelsAdmin, CATEGORY_PAGE_SIZE } from '@/hooks/admin/useCategoryChannelsAdmin';
import { getCategoryDisplayName } from '@/utils/categoryNameMapper';
import CheckboxField from '@/components/design-system/CheckboxField';
import { orderTypeLabel } from '@/utils/orderTypeLabels';
import styles from './CategoryOrderTypeMatrix.module.css';
// The cell skin for the shared checkbox — centred in its cell, no label column (the header is the
// label). The `MenuCardAvailability` recipe: one control, the host supplies the CSS module.
import checkboxStyles from './CategoryOrderTypeCheckbox.module.css';

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
  const { categories, loading, savingId, truncated, selectedTypes, toggle, isDirty, canSave, reset, save } =
    useCategoryChannelsAdmin();

  if (loading) {
    return <p className={styles.loading}>{t('common.loading', 'Loading...')}</p>;
  }

  if (categories.length === 0) {
    return <p className={styles.empty}>{t('no_categories_found', 'No categories found')}</p>;
  }

  return (
    <div className={styles.container}>
      {/* §9.8 — the fetch takes one page. Saying so is the whole fix: a silently truncated matrix
          means a restriction is simply unsettable for the categories that fell off, and nothing on
          screen explains why they are missing. */}
      {truncated && (
        // A plain <p>, deliberately. This is inserted with the whole container after loading, so a
        // live region would announce nothing reliable — and it sits ahead of the intro and the table
        // in reading order anyway. (`role="status"` is also an S6819 target; the repo settled on
        // <output> where a live region IS wanted.)
        <p className={styles.truncated}>
          {t('category_order_types_truncated', {
            // Interpolated, not written into ten strings: the copy and PAGE_SIZE would drift, and a
            // notice that lies about the cap is worse than the cap. `limit`, not `count` — `count`
            // is i18next's plural trigger.
            limit: CATEGORY_PAGE_SIZE,
            defaultValue: 'Only the first {{limit}} categories are shown. The rest cannot be edited yet.',
          })}
        </p>
      )}

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
                  {orderTypeLabel(orderType, t)}
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
              const savable = canSave(category.id);
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
                        {t(
                          'category_no_order_type_warning',
                          'Pick at least one order type. To stop selling this category entirely, turn it off under Categories.',
                        )}
                      </span>
                    )}
                  </td>

                  {ALL_ORDER_TYPES.map((orderType) => {
                    const label = orderTypeLabel(orderType, t);
                    return (
                      <td key={orderType} className={styles.checkboxCell}>
                        {/* The design system's checkbox, with the label VISUALLY hidden: the column
                            header carries the meaning on screen, so showing it in every cell would
                            print the channel name once per category. It is still a real <label>
                            wrapping the input rather than the bare `aria-label` this used to be —
                            which makes the whole cell clickable instead of just the 13px box, and
                            gives a screen reader the row's category as well as the column's
                            channel (a header alone gives it neither). */}
                        <CheckboxField
                          srOnlyLabel
                          label={t('category_order_type_toggle_aria', '{{category}} available for {{orderType}}', {
                            category: displayName,
                            orderType: label,
                          })}
                          checked={selected.includes(orderType)}
                          disabled={busy}
                          onChange={() => toggle(category.id, orderType)}
                          styles={checkboxStyles}
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
                        disabled={!savable || busy}
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
