'use client';

import React from 'react';
import styles from './OrderTypeRibbon.module.css';

interface OrderTypeRibbonProps {
  /** The reason line, already localized — e.g. "Delivery only" (`useItemAvailabilityNotice`). */
  label: string;
  /**
   * The same fact in the fewest words that name a channel — "Not for Dine-in"
   * (`AvailabilityNotice.shortMessage`). Used below 600px, where the marker is a caption across an
   * 88px thumbnail and the long form cannot fit on it at any size.
   */
  compactLabel: string;
}

/**
 * The marker on a card the guest's chosen channel cannot order — a diagonal band wrapping the
 * photo's corner on a card, a caption bar across the thumbnail on a phone.
 *
 * It replaces nothing: the card already receded and already carried the reason as a sentence with a
 * "Switch to Takeaway" link under it. What it adds is a marker readable at a glance across a grid —
 * the recede alone says "something is off about this dish" without saying what, and the sentence is
 * only legible once you are reading that one card.
 *
 * **It lives inside the photo**, handed to `MenuItemImage` as an overlay, not positioned against the
 * card. On a card the two are the same rectangle at the top, so the diagonal looks identical either
 * way; on a phone they are not, and that difference is the whole reason this changed. Pinned to the
 * ROW, the band wrapped the row's bottom inline-end corner — the owner's review: *"the order type
 * availability label looks off as it is displayed on the right bottom corner"*. The bottom-end
 * corner was chosen because it was the only one a blocked row left free, which is a statement about
 * the row's other contents rather than about where the marker belongs.
 *
 * **Both labels are always in the DOM and CSS picks one.** Text cannot be swapped at a breakpoint
 * any other way, and the cost is nil here: the whole assembly is `aria-hidden`, so neither string is
 * announced and the hidden one is not read twice.
 *
 * `aria-hidden`, deliberately. The exact same string is already in the card's accessible name: the
 * host folds `reasonId` into the `<li>`'s `aria-labelledby`, so a screen reader hears "Adana Dürüm
 * … Delivery only". Announcing it here too would read the restriction twice.
 */
export default function OrderTypeRibbon({ label, compactLabel }: Readonly<OrderTypeRibbonProps>) {
  return (
    <span className={styles.ribbon} aria-hidden="true">
      <span className={styles.ribbonLabel}>{label}</span>
      <span className={styles.ribbonCaption}>{compactLabel}</span>
    </span>
  );
}
