import React from 'react';
import { useTranslation } from 'react-i18next';
import { OrderType } from '@/types/order';
import { ALL_ORDER_TYPES, exactMaskFromOrderTypes, orderTypesFromMask } from '@/utils/orderChannels';
import { ORDER_TYPE_LABEL_KEY } from '@/utils/orderTypeLabels';
import type { Category } from './types';
import styles from './ProductOrderTypes.module.css';

interface ProductOrderTypesProps {
  /** Raw stored mask. `null` = inherit from the primary category. */
  readonly value: number | null;
  readonly onChange: (next: number | null) => void;
  readonly categories: Category[];
  /** The form's current `primaryCategoryId` — what "Inherit" resolves against. */
  readonly primaryCategoryId: string;
  readonly error?: string;
}

/**
 * Per-item order-type availability (ORDER-TYPE-AVAILABILITY-PLAN §4.6).
 *
 * Inheritance is ALL-OR-NOTHING: the mask is a single nullable field, so a product either inherits
 * its primary category's channels entirely or overrides them entirely. There is deliberately no
 * per-channel "inherit" toggle — that would need a second field to express and a rule for
 * resolving the two, which is exactly the "two independent flag sets" model §2 rejected.
 *
 * Bundles do not render this: no bundle command accepts a mask, so the control would offer a save
 * that silently does nothing (plan §9.2).
 */
export default function ProductOrderTypes({
  value,
  onChange,
  categories,
  primaryCategoryId,
  error,
}: ProductOrderTypesProps) {
  const { t } = useTranslation();

  const label = (orderType: OrderType) =>
    t(ORDER_TYPE_LABEL_KEY[orderType].key, ORDER_TYPE_LABEL_KEY[orderType].fallback);

  const primaryCategory = categories.find((category) => category.id === primaryCategoryId);
  const inheritedTypes = orderTypesFromMask(primaryCategory?.availableOrderTypes);
  const isInheriting = value === null;
  // While inheriting, the boxes preview what is inherited — so switching to Custom starts from the
  // set already in force rather than from an empty selection the admin then has to rebuild.
  const selected = isInheriting ? inheritedTypes : orderTypesFromMask(value);

  const toggle = (orderType: OrderType) => {
    const next = selected.includes(orderType)
      ? selected.filter((type) => type !== orderType)
      : [...selected, orderType];
    // Exact, never collapsed: an explicit all-three override must stay 7. Collapsing it to null
    // would hand the item straight back to a takeaway-only category.
    onChange(exactMaskFromOrderTypes(next));
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{t('product_order_types', 'Order type availability')}</legend>

      <label className={styles.choice}>
        <input type="radio" name="product-order-types-mode" checked={isInheriting} onChange={() => onChange(null)} />
        <span>
          {primaryCategory
            ? t('product_order_types_inherit_named', 'Inherit from category ({{category}}: {{orderTypes}})', {
                category: primaryCategory.name,
                orderTypes: inheritedTypes.map(label).join(', '),
              })
            : t('product_order_types_inherit', 'Inherit from category')}
        </span>
      </label>

      {!primaryCategory && (
        <p className={styles.warning}>
          {t(
            'product_order_types_no_primary_warning',
            'No primary category selected, so there is nothing to inherit — this item stays available on every order type until you set one or choose Custom.',
          )}
        </p>
      )}

      <label className={styles.choice}>
        <input
          type="radio"
          name="product-order-types-mode"
          checked={!isInheriting}
          onChange={() => onChange(exactMaskFromOrderTypes(selected))}
        />
        <span>{t('product_order_types_custom', 'Custom')}</span>
      </label>

      <div className={styles.channels}>
        {ALL_ORDER_TYPES.map((orderType) => (
          <div key={orderType} className={styles.channel}>
            <input
              type="checkbox"
              id={`product-order-type-${orderType}`}
              checked={selected.includes(orderType)}
              disabled={isInheriting}
              onChange={() => toggle(orderType)}
            />
            <label htmlFor={`product-order-type-${orderType}`}>{label(orderType)}</label>
          </div>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </fieldset>
  );
}
