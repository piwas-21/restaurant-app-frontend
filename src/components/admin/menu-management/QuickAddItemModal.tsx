'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import { useQuickAddItem } from '@/hooks/admin/useQuickAddItem';
import { TENANT_CURRENCY } from '@/utils/currency';
import styles from './QuickAddItemModal.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface QuickAddItemModalProps {
  // readonly: S6759 — component props are never mutated.
  readonly isOpen: boolean;
  readonly onClose: () => void;
  /** `Save and open`: the row exists, take the admin to its editor. */
  readonly onCreated: (productId: string) => void;
  /** `Save and add another`: the row exists, the list behind the modal is stale. */
  readonly onAddedAnother: () => void;
}

const FORM_ID = 'quick-add-item-form';
const CURRENCY_ID = 'quick-add-price-currency';

/**
 * Quick-add a menu item (MENU-ITEM-EDITOR-REDESIGN-PLAN, slice S3 / decision D3).
 *
 * Name, price, category — then the item's own edit page, where photos, ingredients and
 * translations live. This is the ONLY way an item is created now: the `/new` route is a bundle
 * page, so the create/edit divergence the audit measured (a create-only staged image input, a
 * `primaryCategoryId` required on create but conditional on edit) has nowhere left to live.
 *
 * The strict-subset rule is enforced by `useQuickAddItem` and by the schema it resolves with;
 * this file is the surface. Two submit paths, exactly as the approved screen draws them:
 * `Save and add another` is the FORM's own submit — so Enter commits and re-opens it empty, which
 * is what makes typing a menu in one sitting bearable — and `Save and open` is the primary action.
 * Both live in the modal's footer, i.e. OUTSIDE the form element, and reach it through the `form`
 * attribute — the same association the editor's one Save uses for the same reason.
 */
export default function QuickAddItemModal({ isOpen, onClose, onCreated, onAddedAnother }: QuickAddItemModalProps) {
  const { t } = useTranslation();
  const quickAdd = useQuickAddItem({ onCreated, onAddedAnother });
  const { form, errors, categories, categoriesError, selectedCategoryId, selectCategory, isSubmitting } = quickAdd;

  // One select, two fields (see the hook). Whichever of the pair failed, the sentence belongs
  // under the control the admin can actually act on.
  const categoryError = (errors.categoryIds?.message ?? errors.primaryCategoryId?.message) as string | undefined;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('quick_add_item_title')}
      size="sm"
      footer={
        <div className={styles.footerStack}>
          <p className={styles.hint}>{t('quick_add_item_hint')}</p>
          <div className={styles.actions}>
            <button
              type="submit"
              form={FORM_ID}
              className={styles.ghostButton}
              disabled={isSubmitting}
              aria-keyshortcuts="Enter"
            >
              {t('quick_add_save_and_another')}
              <kbd className={styles.kbd}>{t('keyboard_key_enter')}</kbd>
            </button>
            <button
              type="button"
              className={modalStyles.submitButton}
              disabled={isSubmitting}
              onClick={quickAdd.saveAndOpen}
            >
              {isSubmitting ? t('saving') : t('quick_add_save_and_open')}
            </button>
          </div>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={quickAdd.saveAndAddAnother} className={styles.form} noValidate>
        <FormField label={t('item_name')} error={errors.name?.message as string | undefined}>
          {/* autoFocus: the modal exists to take this one answer, and the approved screen draws
              the caret in it. Same call as `DeleteConfirmationModal`'s. */}
          <input className={styles.input} autoFocus {...form.register('name')} />
        </FormField>

        <div className={styles.row}>
          <FormField label={t('price')} error={errors.basePrice?.message as string | undefined}>
            {/* The currency is the tenant's, read from config — the screen's `$` is wrong here
                (handover §3). It is a suffix and not part of the value: the control stays the
                plain number input the full editor's base price is.

                It is `aria-describedby`, NOT `aria-hidden`. The design review's cosmetic note on
                #584 was right and it was not cosmetic: a currency drawn for sighted users and
                hidden from everyone else leaves a screen reader announcing a bare "Price". The
                field is now heard as "Price … CHF", the same wording the full editor's base price
                got in S7. */}
            <span className={styles.priceBox}>
              <input
                className={`${styles.input} ${styles.priceInput}`}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                aria-describedby={CURRENCY_ID}
                {...form.register('basePrice')}
              />
              <span id={CURRENCY_ID} className={styles.currency}>
                {TENANT_CURRENCY}
              </span>
            </span>
          </FormField>

          <FormField label={t('category')} error={categoryError}>
            <select
              className={styles.input}
              value={selectedCategoryId}
              onChange={(event) => selectCategory(event.target.value)}
            >
              <option value="">{t('select_category')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {/* An empty select means one of two things — no categories yet, or a failed fetch — and
            the admin cannot tell them apart. Same sentence, same reason, as the editor's chips. */}
        {categoriesError && (
          <p role="alert" data-testid="quick-add-categories-error" className={styles.error}>
            {categoriesError}
          </p>
        )}

        {errors.root && <p className={styles.error}>{errors.root.message as string}</p>}
      </form>
    </BaseModal>
  );
}
