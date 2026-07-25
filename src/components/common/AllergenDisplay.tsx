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

  if (!allergens || allergens.length === 0) {
    // For menu items, preserve space to maintain layout alignment
    if (variant === 'full') {
      return (
        <div
          role="group"
          className={`${styles.allergensSection} ${className}`}
          aria-label={t('allergens', 'Allergens')}
        >
          <div className={styles.allergensLabel} style={{ visibility: 'hidden' }}>
            {t('allergens', 'Allergens')}
          </div>
          <div className={styles.allergensContent} style={{ visibility: 'hidden' }}>
            <span className={styles.allergenTag}>placeholder</span>
          </div>
        </div>
      );
    }

    // For admin or compact views, return null when no allergens
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
