'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import { formatPlainCurrency } from '@/utils/currency';
import { matchesFilters } from '@/hooks/menu/useMenuFilters';
import type { CatalogOfferFamily, CatalogOfferTarget } from '@/types/menu/offerFamily';
import { anchorTargetForFamily } from '@/utils/offerFamily';
import styles from './OfferFamilyChoiceModal.module.css';

const EMPTY_VARIATIONS: NonNullable<CatalogOfferFamily['variationOptions']> = [];

function targetKey(target: CatalogOfferTarget): string {
  return `${target.productId}-${target.parentVariationId ?? 'base'}`;
}

function targetIsUnavailable(target: CatalogOfferTarget): boolean {
  return (
    target.isActive === false ||
    target.scheduleAvailable === false ||
    target.availability?.canOrder === false ||
    target.isAvailable === false
  );
}

interface OfferFamilyChoiceModalProps {
  family: CatalogOfferFamily | null;
  activeFilterIds?: ReadonlySet<string>;
  onClose: () => void;
  onSelect: (target: CatalogOfferTarget) => void;
}

/** The purchase-mode step for a grouped guest card. It is a radio group, not tab state. */
export default function OfferFamilyChoiceModal({
  family,
  activeFilterIds,
  onClose,
  onSelect,
}: Readonly<OfferFamilyChoiceModalProps>) {
  const { t, i18n } = useTranslation();
  const [variationId, setVariationId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState('');
  const language = (i18n.language || 'en').split('-')[0];
  const familyTitle =
    family?.anchor.content?.[language]?.name || family?.anchor.content?.en?.name || family?.anchor.name || '';

  const anchorTarget = useMemo<CatalogOfferTarget | null>(
    () => (family ? anchorTargetForFamily(family) : null),
    [family],
  );

  const variations = family?.variationOptions ?? EMPTY_VARIATIONS;
  const targets = useMemo(() => {
    if (!family || !anchorTarget) return [];
    return [anchorTarget, ...family.menuOffers]
      .filter((target) => {
        const variationMatches = target === anchorTarget || (target.parentVariationId ?? null) === variationId;
        const filterMatches = !activeFilterIds || matchesFilters(target, activeFilterIds);
        return variationMatches && filterMatches;
      })
      .map((target) =>
        target.offerMode
          ? target
          : { ...target, offerMode: target === anchorTarget ? ('item' as const) : ('meal' as const) },
      );
  }, [activeFilterIds, anchorTarget, family, variationId]);

  useEffect(() => {
    setVariationId(variations[0]?.id ?? null);
    setTargetId(anchorTarget ? targetKey(anchorTarget) : '');
  }, [anchorTarget, family?.id, variations]);

  useEffect(() => {
    const selected = targets.find((target) => targetKey(target) === targetId);
    if (selected && !targetIsUnavailable(selected)) return;
    const fallback = targets.find((target) => !targetIsUnavailable(target)) ?? targets[0];
    setTargetId(fallback ? targetKey(fallback) : '');
  }, [targetId, targets]);

  if (!family || !anchorTarget) return null;
  const itemOnlyLabel = language === 'fr' ? t('offer_family_a_la_carte') : t('offer_family_item_only');
  const mealLabel = language === 'fr' ? t('offer_family_menu') : t('offer_family_meal');
  const selectedVariation = variations.find((variation) => variation.id === variationId);
  const selectedTarget = targets.find((target) => targetKey(target) === targetId) ?? targets[0];
  // The anchor is the same product for every size. Keep it as one radio option, but project the
  // selected variation onto that target so its price and the sheet's selected variation stay in
  // lockstep. Linked menu targets may carry their own per-variation price and remain untouched.
  const selectedTargetWithVariation =
    selectedTarget && selectedTarget.productId === anchorTarget.productId && variationId
      ? {
          ...selectedTarget,
          parentVariationId: variationId,
          variationName: selectedVariation?.name,
          price: selectedVariation?.price ?? selectedTarget.price,
        }
      : selectedTarget;
  const selectedTargetUnavailable = selectedTargetWithVariation
    ? targetIsUnavailable(selectedTargetWithVariation)
    : true;

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={familyTitle}
      size="sm"
      footer={
        <div className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={() => selectedTargetWithVariation && onSelect(selectedTargetWithVariation)}
            disabled={!selectedTargetWithVariation || selectedTargetUnavailable}
          >
            {t('continue')}
          </button>
        </div>
      }
    >
      {variations.length > 1 && (
        <fieldset className={styles.group}>
          <legend>{t('offer_family_choose_size')}</legend>
          <div className={styles.options}>
            {variations.map((variation) => (
              <label key={variation.id} className={styles.option}>
                <input
                  type="radio"
                  name={`${family.id}-variation`}
                  value={variation.id}
                  checked={variation.id === variationId}
                  onChange={() => {
                    setVariationId(variation.id);
                    setTargetId(targetKey(anchorTarget));
                  }}
                />
                <span>{variation.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className={styles.group}>
        <legend>{t('offer_family_choose_mode')}</legend>
        <div className={styles.options} role="radiogroup" aria-label={t('offer_family_choose_mode')}>
          {targets.map((target) => {
            const isMeal = target.offerMode === 'meal';
            const unavailable = targetIsUnavailable(target);
            const displayPrice =
              target.productId === anchorTarget.productId && variationId
                ? (selectedVariation?.price ?? target.price)
                : target.price;
            return (
              <label key={`${target.productId}-${target.parentVariationId ?? 'base'}`} className={styles.option}>
                <input
                  type="radio"
                  name={`${family.id}-mode`}
                  value={targetKey(target)}
                  checked={targetKey(target) === targetId}
                  onChange={() => setTargetId(targetKey(target))}
                  disabled={unavailable}
                />
                <span className={styles.optionCopy}>
                  <span>{isMeal ? mealLabel : itemOnlyLabel}</span>
                  <span className={styles.price}>{formatPlainCurrency(displayPrice)}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </BaseModal>
  );
}
