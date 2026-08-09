'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import AllergenIcon from './AllergenIcon';
import styles from './AllergenDisplay.module.css';
// The `photo` variant's paint, in its own module because it is the one chip in this component that
// deliberately breaks DESIGN.md §Components' "no background fills for chips" — see its header.
import photoStyles from './AllergenChipPhoto.module.css';

interface AllergenDisplayProps {
  allergens?: string[];
  id?: string;
  maxVisible?: number;
  showLabel?: boolean;
  /**
   * `icons` is a glyph-only band — one glyph per allergen, no words. It was the card's title-row
   * band until the owner's 2026-08-09 review found the name, the glyphs and the price on one line
   * too noisy to scan; nothing on `/menu` renders it now, and it stays because it is the compact
   * form any future dense surface wants. The word survives as the chip's `title` and as
   * visually-hidden text, so the accessible name is identical to the labelled variants.
   *
   * `photo` is what replaced it: a labelled pill that sits ON the dish photograph. Solid surface
   * rather than the hairline outline the other variants take, because a 1px border disappears over
   * a photo and the chip has to read against an image the tenant chose, not against a card.
   */
  variant?: 'compact' | 'full' | 'admin' | 'icons' | 'photo';
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
  classes,
}: Readonly<{
  allergens: string[];
  id: string;
  maxVisible: number;
  iconOnly?: boolean;
  /**
   * Extra classes for the chip and its word, from ANOTHER module. Only the `photo` variant passes
   * them, and it has to: its paint lives in `AllergenChipPhoto.module.css`, and a descendant
   * selector written there (`.photoRow .allergenTag`) would compile to that file's own hash for
   * `.allergenTag` and match nothing. Handing the class down is the only way one module can style
   * an element another module named.
   */
  classes?: { chip?: string; text?: string };
}>) {
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
            className={[styles.allergenTag, iconOnly ? styles.iconChip : null, classes?.chip].filter(Boolean).join(' ')}
            title={text}
          >
            {/* One glyph PER allergen (see AllergenIcon.tsx) — a wheat ear for gluten, a carton for
                milk. `aria-hidden` there, because the word is carried either by the visible text
                below or, in the icon-only chip, by the `.sr-only` span. */}
            <AllergenIcon allergen={allergen} className={styles.allergenIcon} />
            <span className={iconOnly ? 'sr-only' : [styles.allergenText, classes?.text].filter(Boolean).join(' ')}>
              {text}
            </span>
          </span>
        );
      })}
      {remaining > 0 && (
        <span
          className={[styles.allergenTag, styles.more, iconOnly ? styles.iconChip : null, classes?.chip]
            .filter(Boolean)
            .join(' ')}
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

  // On the photo. `<span>`s all the way down, not the `<div>`s the other variants use: this sits in
  // `MenuItemImage`'s photo frame, which is itself a `<span>` so that the frame stays valid
  // wherever the image is placed. Flow content in here would be invalid markup.
  //
  // A visually-hidden LABEL rather than `role="group"` + `aria-label` (typescript:S6819). The rule
  // wants a native element, and none of the four it offers fits: `<fieldset>` groups form controls
  // and these chips are labels, not controls — which is exactly why `MenuFilters` legitimately DOES
  // use one for chips that are buttons. The genuinely correct element would be a `<ul>`, and it
  // cannot go here: a list is flow content and this is a phrasing-only position.
  //
  // So the grouping is carried as TEXT, which is a small upgrade rather than a workaround — a
  // `role="group"` name is announced inconsistently across screen readers (the substance of S6819's
  // complaint), while a hidden word is just read.
  if (variant === 'photo') {
    return (
      <span className={`${photoStyles.photoRow} ${className}`.trim()} data-testid="allergen-chips">
        <span className="sr-only">{t('allergens', 'Allergens')}</span>
        <AllergenChips
          allergens={allergens}
          id={id}
          maxVisible={maxVisible}
          classes={{ chip: photoStyles.photoChip, text: photoStyles.photoText }}
        />
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
