import React from 'react';
import { useTranslation } from 'react-i18next';
import { useWatch, type Control, type FieldValues, type UseFormRegister } from 'react-hook-form';
import type { Variation } from '@/app/admin/menu-management/interfaces';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import styles from './ProductAdvancedFields.module.css';
import EditorHelpDisclosure from '@/components/admin/product-editor/EditorHelpDisclosure';
import ProductParentBundleReferences from './ProductParentBundleReferences';

/** The `aria-describedby` target for the option-only checkbox. */
const IS_COMPONENT_HELP_ID = 'product-is-component-help';

interface ProductAdvancedFieldsProps {
  // readonly: S6759 — component props are never mutated.
  readonly register: UseFormRegister<FieldValues>;
  readonly control: Control<FieldValues>;
  readonly productId?: string;
  readonly variations: Variation[];
  readonly onNavigate?: (href: string) => void;
}

/**
 * Focused **Advanced** panel in the product editor.
 *
 * One control now: `isComponent`, the OPTION-ONLY flag that keeps one of a bundle's six meats off
 * the guest menu (frontend #631). It stays mounted when another editor panel is selected, because a
 * field the form stops rendering is a field the PUT clears (plan §6).
 *
 * **Two controls left this section, and both left for the same reason: they were filed by how
 * OFTEN they are touched rather than by what they are about.**
 *
 * - `hideBaseProduct` is now the ACTIVE switch on the variations table's own base row. It only ever
 *   meant "offer this item as itself, alongside its sizes", so it belongs in the list it edits —
 *   and it was phrased as the negative of what the admin was looking at.
 * - The product TYPE is in Basics. It is not a once-a-lifetime setting at all: it decides
 *   whether the item is offered as a drink or a dessert in the guest sheet's upsell steps
 *   (`groupSuggestedSideItems`) and whether it is offered a generic drinks step of its own
 *   (`offersGenericDrinks`). Collapsed under Advanced with a default of `mainItem`, a tenant's
 *   drinks stayed typed as main items and the upsell grouped them wrongly, silently.
 */
export default function ProductAdvancedFields({
  register,
  control,
  productId,
  variations,
  onNavigate,
}: ProductAdvancedFieldsProps) {
  const { t } = useTranslation();
  const isComponent = Boolean(useWatch({ control, name: 'isComponent' }));

  return (
    <div className={modalStyles.formColumn}>
      {/*
        NEVER conditional: an option-only item is a plain item with no precondition to hide behind,
        and the box is the only place the flag can be turned back OFF — a control that appeared only
        for items that already carry the flag would be a one-way door. The sentence is `aria-describedby`, not a bare `<p>`, because the consequence is
        invisible from the label: the item leaves the guest menu.
      */}
      <div className={modalStyles.chipGroup}>
        <div className={modalStyles.chip}>
          <input
            type="checkbox"
            id="product-is-component"
            aria-describedby={IS_COMPONENT_HELP_ID}
            {...register('isComponent')}
          />
          <label htmlFor="product-is-component">{t('option_only_item')}</label>
        </div>
        <p id={IS_COMPONENT_HELP_ID} className={styles.help}>
          {t('option_only_item_help')}
        </p>
        <EditorHelpDisclosure label={t('option_only_item_help_label')}>
          <p>{t('option_only_item_example')}</p>
        </EditorHelpDisclosure>
      </div>
      {isComponent && productId && (
        <ProductParentBundleReferences productId={productId} variations={variations} onNavigate={onNavigate} />
      )}
    </div>
  );
}
