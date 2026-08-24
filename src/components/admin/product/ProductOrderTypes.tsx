import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderType } from '@/types/order';
import { exactMaskFromOrderTypes, orderTypesFromMask } from '@/utils/orderChannels';
import { orderTypeLabel } from '@/utils/orderTypeLabels';
import ChannelPicker from '@/components/design-system/ChannelPicker';
import type { Category } from './types';
import styles from './ProductOrderTypes.module.css';

interface ProductOrderTypesProps {
  /** Raw stored mask. `null` = inherit from the primary category. */
  readonly value: number | null;
  readonly onChange: (next: number | null) => void;
  readonly categories: Category[];
  /** The form's current `primaryCategoryId` — what "Inherit" resolves against. */
  readonly primaryCategoryId: string;
  /**
   * Changes only the no-primary-category notice. A bundle has no category control in this editor,
   * so telling its admin to "set a primary category" points at something that does not exist —
   * Custom is the only way to restrict a combo.
   */
  readonly isBundle?: boolean;
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
 * Bundles render it too since §9.2 — both bundle commands now store a mask. For a combo it is the
 * only way to restrict at all: this editor has no category control, so a UI-created bundle has no
 * primary category to inherit from.
 */
export default function ProductOrderTypes({
  value,
  onChange,
  categories,
  primaryCategoryId,
  isBundle = false,
  error,
}: ProductOrderTypesProps) {
  const { t } = useTranslation();
  // Scopes the radio group and the checkbox ids to this instance. Radio grouping is form-scoped, so
  // a fixed `name` is fine in the app today (one editor per form) but silently couples two
  // instances rendered into the same document — which is exactly what a component test does.
  const uid = useId();

  const label = (orderType: OrderType) => orderTypeLabel(orderType, t);

  const primaryCategory = categories.find((category) => category.id === primaryCategoryId);
  // The category list is fetched after mount, so it is empty on the first render of an existing
  // product. Treat that as "not known yet" rather than "no primary category" — otherwise the
  // editor greets every edit with a warning that the item has no category to inherit from.
  const categoriesLoaded = categories.length > 0;
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
        <input type="radio" name={`${uid}-mode`} checked={isInheriting} onChange={() => onChange(null)} />
        <span>
          {primaryCategory
            ? t('product_order_types_inherit_named', 'Inherit from category ({{category}}: {{orderTypes}})', {
                category: primaryCategory.name,
                orderTypes: inheritedTypes.map(label).join(', '),
              })
            : t('product_order_types_inherit', 'Inherit from category')}
        </span>
      </label>

      {/* A bundle shows its notice UNCONDITIONALLY. `categoriesLoaded` exists to suppress a false
          warning during the category fetch — but `useEditorCategories` deliberately never fetches
          categories for a bundle, so for a combo that guard is not "wait and see", it is "never",
          and the one notice written to explain the empty Inherit option would never appear. */}
      {isBundle && (
        <p className={styles.warning}>
          {t(
            'product_order_types_no_primary_warning_bundle',
            'This editor cannot give a combo a category, so there is nothing to inherit — it stays available on every order type until you choose Custom.',
          )}
        </p>
      )}

      {!isBundle && categoriesLoaded && !primaryCategory && (
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
          name={`${uid}-mode`}
          checked={!isInheriting}
          onChange={() => onChange(exactMaskFromOrderTypes(selected))}
        />
        <span>{t('product_order_types_custom', 'Custom')}</span>
      </label>

      {/* The shared picker. This screen hands it its OWN group/error classes rather than wrapping
          it in a div: the wrapper would have made the error a flex ITEM beside the checkbox row —
          it belongs below, unindented, as a direct child of the fieldset's column. */}
      <ChannelPicker
        selected={selected}
        onToggle={toggle}
        disabled={isInheriting}
        error={error}
        errorId={`${uid}-error`}
        styles={{ group: styles.channels, error: styles.error }}
      />
    </fieldset>
  );
}
