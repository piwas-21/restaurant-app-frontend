'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import AllergenIcon from './AllergenIcon';
import styles from './AllergenDisplay.module.css';

interface AllergenDisplayProps {
  allergens?: string[];
  id?: string;
  maxVisible?: number;
  showLabel?: boolean;
  /**
   * `icons` is the card's title-row band: one glyph per allergen, no words, sized to sit beside the
   * price without stealing a line from the dish name. The word survives as the chip's `title` and
   * as visually-hidden text, so the accessible name is identical to the labelled variants — only
   * the pixels are shorter.
   */
  variant?: 'compact' | 'full' | 'admin' | 'icons';
  className?: string;
  contentClassName?: string;
}

/**
 * The chips themselves — one implementation for all three variants.
 *
 * It used to be three copies of the same twenty lines, which is how the "+N more"
 * title ended up covered on one variant and not the others. The variants differ in
 * exactly one thing (whether the list is capped), so that is the only parameter:
 * `admin` passes the full length and therefore never renders a counter.
 */
function AllergenChips({
  allergens,
  id,
  maxVisible,
  iconOnly = false,
}: Readonly<{ allergens: string[]; id: string; maxVisible: number; iconOnly?: boolean }>) {
  const { t } = useTranslation();
  const label = (allergen: string) =>
    t(`allergen_${allergen.toLowerCase().replaceAll(' ', '_')}`, allergen.replaceAll('_', ' '));

  const shown = allergens.slice(0, maxVisible);
  const remaining = allergens.length - shown.length;

  return (
    <>
      {shown.map((allergen, idx) => {
        const text = label(allergen);
        return (
          <span
            key={`${id}-allergen-${idx}`}
            className={iconOnly ? `${styles.allergenTag} ${styles.iconChip}` : styles.allergenTag}
            title={text}
          >
            {/* One glyph PER allergen (see AllergenIcon.tsx) — a wheat ear for gluten, a carton for
                milk. `aria-hidden` there, because the word is carried either by the visible text
                below or, in the icon-only chip, by the `.sr-only` span. */}
            <AllergenIcon allergen={allergen} className={styles.allergenIcon} />
            <span className={iconOnly ? 'sr-only' : styles.allergenText}>{text}</span>
          </span>
        );
      })}
      {remaining > 0 && (
        <span
          className={`${styles.allergenTag} ${styles.more} ${iconOnly ? styles.iconChip : ''}`.trim()}
          title={`+${remaining} more allergens: ${allergens.slice(maxVisible).map(label).join(', ')}`}
        >
          +{remaining}
        </span>
      )}
    </>
  );
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

  // The card's title-row band: glyphs only, inline beside the price.
  if (variant === 'icons') {
    return (
      <span role="group" className={`${styles.iconRow} ${className}`.trim()} aria-label={t('allergens', 'Allergens')}>
        <AllergenChips allergens={allergens} id={id} maxVisible={maxVisible} iconOnly />
      </span>
    );
  }

  // Different layouts based on variant
  if (variant === 'compact') {
    return (
      <div className={`${styles.allergensContent} ${className}`}>
        <AllergenChips allergens={allergens} id={id} maxVisible={maxVisible} />
      </div>
    );
  }

  if (variant === 'admin') {
    return (
      <div className={`${className}`}>
        {showLabel && <div className={styles.allergensLabel}>{t('allergens', 'Allergens')}</div>}
        <div className={`${styles.allergensContent} ${contentClassName}`}>
          {/* The editor lists every allergen on the product — no cap, so no counter. */}
          <AllergenChips allergens={allergens} id={id} maxVisible={allergens.length} />
        </div>
      </div>
    );
  }

  // Default 'full' variant. No visible heading: the group's `aria-label` names the band for a screen
  // reader, and on a card the chips sit directly under the description where an "ALLERGENS" heading
  // would cost a line of the height S1 just reclaimed.
  return (
    <div role="group" className={`${styles.allergensSection} ${className}`} aria-label={t('allergens', 'Allergens')}>
      <div className={styles.allergensContent}>
        <AllergenChips allergens={allergens} id={id} maxVisible={maxVisible} />
      </div>
    </div>
  );
}
