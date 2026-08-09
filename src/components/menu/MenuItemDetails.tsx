'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import styles from './MenuItemDetails.module.css';

type Props = {
  id: string;
  title: string;
  description: string;
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
 * The card's text column: the dish name, then the description with its Details affordance at the
 * end of the second line.
 *
 * The name is ALONE on its line. It shared that line with the allergen glyphs and the price until
 * the owner's 2026-08-09 review — *"the price and allergens being in the same row with item name
 * makes it too noisy"* — which sent the glyphs onto the photograph and the price into the card's
 * foot. What is left needed no `.titleRow` flex wrapper and no `.titleMeta` band, so both are gone
 * rather than left as single-child containers.
 *
 * **Details is inside the paragraph, not under it.** It used to be a block-level link on its own
 * line, which cost every card a full line of height and — on the many RUMI dishes with no allergens
 * — left the word floating in a blank band. Here it is a `float` declared BEFORE the text (floats
 * only wrap content that follows them) offset down by exactly one line, so the description's second
 * line ends and the link begins, which is what `mobile_menu_light` draws: `…grilled sourdough...
 * Details`.
 *
 * It is now inline on EVERY card. Blocked cards used to opt out (`detailsInline={false}`) because
 * their order-type band wrapped the row's bottom inline-end corner on a phone and covered the
 * floated link; that band no longer touches the row — it is a caption on the thumbnail — so the
 * exception has nothing left to avoid. Removing it is also what makes a blocked row and an
 * ordinary row the same height, since the block form cost a 44px line the inline form does not.
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
      // `.detailsLink` floats onto the description's second line; `.detailsLinkBlock` is the
      // standalone form for a dish with NO description, where there is no line to float onto. That
      // case used to render `.detailsLink` anyway, which put a `float` on a direct child of the
      // card's flex column — where floats do not apply at all — so the rules meant to place it
      // (`float`, and a `margin-top` reading a `--desc-line` that only exists on the paragraph)
      // silently did nothing and the link landed as a plain left-aligned block with a 44px global
      // min-height. It looked deliberate. It was not.
      className={hasDescription ? styles.detailsLink : styles.detailsLinkBlock}
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
      {/* product-authored text: dir="auto" so an English name inside an Arabic page keeps its own punctuation (DESIGN-SYSTEM.md §8.2) */}
      <h3 id={`item-name-${id}`} dir="auto" className={styles.itemTitle} {...titleProps}>
        {title}
      </h3>

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
