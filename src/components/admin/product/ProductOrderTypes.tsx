import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderType } from '@/types/order';
import { exactMaskFromOrderTypes, orderTypesFromMask } from '@/utils/orderChannels';
import { orderTypeLabel } from '@/utils/orderTypeLabels';
import ChannelPicker from '@/components/design-system/ChannelPicker';
import Switch from '@/components/design-system/Switch';
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
   * The override switch is the only way to restrict a combo.
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
  // Scopes this instance's error id. It used to scope a radio `name` too — radio grouping is
  // form-scoped, so a fixed name silently coupled two instances rendered into one document, which
  // is exactly what a component test does. The radios are gone (D6), the id hygiene is not:
  // `ChannelPicker` points `aria-describedby` at this id and two pickers must not share one.
  const uid = useId();

  const label = (orderType: OrderType) => orderTypeLabel(orderType, t);

  const primaryCategory = categories.find((category) => category.id === primaryCategoryId);
  // The category list is fetched after mount, so it is empty on the first render of an existing
  // product. Treat that as "not known yet" rather than "no primary category" — otherwise the
  // editor greets every edit with a warning that the item has no category to inherit from.
  const categoriesLoaded = categories.length > 0;
  const inheritedTypes = orderTypesFromMask(primaryCategory?.availableOrderTypes);
  const isInheriting = value === null;
  // While inheriting, the boxes preview what is inherited — so turning the override on starts from the
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

  /**
   * The switch is the ONE place `null` is written and the ONE place it stops being written, which
   * is why both directions are spelled out rather than folded into a ternary on `value`.
   *
   * ON — `exactMaskFromOrderTypes(selected)`, NEVER `maskFromOrderTypes`. When the inherited set is
   * all three channels the two disagree by exactly the thing this control exists to express:
   * `maskFromOrderTypes` collapses a full set to `null` (right for a CATEGORY, where null means
   * "all"), which on a PRODUCT means INHERIT — so turning the override on would appear to work,
   * store nothing, and hand the item back to its category the next time that category changed. The
   * two states look identical in a UI drawing three ticked boxes; they are opposites in the data.
   *
   * OFF — `null`, and nothing else. Not "the mask it had", not 0: `0` is rejected by the API
   * (`OrderChannelMaskRule`: null, or 1..7) because it would mean "orderable on no channel". D6's
   * rule is that clearing an override RETURNS the field to inheritance rather than freezing the
   * last value, and `null` is literally that.
   */
  const setOverride = (isOverriding: boolean) => onChange(isOverriding ? exactMaskFromOrderTypes(selected) : null);

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{t('product_order_types', 'Order type availability')}</legend>

      {/* D6 — the inherited value is SHOWN, not blanked. It stays readable while the override is on,
          so the admin can see what they are departing from instead of having to switch back to
          find out. */}
      <p className={styles.inherited}>
        {primaryCategory
          ? t('product_order_types_inherit_named', 'Inherit from category ({{category}}: {{orderTypes}})', {
              category: primaryCategory.name,
              orderTypes: inheritedTypes.map(label).join(', '),
            })
          : t('product_order_types_inherit', 'Inherit from category')}
      </p>

      {/* A bundle shows its notice UNCONDITIONALLY. `categoriesLoaded` exists to suppress a false
          warning during the category fetch — but `useEditorCategories` deliberately never fetches
          categories for a bundle, so for a combo that guard is not "wait and see", it is "never",
          and the one notice written to explain the empty Inherit option would never appear. */}
      {isBundle && (
        <p className={styles.warning}>
          {t(
            'product_order_types_no_primary_warning_bundle',
            'This editor cannot give a combo a category, so there is nothing to inherit — it stays available on every order type until you turn on the override.',
          )}
        </p>
      )}

      {!isBundle && categoriesLoaded && !primaryCategory && (
        <p className={styles.warning}>
          {t(
            'product_order_types_no_primary_warning',
            'No primary category selected, so there is nothing to inherit — this item stays available on every order type until you set one or turn on the override.',
          )}
        </p>
      )}

      {/* D6 — an explicit Override SWITCH, not a two-option dropdown and not a pair of radios. Two
          radios made "inherit" and "custom" look like two peer choices; the fact is that one is the
          default and the other is a departure from it, which is what a switch says and a radio pair
          does not. `checked` is derived from the VALUE (`value !== null`) rather than held in local
          state, so the control cannot drift from the field it edits — a reset, an undo or a fresh
          product loading into the form all move the switch with them. */}
      <Switch
        label={t('product_order_types_override', 'Override for this item')}
        checked={!isInheriting}
        onChange={(event) => setOverride(event.target.checked)}
      />

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
