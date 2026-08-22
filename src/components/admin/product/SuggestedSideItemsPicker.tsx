import React, { useState } from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SuggestedSideItemsPickerProps } from './types';
import { useSideItemSearch } from '@/hooks/admin/useSideItemSearch';
import { useSideItemDetails } from '@/hooks/admin/useSideItemDetails';
import styles from '@/app/styles/AdminPage.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import detailsStyles from '@/app/styles/DetailsPage.module.css';

export const SuggestedSideItemsPicker: React.FC<SuggestedSideItemsPickerProps> = ({
  errors,
  control,
  selectedSideItemIds,
  onChange,
}) => {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);
  // Two independent product reads, each with its own error slot because they appear in different
  // places on screen and one can be live while the other is not.
  const { search, setSearch, results, status, resetSearch, searchError } = useSideItemSearch();
  const { detailsError, selectedItemsDetails } = useSideItemDetails(selectedSideItemIds);

  const toggleSelect = (id: string, checked: boolean) => {
    setTempSelectedIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));
  };

  const saveSelected = () => {
    const newSelectedIds = Array.from(new Set([...selectedSideItemIds, ...tempSelectedIds]));
    onChange(newSelectedIds);
    setShowPicker(false);
    setTempSelectedIds([]);
    resetSearch();
  };

  const removeItem = (idToRemove: string) => {
    const updatedIds = selectedSideItemIds.filter((id) => id !== idToRemove);
    onChange(updatedIds);
  };

  const getSelectedItemsDisplay = () => {
    if (selectedSideItemIds.length === 0) {
      return <p className={modalStyles.emptyState}>{t('no_side_items_selected')}</p>;
    }

    return (
      <div className={modalStyles.chipGroup}>
        {selectedSideItemIds.map((id) => {
          // Get the item name from fetched details, fallback to results, or show ID
          const itemDetails = selectedItemsDetails.get(id);
          const resultItem = results.find((r) => r.id === id);
          const displayName = itemDetails?.name || resultItem?.name || `Item ${id.substring(0, 8)}...`;

          return (
            <div key={id} className={modalStyles.chip}>
              <span>{displayName}</span>
              <button
                type="button"
                onClick={() => removeItem(id)}
                className={modalStyles.chipRemove}
                aria-label={t('remove')}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    );
  };

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

      {getSelectedItemsDisplay()}

      <button type="button" className={`${styles.adminButton} ${styles.add}`} onClick={() => setShowPicker(true)}>
        {t('add_side_items')}
      </button>

      {showPicker && (
        <div className={detailsStyles.formGrid}>
          <div className={modalStyles.formGroup}>
            <label>{t('search_side_items')}</label>
            {/* Type-ahead: the hook debounces and searches on its own, so there is nothing left for
                an Enter key or a Search button to trigger. */}
            <input
              type="text"
              placeholder={t('search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {results.length > 0 && (
            <div className={modalStyles.chipGroup}>
              {results.map((product) => {
                const isSelected = tempSelectedIds.includes(product.id);
                const isAlreadyAdded = selectedSideItemIds.includes(product.id);
                const chipId = `side-item-${product.id}`;

                return (
                  <div
                    key={product.id}
                    className={`${modalStyles.chip} ${isAlreadyAdded ? modalStyles.chipDisabled : ''}`}
                  >
                    <input
                      type="checkbox"
                      id={chipId}
                      checked={isSelected}
                      disabled={isAlreadyAdded}
                      onChange={(e) => toggleSelect(product.id, e.target.checked)}
                    />
                    <label htmlFor={chipId}>
                      {product.name}
                      {isAlreadyAdded && <span className={modalStyles.chipNote}> ({t('already_added')})</span>}
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          {/* `<output>`, not `<p role="status">` — it carries the status role implicitly, which is
              what tells a screen reader an answer is still coming (Sonar S6819, the convention this
              repo settled on). */}
          {status === 'searching' && <output className={modalStyles.emptyState}>{t('searching')}</output>}

          {/* `searchError` first, and it SUPPRESSES the empty state rather than sitting beside it:
              "No side items found" is an answer about the menu, and a failed search has not
              obtained one. The empty state renders from `status`, never from `results.length`:
              under type-ahead the latter would say "none found" after the first keystroke of every
              word anyone types, and again while every request is in flight. */}
          {searchError ? (
            <p className={modalStyles.errorMessage} role="alert">
              {searchError}
            </p>
          ) : (
            status === 'empty' && <p className={modalStyles.emptyState}>{t('no_side_items_found')}</p>
          )}

          <div className={detailsStyles.actionRow}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => {
                setShowPicker(false);
                setTempSelectedIds([]);
                resetSearch();
              }}
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              className={`${styles.adminButton} ${styles.save}`}
              onClick={saveSelected}
              disabled={tempSelectedIds.length === 0}
            >
              {t('add_selected')}
            </button>
          </div>
        </div>
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
