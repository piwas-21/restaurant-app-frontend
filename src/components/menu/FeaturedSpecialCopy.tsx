'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './FeaturedSpecial.module.css';

interface FeaturedSpecialCopyProps {
  itemName: string;
  description: string | undefined;
  /** Opens the details sheet. Absent when the page wired no handler, in which case no control is
   *  rendered at all rather than a dead one. */
  onOpenDetails?: () => void;
}

/**
 * The Chef's Special hero's text column: the dish name, and the description with its Details
 * affordance at the end of the last line.
 *
 * Extracted from `FeaturedSpecial.tsx` when the 2026-08-09 review pushed that file past the §4
 * 250-LOC limit, and along a real seam rather than an arbitrary one: this is the half of the hero
 * that is a piece of PROSE with a link in it, and it carries the whole of the float/no-float
 * decision. It shares `FeaturedSpecial.module.css` deliberately — this is one visual object split
 * for length, not a component with a life of its own, and a second stylesheet would invite the two
 * halves of one card to drift.
 *
 * **Two placements for one link.** With a description, Details is a `float` declared BEFORE the
 * text (a float is only wrapped by the content that follows it), offset down by exactly the lines
 * above the last, so the copy ends and the link begins: `…charcoal-grilled... Details`. Without
 * one there is no line to float onto, so it is an ordinary block link — a float on a direct child
 * of the hero's flex column does nothing at all, which is how the equivalent bug on the CARD went
 * unnoticed for a release.
 *
 * The name is a real `<button>` nested in the `<h2>` rather than `role="button"` ON the heading, so
 * the strip keeps its heading and the section's accessible name still reads "<dish> <reason>" while
 * blocked.
 */
export default function FeaturedSpecialCopy({
  itemName,
  description,
  onOpenDetails,
}: Readonly<FeaturedSpecialCopyProps>) {
  const { t } = useTranslation();

  const detailsButton = (className: string) =>
    onOpenDetails ? (
      <button
        type="button"
        className={className}
        onClick={onOpenDetails}
        aria-label={t('menu_item_details_aria', { itemName })}
      >
        {t('details')}
      </button>
    ) : null;

  return (
    <>
      {/* The name, alone on its line. It shared the line with the allergen glyphs and the price
          until the owner's 2026-08-09 review found that arrangement too noisy on the cards; the
          hero follows the cards, as it does everywhere else.
          product-authored text: dir="auto" (DESIGN-SYSTEM.md §8.2) */}
      <h2 id="featured-special-heading" dir="auto" className={styles.featuredSpecialTitle}>
        {onOpenDetails ? (
          <button type="button" className={styles.featuredSpecialTitleButton} onClick={onOpenDetails}>
            {itemName}
          </button>
        ) : (
          itemName
        )}
      </h2>

      {description ? (
        <p dir="auto" className={styles.featuredSpecialDescription}>
          {detailsButton(styles.featuredSpecialDetailsLink)}
          {/* The text is wrapped so the ≤600px rules can hide IT without hiding the paragraph,
              which is the Details link's host. Hiding the whole <p> — which is what the phone rule
              did before the link moved inside it — would take the hero's only Details control off
              the viewport most guests order on, and that control exists because the review before
              this one found it missing entirely. */}
          <span className={styles.featuredSpecialDescriptionText}>{description}</span>
        </p>
      ) : (
        detailsButton(styles.featuredSpecialDetailsLinkBlock)
      )}
    </>
  );
}
