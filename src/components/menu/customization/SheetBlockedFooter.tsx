'use client';

import React from 'react';
import MenuCardAvailability from '@/components/menu/MenuCardAvailability';
import type { AvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import type { ReactNode } from 'react';

interface SheetBlockedFooterProps {
  /**
   * Absent means blocked-with-nothing-to-say — the window while the admin-enabled channel list is
   * still in flight. An empty footer for that instant beats an Add the server will refuse.
   */
  notice: AvailabilityNotice | null;
  onSwitchOrderType?: (type: import('@/types/order').OrderType) => void;
  styles: Record<string, string>;
  /**
   * Present on every step but the last. A blocked item cannot be ordered, but it is still an item
   * to read — and `openForProductId` deliberately FORCES the sheet open for one so the guest can
   * inspect it and switch channel. Without this the guided flow would show them step one and no way
   * forward, which is less of the dish than the layout this replaces showed.
   */
  onContinue?: () => void;
  continueLabel?: ReactNode;
}

/**
 * What replaces the whole action bar when the server says this item cannot be ordered on the
 * current channel (§9.10): the reason, and the way out.
 *
 * Not a disabled Add — a disabled control explains nothing (#208) — and not a quantity stepper for
 * a quantity nobody can order.
 */
export default function SheetBlockedFooter({
  notice,
  onSwitchOrderType,
  styles,
  onContinue,
  continueLabel,
}: Readonly<SheetBlockedFooterProps>) {
  return (
    <div className={styles.blockedFooter}>
      {notice && (
        <MenuCardAvailability
          notice={notice}
          reasonId="sheet-availability-reason"
          onSwitchOrderType={onSwitchOrderType}
          styles={styles}
        />
      )}
      {onContinue && continueLabel && (
        <button type="button" className={styles.blockedContinue} onClick={onContinue}>
          {continueLabel}
        </button>
      )}
    </div>
  );
}
