'use client';

import React, { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styles from './MenuItemDetails.module.css';
// The dietary-chip family, in its own module — see that file for why it is split and why nothing
// on the public menu currently renders it.
import dietaryStyles from './MenuItemDietaryTags.module.css';
import AllergenDisplay from '@/components/common/AllergenDisplay';

type Props = {
  id: string;
  title: string;
  description: string;
  allergens?: string[];
  dietaryTags: string[];
  t: (key: string, defaultValue?: any) => string;
  /**
   * The price (and, for an admin, its inline editor) — handed in as a slot rather than rendered
   * here, because the host owns the optimistic price state the editor writes to. It sits on the
   * TITLE row: both governing screens put the price on the dish name's line, and the guest reading
   * a grid compares names to prices, not names to buttons.
   */
  priceSlot?: ReactNode;
  /**
   * Optional handler for clicking the item title. When provided, the title
   * becomes a button (clickable + keyboard-focusable). Lets the parent route
   * the click without resorting to a card-wide onClick that bubbles up from
   * action buttons inside the card.
   */
  onTitleClick?: () => void;
  /** Opens the details sheet. Rendered INSIDE the description, at the end of its second line. */
  onDetailsClick?: () => void;
  detailsLabel?: string;
  /**
   * Accessible name for that button. Separate from the visible label because the visible one is
   * just "Details" on every card — a screen-reader user listing the page's buttons would get N
   * identical entries, where the add control beside it already says which dish it adds.
   */
  detailsAria?: string;
};

/**
 * The card's text column: a title row (name · allergen glyphs · price), then the description with
 * its Details affordance at the end of the second line.
 *
 * **Details is inside the paragraph, not under it.** It used to be a block-level link on its own
 * line, which cost every card a full line of height and — on the many RUMI dishes with no allergens
 * — left the word floating in a blank band. Here it is a `float` declared BEFORE the text (floats
 * only wrap content that follows them) offset down by exactly one line, so the description's second
 * line ends and the link begins, which is what `mobile_menu_light` draws: `…grilled sourdough...
 * Details`.
 *
 * The leading ellipsis is rendered only when the text is genuinely clipped, measured after layout
 * rather than guessed from a character count — a count cannot know the card's width, the locale's
 * word lengths or the font that actually loaded. `…` in front of "Details" on a description that
 * fits would be a claim that there is more to read when there is not.
 */
export default function MenuItemDetails({
  id,
  title,
  description,
  allergens,
  dietaryTags,
  t,
  priceSlot,
  onTitleClick,
  onDetailsClick,
  detailsLabel,
  detailsAria,
}: Props) {
  const hasDescription = description.trim().length > 0;
  const { ref: descriptionRef, isClipped } = useIsClipped(description);

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
      }
    : {};

  const detailsButton = onDetailsClick ? (
    <button
      type="button"
      className={styles.detailsLink}
      onClick={onDetailsClick}
      // Falls back to the visible text rather than to nothing: a caller that passes the handler
      // without a label would otherwise render a button with no name at all.
      aria-label={detailsAria ?? detailsLabel}
    >
      {/* Decorative — the ellipsis says "clipped" to a sighted reader; the button's accessible name
          is the aria-label above, which never carries it. */}
      {isClipped && <span aria-hidden="true">…&nbsp;</span>}
      {detailsLabel}
    </button>
  ) : null;

  return (
    <>
      <div className={styles.titleRow}>
        {/* product-authored text: dir="auto" so an English name inside an Arabic page keeps its own punctuation (DESIGN-SYSTEM.md §8.2) */}
        <h3 id={`item-name-${id}`} dir="auto" className={styles.itemTitle} {...titleProps}>
          {title}
        </h3>
        {/* Glyphs, no words — the band has to share the name's line with the price. The word for
            each is carried by `.sr-only` text and a `title`, so the accessible name is unchanged. */}
        <span className={styles.titleMeta}>
          <AllergenDisplay allergens={allergens} id={id} maxVisible={3} variant="icons" />
          {priceSlot}
        </span>
      </div>

      {hasDescription ? (
        // product-authored text: dir="auto" (DESIGN-SYSTEM.md §8.2)
        <p dir="auto" ref={descriptionRef} className={styles.itemDescription}>
          {/* FIRST in source order on purpose: a float is only wrapped by the content that follows
              it. Moving this after the text would put the link below the paragraph again. */}
          {detailsButton}
          {description}
        </p>
      ) : (
        detailsButton
      )}

      {dietaryTags && dietaryTags.length > 0 && (
        <div className={dietaryStyles.allergyTags} aria-label={t('dietary_information_label')}>
          {/* One chip style for every diet. No `role="status"` — a dietary chip is STATIC content,
              so a live-region role made every card shout its tags at a screen reader on render. */}
          {dietaryTags.map((tag) => (
            <span key={tag} className={dietaryStyles.allergyTag}>
              {t(tag, tag)}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Whether the description overflows the two lines the card gives it.
 *
 * `useLayoutEffect` so the ellipsis is decided before paint — in an effect it would appear one
 * frame late on every card. A `ResizeObserver` re-runs it when the card's column changes width,
 * which happens on every breakpoint step of the grid and whenever the basket slide-over opens.
 */
function useIsClipped(text: string) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [isClipped, setIsClipped] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 1px of slack: sub-pixel line heights make `scrollHeight` exceed `clientHeight` by fractions
    // on text that is not actually clipped, which would put a lying ellipsis on every card.
    const measure = () => setIsClipped(el.scrollHeight - el.clientHeight > 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  return { ref, isClipped };
}
