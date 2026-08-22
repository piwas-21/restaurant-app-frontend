'use client';

import { formatPlainCurrency, TENANT_CURRENCY } from '@/utils/currency';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './VariationsSection.module.css';

interface Variation {
  id?: string;
  name: string;
  description?: string;
  priceModifier: number;
  isActive: boolean;
  displayOrder: number;
  content?: Record<
    string,
    {
      name: string;
      description?: string;
    }
  >;
}

interface VariationsSectionProps {
  variations: Variation[];
  selectedVariationId: string | null;
  onVariationChange: (variationId: string | null) => void;
  basePrice: number;
  currentLanguage: string;
  productName: string;
  /**
   * Withhold the base ("no variation") row, so the guest must pick a variation (Track F / F2).
   * Only honoured while at least one variation is ACTIVE — the early return below means a product
   * whose variations are all off renders no section at all and stays orderable as its base, which
   * is the same degrade the server's guard applies.
   */
  hideBaseProduct?: boolean;
}

export default function VariationsSection({
  variations,
  selectedVariationId,
  onVariationChange,
  basePrice,
  currentLanguage,
  productName,
  hideBaseProduct = false,
}: VariationsSectionProps) {
  const { t } = useTranslation();

  // Filter only active variations and sort by display order
  const activeVariations = variations.filter((v) => v.isActive).sort((a, b) => a.displayOrder - b.displayOrder);

  if (activeVariations.length === 0) {
    return null;
  }

  const getVariationContent = (variation: Variation) => {
    const content = variation.content?.[currentLanguage] || variation.content?.en;
    return {
      name: content?.name || variation.name,
      description: content?.description || variation.description,
    };
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{t('select_variation')}</h3>
      <div className={styles.variationsList}>
        {/* Default/No variation option. Withheld when the product is a folder of variations rather
            than a dish of its own ("Günün tatlısı" offers Revani | Sütlaç, not itself). Hiding it
            here is presentation only — the server refuses a variation-less add for the same
            products, because this component is not on the request path. */}
        {!hideBaseProduct && (
          <label className={styles.variationOption}>
            <input
              type="radio"
              name="variation"
              checked={selectedVariationId === null}
              onChange={() => onVariationChange(null)}
              className={styles.variationRadio}
            />
            <div className={styles.variationContent}>
              <div className={styles.variationInfo}>
                <span dir="auto" className={styles.variationName}>
                  {productName}
                </span>
                {basePrice > 0 && <span className={styles.variationPrice}>{formatPlainCurrency(basePrice)}</span>}
              </div>
            </div>
          </label>
        )}

        {/* Variation options */}
        {activeVariations.map((variation) => {
          const { name, description } = getVariationContent(variation);

          // priceModifier is always additive (positive = add, negative = subtract)
          const varPrice = basePrice + variation.priceModifier;
          const priceChangeText =
            variation.priceModifier >= 0
              ? ` +${variation.priceModifier.toFixed(2)} ${TENANT_CURRENCY}`
              : ` ${variation.priceModifier.toFixed(2)} ${TENANT_CURRENCY}`;

          const variationId = variation.id || variation.name;

          return (
            <label key={variationId} className={styles.variationOption}>
              <input
                type="radio"
                name="variation"
                checked={selectedVariationId === variationId}
                onChange={() => onVariationChange(variationId)}
                className={styles.variationRadio}
              />
              <div className={styles.variationContent}>
                <div className={styles.variationInfo}>
                  {/* tenant-authored: dir="auto" (DESIGN-SYSTEM.md §8.2) */}
                  <span dir="auto" className={styles.variationName}>
                    {name}
                  </span>
                  {description && (
                    <span dir="auto" className={styles.variationDescription}>
                      {description}
                    </span>
                  )}
                </div>
                {varPrice > 0 && (
                  <span className={styles.variationPrice}>
                    {formatPlainCurrency(varPrice)}
                    {priceChangeText && <span className={styles.priceModifier}>{priceChangeText}</span>}
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
