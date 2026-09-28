import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SuggestedSideItemsPickerProps } from './types';
import { useSideItemDetails } from '@/hooks/admin/useSideItemDetails';
import SideItemPickerModal from './SideItemPickerModal';
import { sideItemLabel } from './sideItemPicker';
import EditorHelpDisclosure from '@/components/admin/product-editor/EditorHelpDisclosure';
import { formatCurrency } from '@/utils/currency';
import adminStyles from '@/app/styles/AdminPage.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import styles from './SuggestedSideItemsPicker.module.css';

/**
 * The `Options & sides` section: what this dish suggests, and the way in to change it (plan S9 /
 * **D12**).
 *
 * The section is a readout plus one picker button. Each selected side also has a named remove
 * action for the common one-item change; both paths update the same draft field.
 */
export const SuggestedSideItemsPicker: React.FC<SuggestedSideItemsPickerProps> = ({
  errors,
  control,
  selectedSideItemIds,
  onChange,
  productId,
}) => {
  const { t } = useTranslation();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const { detailsError, selectedItemsDetails } = useSideItemDetails(selectedSideItemIds);

  const removeItem = (idToRemove: string) => onChange(selectedSideItemIds.filter((id) => id !== idToRemove));

  return (
    <div className={modalStyles.formGroup}>
      <h3>
        {t('suggested_side_items')} {t('optional')}
      </h3>
      <p>{t('suggested_side_items_description')}</p>
      <EditorHelpDisclosure label={t('suggested_side_items_help_label')}>
        <p>{t('suggested_side_items_example')}</p>
      </EditorHelpDisclosure>
      {errors.suggestedSideItemIds && <p className={modalStyles.errorMessage}>{errors.suggestedSideItemIds.message}</p>}
      {/* Why the names below may be ids rather than dishes. Without this the chips just read
          `Item 3f2a9c11...` with nothing to explain them. */}
      {detailsError && (
        <p className={modalStyles.errorMessage} role="alert">
          {detailsError}
        </p>
      )}

      {selectedSideItemIds.length === 0 ? (
        <p className={modalStyles.emptyState}>{t('no_side_items_selected')}</p>
      ) : (
        <ul className={styles.sideList}>
          {selectedSideItemIds.map((id) => {
            const detail = selectedItemsDetails.get(id);
            const name = sideItemLabel(id, selectedItemsDetails);
            return (
              <li key={id} className={styles.sideRow}>
                <span className={styles.sideName}>{name}</span>
                {detail?.basePrice !== undefined && (
                  <span className={styles.sidePrice}>{formatCurrency(detail.basePrice)}</span>
                )}
                <button
                  type="button"
                  onClick={() => removeItem(id)}
                  className={styles.removeButton}
                  aria-label={`${t('remove')}: ${name}`}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        className={`${adminStyles.adminButton} ${adminStyles.add}`}
        onClick={() => setIsPickerOpen(true)}
      >
        {t('side_items_picker_open')}
      </button>

      {/* Mounted only while open — see the modal's own note: that is what seeds its draft from the
          current selection and throws it away on Cancel, with no reseeding effect to get wrong. */}
      {isPickerOpen && (
        <SideItemPickerModal
          selectedSideItemIds={selectedSideItemIds}
          selectedItemsDetails={selectedItemsDetails}
          onApply={onChange}
          onClose={() => setIsPickerOpen(false)}
          productId={productId}
        />
      )}

      {/* Hidden input for form registration */}
      <Controller
        name="suggestedSideItemIds"
        control={control}
        render={({ field }) => <input type="hidden" {...field} value={selectedSideItemIds.join(',')} />}
      />
    </div>
  );
};
