'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import styles from './MenuItemActions.module.css';

type Props = {
  onAdd: () => void;
  onFeedback: () => void;
  addLabel: string;
  addAria: string;
  feedbackLabel: string;
  feedbackAria: string;
  /**
   * Hide "Add to order" — set while the item is blocked on the guest's chosen order type, where the
   * availability notice offers the switch instead. A hidden button rather than a `disabled` one on
   * purpose: a disabled control fires no click and explains nothing (frontend #208), while the
   * card's Details affordance stays live so the guest can still read the item.
   */
  showAdd?: boolean;
};

/**
 * The card's single call to action.
 *
 * It used to render TWO equally-weighted buttons, "Add to Order" beside "Details". On desktop that
 * split every card between a conversion and a navigation; on mobile both were squeezed to 0.6rem
 * type with `min-height: unset` — under the 44px touch target the category nav on this same page
 * carefully honours. Details now lives on the description block (`MenuItemDetails`), where the
 * item's own text is the thing you tap to read more of, which leaves one action here.
 *
 * Dropping it cost no reachability: the card title has been `role="button"` with an Enter/Space
 * handler opening the same sheet all along, so Details was the third route to one destination.
 *
 * The written label is in the DOM at every viewport and removed from the box below 600px, where the
 * button becomes a round icon. `aria-label` carries the full "Add {item} to order" sentence in both
 * forms, so the accessible name never depends on which one CSS is showing.
 */
export default function MenuItemActions({
  onAdd,
  onFeedback: _onFeedback,
  addLabel,
  addAria,
  feedbackLabel: _feedbackLabel,
  feedbackAria: _feedbackAria,
  showAdd = true,
}: Props) {
  return (
    <div className={styles.itemActions}>
      {showAdd && (
        <button className={styles.addToOrderButton} onClick={onAdd} aria-label={addAria}>
          <Plus className={styles.addIcon} size={20} aria-hidden="true" />
          <span className={styles.addLabel}>{addLabel}</span>
        </button>
      )}
      {/* feedback feature will be implemented in the next release */}
      {/* <button className={styles.feedbackButton} onClick={onFeedback} aria-label={feedbackAria}>
        {feedbackLabel}
      </button> */}
    </div>
  );
}
