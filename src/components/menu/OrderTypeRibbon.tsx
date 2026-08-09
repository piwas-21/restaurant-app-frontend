'use client';

import React from 'react';
import styles from './OrderTypeRibbon.module.css';

interface OrderTypeRibbonProps {
  /** The reason line, already localized — e.g. "Delivery only" (`useItemAvailabilityNotice`). */
  label: string;
}

/**
 * The diagonal corner band on a card the guest's chosen channel cannot order.
 *
 * It replaces nothing: the card already receded and already carried the reason as a sentence with a
 * "Switch to Takeaway" link under it. What it adds is a marker readable at a glance across a grid —
 * the recede alone says "something is off about this dish" without saying what, and the sentence is
 * only legible once you are reading that one card.
 *
 * `aria-hidden`, deliberately. The exact same string is already in the card's accessible name: the
 * host folds `reasonId` into the `<li>`'s `aria-labelledby`, so a screen reader hears "Adana Dürüm
 * … Delivery only". Announcing it here too would read the restriction twice.
 */
export default function OrderTypeRibbon({ label }: Readonly<OrderTypeRibbonProps>) {
  return (
    <span className={styles.ribbon} aria-hidden="true">
      <span className={styles.ribbonLabel}>{label}</span>
    </span>
  );
}
