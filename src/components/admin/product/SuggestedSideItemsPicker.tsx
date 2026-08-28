import React, { useState } from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SuggestedSideItemsPickerProps } from './types';
import { useSideItemDetails } from '@/hooks/admin/useSideItemDetails';
import SideItemPickerModal from './SideItemPickerModal';
import { sideItemLabel } from './sideItemPicker';
import styles from '@/app/styles/AdminPage.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

/**
 * The `Options & sides` section: what this dish suggests, and the way in to change it (plan S9 /
 * **D12**).
 *
 * The section itself is now only a READOUT plus one button. Everything that decides which items are
 * suggested moved into `SideItemPickerModal`, because the surface this replaces split one decision
 * across two controls in two places — an inline expander that could only add, and an `×` on the
 * chip that was the only way to remove. The chips keep their `×`: it is the one-click path for the
 * common case, and it is the same write.
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
        <div className={modalStyles.chipGroup}>
          {selectedSideItemIds.map((id) => (
            <div key={id} className={modalStyles.chip}>
              <span>{sideItemLabel(id, selectedItemsDetails)}</span>
              <button
                type="button"
                onClick={() => removeItem(id)}
                className={modalStyles.chipRemove}
                aria-label={t('remove')}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button type="button" className={`${styles.adminButton} ${styles.add}`} onClick={() => setIsPickerOpen(true)}>
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
