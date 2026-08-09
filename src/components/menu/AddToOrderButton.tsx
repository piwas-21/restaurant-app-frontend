'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import styles from './AddToOrderButton.module.css';

export interface AddToOrderButtonProps {
  onAdd: () => void;
  /** Written label — in the DOM at every viewport, removed from the BOX in the `disc` shape. */
  label: string;
  /** The full "Add {dish} to order" sentence. Names the button in every shape. */
  ariaLabel: string;
  /**
   * `outline` for a grid card, `solid` for the promoted dish.
   *
   * The split is the design's, not a preference: `desktop_menu_light_full_page` gives every grid
   * card `border border-primary text-primary` and reserves the filled `bg-primary` for the Chef's
   * Special alone — so the promoted dish owns the only filled button on the page and thirty
   * identical red blocks do not fight it.
   */
  variant?: 'outline' | 'solid';
  /**
   * `card` is the catalog card's own shape and is the only one that changes with the viewport: a
   * full-width block where the card is a card (`mt-4 w-full`), and the 44px round disc below 600px
   * where the card is a list row and there is no label to carry the emphasis. That one media query
   * is the whole reason this is a named shape rather than two callers guessing.
   *
   * `hero` is the Chef's Special's: shrink-wrapped to its label, and the same disc below 600px,
   * because down there the hero is a compact row too and a labelled button beside a 120px
   * thumbnail wraps. `disc` is the round icon unconditionally, for a surface that wants one on a
   * desktop as well.
   *
   * Both viewport-dependent shapes carry their media query in this component's own stylesheet, so
   * there is exactly one place that decides when an add control becomes a disc — the drift that
   * had `MenuItemActions` and `FeaturedSpecial` disagreeing on `min-height` began as two.
   */
  shape?: 'card' | 'hero' | 'disc';
}

/**
 * The one "Add to Order" control on the menu — the grid card's, the Chef's Special hero's, and the
 * mobile row's round disc, from one component and one stylesheet.
 *
 * It used to be three: `MenuItemActions` (grid card), `FeaturedSpecial`'s own
 * `.featuredSpecialAddButton` (hero) and a third set of rules for the mobile disc. They agreed by
 * hand — one comment in each file pointing at the other two asking the reader to keep them in step
 * — which is exactly the arrangement that lets a hover colour, a radius or a touch target drift
 * without any gate noticing.
 *
 * Nothing is ever rendered `disabled` here. A blocked item REMOVES this button (the host decides)
 * and offers the order-type switch instead: a disabled control fires no click and explains nothing.
 */
export default function AddToOrderButton({
  onAdd,
  label,
  ariaLabel,
  variant = 'outline',
  shape = 'card',
}: Readonly<AddToOrderButtonProps>) {
  return (
    <button
      type="button"
      className={`${styles.addToOrderButton} ${styles[variant]} ${styles[shape]}`}
      onClick={onAdd}
      aria-label={ariaLabel}
    >
      <Plus className={styles.addIcon} size={20} aria-hidden="true" />
      <span className={styles.addLabel}>{label}</span>
    </button>
  );
}
