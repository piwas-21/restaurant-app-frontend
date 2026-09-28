'use client';

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import CheckboxField from '@/components/design-system/CheckboxField';
import type { MenuAuthoringCandidate } from '@/types/menuAuthoringSearch';
import type { OptionSetEntry, OptionSetKind } from '@/types/optionSet';
import { useOptionSetProductVariations } from '@/hooks/admin/useOptionSetProductVariations';
import styles from './OptionSetEntryRow.module.css';
import OptionSetReferenceSearch from './OptionSetReferenceSearch';

interface Props {
  readonly kind: OptionSetKind;
  readonly entry: OptionSetEntry;
  readonly index: number;
  readonly selectedReferenceAvailable: boolean;
  readonly isPersistedVariationUnchanged: boolean;
  readonly entryKey: string;
  readonly usedReferences: readonly string[];
  readonly onChange: (patch: Partial<OptionSetEntry>) => void;
  readonly onReferenceSelected: (candidate: MenuAuthoringCandidate) => void;
  readonly onVariationValidityChange: (entryKey: string, valid: boolean | null) => void;
  readonly onRemove: () => void;
  readonly onMove: (delta: -1 | 1) => void;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
}

export default function OptionSetEntryRow({
  kind,
  entry,
  index,
  selectedReferenceAvailable,
  isPersistedVariationUnchanged,
  entryKey,
  usedReferences,
  onChange,
  onReferenceSelected,
  onVariationValidityChange,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: Props) {
  const { t } = useTranslation();
  const ingredientSet = kind === 'ingredient' || kind === 'sauce';
  const selectedId = ingredientSet ? (entry.globalIngredientId ?? '') : (entry.productId ?? '');
  const productId = ingredientSet ? undefined : entry.productId;
  const [variationsRequested, setVariationsRequested] = React.useState(false);
  const variations = useOptionSetProductVariations(productId, variationsRequested);
  const selectedVariation = variations.variations.find((variation) => variation.id === entry.productVariationId);

  useEffect(() => {
    if (!entry.productVariationId) {
      onVariationValidityChange(entryKey, true);
      return;
    }
    if (isPersistedVariationUnchanged) {
      onVariationValidityChange(entryKey, true);
      return;
    }
    if (variations.isLoading) {
      onVariationValidityChange(entryKey, null);
      return;
    }
    onVariationValidityChange(entryKey, Boolean(selectedVariation?.isActive));
  }, [
    entry.productVariationId,
    entryKey,
    isPersistedVariationUnchanged,
    onVariationValidityChange,
    selectedVariation?.isActive,
    variations.isLoading,
  ]);

  return (
    <fieldset className={styles.entry}>
      <legend>
        {t('option_set_entries')} {index + 1}
      </legend>
      <OptionSetReferenceSearch
        kind={kind}
        selectedId={selectedId}
        selectedName={entry.name}
        selectedAvailable={selectedReferenceAvailable}
        usedReferences={usedReferences}
        onSelect={(candidate) => {
          onReferenceSelected(candidate);
          onChange({
            name: candidate.name,
            globalIngredientId: ingredientSet ? candidate.id : undefined,
            productId: ingredientSet ? undefined : candidate.id,
            productVariationId: undefined,
          });
        }}
        onClear={() => onChange({ globalIngredientId: undefined, productId: undefined, productVariationId: undefined })}
      />
      <FormField label={t('option_set_entry_name')}>
        <input value={entry.name} maxLength={200} onChange={(event) => onChange({ name: event.target.value })} />
      </FormField>
      {!ingredientSet && entry.productId && (
        <FormField label={t('option_set_entry_variation')}>
          <select
            value={entry.productVariationId ?? ''}
            onFocus={() => setVariationsRequested(true)}
            onChange={(event) => {
              onVariationValidityChange(entryKey, null);
              onChange({ productVariationId: event.target.value || undefined });
            }}
          >
            <option value="">{t('option_set_base_product')}</option>
            {entry.productVariationId && !selectedVariation && (
              <option value={entry.productVariationId} disabled>
                {entry.productVariationId}
              </option>
            )}
            {variations.variations.map((variation) => (
              <option key={variation.id} value={variation.id} disabled={!variation.isActive}>
                {variation.name}
                {!variation.isActive ? ` · ${t('inactive')}` : ''}
              </option>
            ))}
          </select>
        </FormField>
      )}
      {variations.isLoading && <output>{t('option_set_variations_loading')}</output>}
      {variations.error && <p role="alert">{t('option_set_variations_error')}</p>}
      {entry.productVariationId &&
        !isPersistedVariationUnchanged &&
        !selectedVariation?.isActive &&
        !variations.isLoading && <p className={styles.unavailable}>{t('option_set_variation_unavailable')}</p>}
      <div className={styles.actions}>
        {canMoveUp && (
          <button type="button" onClick={() => onMove(-1)} aria-label={t('move_up')}>
            {t('move_up')}
          </button>
        )}
        {canMoveDown && (
          <button type="button" onClick={() => onMove(1)} aria-label={t('move_down')}>
            {t('move_down')}
          </button>
        )}
        <button type="button" className={styles.remove} onClick={onRemove}>
          {t('option_set_remove_entry')}
        </button>
      </div>
      {(ingredientSet || kind === 'bundleChoice') && (
        <details
          className={styles.settings}
          open={Boolean(
            ingredientSet
              ? entry.price || entry.maxQuantity !== 1 || entry.isIncludedInBasePrice
              : entry.additionalPrice || entry.isDefault,
          )}
        >
          <summary>{t('option_set_entry_settings')}</summary>
          <div className={styles.fields}>
            {ingredientSet && (
              <>
                <FormField label={t('option_set_entry_price')}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entry.price}
                    onChange={(event) => onChange({ price: Number(event.target.value) })}
                  />
                </FormField>
                <FormField label={t('option_set_entry_max_quantity')}>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={entry.maxQuantity}
                    onChange={(event) => onChange({ maxQuantity: Number(event.target.value) })}
                  />
                </FormField>
                <CheckboxField
                  label={t('option_set_entry_included')}
                  checked={entry.isIncludedInBasePrice}
                  onChange={(checked) => onChange({ isIncludedInBasePrice: checked })}
                />
              </>
            )}
            {kind === 'bundleChoice' && (
              <>
                <FormField label={t('option_set_entry_additional_price')}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entry.additionalPrice}
                    onChange={(event) => onChange({ additionalPrice: Number(event.target.value) })}
                  />
                </FormField>
                <CheckboxField
                  label={t('option_set_entry_default')}
                  checked={entry.isDefault}
                  onChange={(checked) => onChange({ isDefault: checked })}
                />
              </>
            )}
          </div>
        </details>
      )}
    </fieldset>
  );
}
