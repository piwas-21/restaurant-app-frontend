'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { getAllergenInfo } from '@/lib/allergens';
import styles from './AllergenDisplay.module.css';

interface AllergenDisplayProps {
  allergens?: string[];
  id?: string;
  maxVisible?: number;
  showLabel?: boolean;
  variant?: 'compact' | 'full' | 'admin';
  className?: string;
  contentClassName?: string;
}

export default function AllergenDisplay({
  allergens,
  id = 'allergen-display',
  maxVisible = 3,
  showLabel = true,
  variant = 'full',
  className = '',
  contentClassName = '',
}: AllergenDisplayProps) {
  const { t } = useTranslation();

  // Nothing to show, at every variant.
  //
  // `full` used to return a `visibility: hidden` label plus a placeholder chip here, "to preserve
  // space to maintain layout alignment". It did not preserve alignment — it preserved 79.8px of blank
  // card on desktop and 57.0px on mobile, which is MORE than the 56.0px a populated band actually
  // takes, on every item that carries no allergens (i.e. most of RUMI's menu). That band is the gap
  // the details affordance was left floating in, and most of why a phone showed three list rows where
  // the design fits five. Cards in a grid row are equal-height because the grid's default
  // `align-items: stretch` makes them so, not because of a spacer.
  if (!allergens || allergens.length === 0) {
    return null;
  }

  const shown = allergens.slice(0, maxVisible);
  const remaining = allergens.length - shown.length;

  // Different layouts based on variant
  if (variant === 'compact') {
    return (
      <div className={`${styles.allergensContent} ${className}`}>
        {shown.map((allergen, idx) => {
          const { icon, className: allergenClassName } = getAllergenInfo(allergen);
          const translationKey = `allergen_${allergen.toLowerCase().replace(/ /g, '_')}`;
          const displayText = t(translationKey, allergen.replace(/_/g, ' '));
          return (
            <span
              key={`${id}-allergen-${idx}`}
              className={`${styles.allergenTag} ${styles[allergenClassName]}`}
              title={displayText}
            >
              <span className={styles.allergenIcon}>{icon}</span>
              <span className={styles.allergenText}>{displayText}</span>
            </span>
          );
        })}
        {remaining > 0 && (
          <span
            className={`${styles.allergenTag} ${styles.more}`}
            title={`+${remaining} more allergens: ${allergens
              .slice(maxVisible)
              .map((a) => {
                const key = `allergen_${a.toLowerCase().replace(/ /g, '_')}`;
                return t(key, a.replace(/_/g, ' '));
              })
              .join(', ')}`}
          >
            +{remaining}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'admin') {
    return (
      <div className={`${className}`}>
        {showLabel && <div className={styles.allergensLabel}>{t('allergens', 'Allergens')}</div>}
        <div className={`${styles.allergensContent} ${contentClassName}`}>
          {allergens.map((allergen, idx) => {
            const { icon, className: allergenClassName } = getAllergenInfo(allergen);
            const translationKey = `allergen_${allergen.toLowerCase().replace(/ /g, '_')}`;
            const displayText = t(translationKey, allergen.replace(/_/g, ' '));
            return (
              <span
                key={`${id}-allergen-${idx}`}
                className={`${styles.allergenTag} ${styles[allergenClassName]}`}
                title={displayText}
              >
                <span className={styles.allergenIcon}>{icon}</span>
                <span className={styles.allergenText}>{displayText}</span>
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // Default 'full' variant - preserves layout spacing
  return (
    <div role="group" className={`${styles.allergensSection} ${className}`} aria-label={t('allergens', 'Allergens')}>
      {/* {showLabel && <div className={styles.allergensLabel}>{t('allergens', 'Allergens')}</div>} */}
      <div className={styles.allergensContent}>
        {shown.map((allergen, idx) => {
          const { icon, className: allergenClassName } = getAllergenInfo(allergen);
          const translationKey = `allergen_${allergen.toLowerCase().replace(/ /g, '_')}`;
          const displayText = t(translationKey, allergen.replace(/_/g, ' '));
          return (
            <span
              key={`${id}-allergen-${idx}`}
              className={`${styles.allergenTag} ${styles[allergenClassName]}`}
              title={displayText}
            >
              <span className={styles.allergenIcon}>{icon}</span>
              <span className={styles.allergenText}>{displayText}</span>
            </span>
          );
        })}
        {remaining > 0 && (
          <span
            className={`${styles.allergenTag} ${styles.more}`}
            title={`+${remaining} more allergens: ${allergens
              .slice(maxVisible)
              .map((a) => {
                const key = `allergen_${a.toLowerCase().replace(/ /g, '_')}`;
                return t(key, a.replace(/_/g, ' '));
              })
              .join(', ')}`}
          >
            +{remaining}
          </span>
        )}
      </div>
    </div>
  );
}
