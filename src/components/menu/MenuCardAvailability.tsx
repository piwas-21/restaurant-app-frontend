'use client';

import React from 'react';
import type { OrderType } from '@/types/order';
import type { AvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';

interface MenuCardAvailabilityProps {
  /** The resolved notice from `useItemAvailabilityNotice`. */
  notice: AvailabilityNotice;
  /**
   * Id for the reason paragraph. The card folds this into its own `aria-labelledby` so a dimmed
   * card announces WHY it is dimmed as part of its accessible name.
   */
  reasonId: string;
  /**
   * Commit a new order type — the host wires this to `useOrderTypeFollowUp().pickType`, which also
   * opens the table/address/contact follow-up the new channel needs. Omit it and the switch control
   * is simply not offered.
   */
  onSwitchOrderType?: (type: OrderType) => void;
  /**
   * Host template's CSS module — must define `availability`, `availabilityInfo`,
   * `availabilityBlocked`, `availabilityReason`, `availabilityHint` and `availabilitySwitch`.
   * Classic's `MenuItem.module.css` and craft's `CraftMenuCard.module.css` each pass their own, so
   * the two templates share this markup and behaviour (and stay out of Sonar's new-code duplication)
   * while looking nothing alike.
   */
  styles: Readonly<Record<string, string>>;
}

/**
 * The per-order-type availability notice on a catalog card — shared presentational half of the S4
 * surface (ORDER-TYPE-AVAILABILITY-PLAN §4.4/§4.5), following the `OrderTypeToggleShell` recipe.
 *
 * Renders the reason, and then EITHER a one-tap switch to a channel that can order the item, OR the
 * ask-your-server hint when the guest is at a scanned table. Deliberately renders no disabled
 * control: the card's "Add to order" is removed by the host while blocked rather than left inert,
 * so nothing here is focusable-but-dead.
 */
export default function MenuCardAvailability({
  notice,
  reasonId,
  onSwitchOrderType,
  styles,
}: Readonly<MenuCardAvailabilityProps>) {
  const { switchTo } = notice;

  return (
    <div
      className={`${styles.availability} ${notice.tone === 'blocked' ? styles.availabilityBlocked : styles.availabilityInfo}`}
    >
      <p className={styles.availabilityReason} id={reasonId}>
        {notice.message}
      </p>
      {notice.hint && <p className={styles.availabilityHint}>{notice.hint}</p>}
      {switchTo && onSwitchOrderType && (
        <button type="button" className={styles.availabilitySwitch} onClick={() => onSwitchOrderType(switchTo)}>
          {notice.switchLabel}
        </button>
      )}
    </div>
  );
}
