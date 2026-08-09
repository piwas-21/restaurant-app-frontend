'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import styles from './MenuItemImage.module.css';
import { getFullImageUrl } from '@/utils/image';

type Props = {
  imageUrl: string;
  alt: string;
  imageCount?: number;
  countLabel?: string;
  /**
   * Accessible name for the enlarge-on-click button. Deliberately distinct from
   * `alt` (the dish name): the card title is already a button carrying the dish
   * name, so reusing it here would collide for screen-reader/test lookups.
   */
  enlargeLabel: string;
  /**
   * Overlay slot pinned to the photo — today the classic card's "Special" ribbon.
   *
   * The HOST passes a finished element, so it owns the class, the id and the testid; this
   * component is shared with craft, which renders its badge on the card and passes nothing.
   * Must be PHRASING content (a `<span>`): it lands inside the enlarge `<button>`, which is what
   * establishes the containing block, and a `<div>` there is invalid markup. The button carries an
   * explicit `aria-label`, so anything in here is outside the accessible name — a host that needs
   * the overlay announced must reference it by id from the card (`MenuCard` does).
   */
  badge?: ReactNode;
  /**
   * Content the PHOTO lays out, as opposed to `badge`, whose members pin themselves to a corner.
   * Today the allergen chips, at the photo's bottom inline-start — the one corner the special flag
   * (top-start, flush), the admin pill (top-end) and the image counter (bottom-end) all leave free.
   *
   * It is a slot rather than a rendered `AllergenDisplay` because the two templates disagree about
   * what belongs on a photo, and the placement is what they share.
   *
   * **Unlike `badge`, this renders OUTSIDE the enlarge `<button>`** — a sibling inside the frame
   * that wraps both. A `<button>` carrying an `aria-label` is children-presentational, so anything
   * inside it is pruned from the accessibility tree; that is fine for a decorative corner mark and
   * wrong for allergen chips, which are the one thing on this card a guest may be reading for
   * medical reasons. Still phrasing content (a `<span>`), because the frame is a `<span>` too — the
   * photo sits inside `<li>`/`<h3>` subtrees where a `<div>` would be invalid.
   */
  overlay?: ReactNode;
  onClick: () => void;
  onError?: () => void;
};

export default function MenuItemImage({
  imageUrl,
  alt,
  imageCount,
  countLabel,
  enlargeLabel,
  badge,
  overlay,
  onClick,
  onError,
}: Readonly<Props>) {
  const fullUrl = getFullImageUrl(imageUrl);
  return (
    // The frame, not the button, is the positioned ancestor — see `overlay` above for why that
    // distinction is load-bearing rather than structural taste.
    <span className={styles.itemImageFrame}>
      {/* A real <button> (not a div+role): natively focusable and Enter/Space activated, so the
          enlarge affordance is keyboard-accessible with no custom key handling. `enlargeLabel`
          gives it an accessible name distinct from the dish title. `.itemImageContainer` resets the
          native button chrome. */}
      <button
        type="button"
        className={styles.itemImageContainer}
        onClick={onClick}
        aria-label={enlargeLabel}
        data-testid="menu-item-image"
      >
        <Image
          src={fullUrl}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className={styles.itemImage}
          priority={false}
          quality={100}
          loading="eager"
          onError={onError}
        />
        {badge}
        {imageCount && imageCount > 1 && (
          <span className={styles.imageCount}>
            {imageCount} {countLabel}
          </span>
        )}
      </button>

      {/* OUTSIDE the button, and that is the whole point of the frame. A `<button>` with an
          `aria-label` is children-presentational: everything inside it is pruned from the
          accessibility tree, so allergen chips rendered in there are invisible to a screen reader
          — and on a phone their word is visually clipped too, which would leave a guest with an
          allergy no channel at all. The `badge` and the image counter stay inside deliberately:
          both are decorative there, and the marks that carry meaning (the "Special" flag, the
          order-type band's reason) are already in the card's own `aria-labelledby`. */}
      {overlay && <span className={styles.photoOverlay}>{overlay}</span>}
    </span>
  );
}
