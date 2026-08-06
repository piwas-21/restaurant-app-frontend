'use client';

import React from 'react';
import styles from './MenuItemDetails.module.css';
import AllergenDisplay from '@/components/common/AllergenDisplay';

type RatingData = { average: number; count: number } | undefined;

type Props = {
  id: string;
  title: string;
  description: string;
  ingredients?: string;
  allergens?: string[];
  dietaryTags: string[];
  t: (key: string, defaultValue?: any) => string;
  /**
   * Optional handler for clicking the item title. When provided, the title
   * becomes a button (clickable + keyboard-focusable). Lets the parent route
   * the click without resorting to a card-wide onClick that bubbles up from
   * action buttons inside `MenuItemActions`.
   */
  onTitleClick?: () => void;
  /**
   * Opens the details sheet from the description block — the card's Details affordance, which used
   * to be a second full-size button competing with "Add to Order" in `MenuItemActions`.
   */
  onDetailsClick?: () => void;
  detailsLabel?: string;
  /**
   * Accessible name for that button. Separate from the visible label because the visible one is
   * just "Details" on every card — a screen-reader user listing the page's buttons would get N
   * identical entries, where the add control beside it already says which dish it adds.
   */
  detailsAria?: string;
  initialRatingData?: RatingData;
};

/**
 * The card's text column: name, description, allergens, dietary tags.
 *
 * The description is rendered again after a long dormancy. It was commented out here AND hidden by
 * `display: none` below 600px, so the card showed a name, some chips and a price — which is a large
 * part of why the page read as a catalogue rather than a menu. It comes back as the details
 * affordance: two clamped lines followed by a real `<button>` (not an onClick on a `<p>`, which
 * would strand keyboard users on cards whose title wraps).
 *
 * The price is no longer rendered here. It belongs on the card's action row beside the add control
 * — one row, one price — and rendering it in both places meant the card carried two price nodes
 * with only CSS deciding which was a lie at a given width.
 */
export default function MenuItemDetails({
  id,
  title,
  description,
  ingredients: _ingredients,
  allergens,
  dietaryTags,
  t,
  onTitleClick,
  onDetailsClick,
  detailsLabel,
  detailsAria,
  initialRatingData: _initialRatingData,
}: Props) {
  const titleProps = onTitleClick
    ? {
        role: 'button',
        tabIndex: 0,
        onClick: onTitleClick,
        onKeyDown: (e: React.KeyboardEvent<HTMLHeadingElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTitleClick();
          }
        },
        style: { cursor: 'pointer' as const },
      }
    : {};

  return (
    <>
      {/* product-authored text: dir="auto" so an English name inside an Arabic page keeps its own punctuation (DESIGN-SYSTEM.md §8.2) */}
      <h3 id={`item-name-${id}`} dir="auto" className={styles.itemTitle} {...titleProps}>
        {title}
      </h3>

      {/* product-authored text: dir="auto" (DESIGN-SYSTEM.md §8.2) */}
      {description && description.trim().length > 0 && (
        <p dir="auto" className={styles.itemDescription}>
          {description}
        </p>
      )}
      {/* {(() => {
        const text = (ingredients || '').trim();
        const parts = text
          ? text.split(/[\,\n;]+/).map((s) => s.trim()).filter(Boolean)
          : [];
        const max = 3; // Limit to 3 ingredients for single line display
        const shown = parts.slice(0, max);
        const remaining = parts.length - shown.length;
        return (
          <div className={styles.ingredientsSection} aria-label={t('ingredients')}>
            {parts.length > 0 ? (
              <>
                <div className={styles.ingredientsLabel}>{t('ingredients')}</div>
                <div className={styles.ingredientsContent}>
                  {shown.map((p, idx) => (
                    <span key={`${id}-ing-${idx}`} className={styles.ingredientTag}>
                      {p}
                    </span>
                  ))}
                  {remaining > 0 && (
                    <span
                      className={styles.ingredientTag}
                      title={`+${remaining} more ingredients: ${parts.slice(max).join(', ')}`}
                    >
                      +{remaining}
                    </span>
                  )}
                </div>
              </>
            ) : (
              // Preserve full section height when no ingredients
              <>
                <div className={styles.ingredientsLabel} style={{ visibility: 'hidden' }}>{t('ingredients')}</div>
                <div className={styles.ingredientsContent} style={{ visibility: 'hidden' }}>
                  <span className={styles.ingredientTag}>placeholder</span>
                </div>
              </>
            )}
          </div>
        );
      })()} */}

      {/* Allergens section - display below ingredients */}
      <AllergenDisplay allergens={allergens} id={id} maxVisible={3} showLabel={true} variant="full" />

      {/* <AverageRating dishId={id} initialRatingData={initialRatingData} /> */}

      {dietaryTags && dietaryTags.length > 0 && (
        <div className={styles.allergyTags} aria-label={t('dietary_information_label')}>
          {/* One chip style for every diet. The per-diet class lookup that used to be appended here
              resolved against `.vegan` / `.vegetarian` / `.halal` / `.gluten-free` rules that no
              longer exist — see the stylesheet for why they went. */}
          {dietaryTags.map((tag) => (
            <span key={tag} className={styles.allergyTag} role="status">
              {t(tag, tag)}
            </span>
          ))}
        </div>
      )}

      {/* A real button, so Enter/Space and the focus ring come for free. It reads as a text link
          rather than a second CTA — the card has exactly one of those, and it is the add control. */}
      {onDetailsClick && (
        <button
          type="button"
          className={styles.detailsLink}
          onClick={onDetailsClick}
          // Falls back to the visible text rather than to nothing: a caller that passes the handler
          // without a label would otherwise render a button with no name at all.
          aria-label={detailsAria ?? detailsLabel}
        >
          {detailsLabel}
        </button>
      )}
    </>
  );
}
