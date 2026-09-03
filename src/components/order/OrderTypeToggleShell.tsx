'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Utensils, ShoppingBag, Truck } from 'lucide-react';
import { OrderType } from '@/types/order';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';

const ICON_BY_TYPE: Record<OrderType, React.ReactNode> = {
  [OrderType.DineIn]: <Utensils size={18} />,
  [OrderType.Takeaway]: <ShoppingBag size={18} />,
  [OrderType.Delivery]: <Truck size={18} />,
};

interface OrderTypeToggleShellProps {
  /**
   * Fired when the user clicks a type. Host typically wires this to
   * `useOrderTypeFollowUp().pickType` so DineIn/Delivery clicks open the
   * relevant detail modal.
   */
  onPick: (type: OrderType) => void;
  /**
   * Host template's CSS module — must define `group`, `button`, `active`,
   * `icon`, `label`, `skeleton`. The classic sidebar toggle and craft's
   * order-pad chips pass their own module, so the two share this markup /
   * behaviour (Sonar new-code dedup) and differ only in CSS.
   *
   * Optional `needsChoice` marks the group while a Proceed click is waiting on it.
   */
  styles: Readonly<Record<string, string>>;
  /**
   * Rises each time a Proceed-to-Checkout click was refused for want of an order type; `0` means
   * nothing has been refused. Every increase scrolls this group into view and focuses its first
   * button, so the guest lands ON the control the CTA is waiting for.
   *
   * A COUNTER, not a boolean, because the second refusal has to act too and a boolean that is
   * already `true` never fires an effect again. See `useCheckoutBlockerHint.attempts`.
   */
  focusSignal?: number;
  /**
   * The id of the surface's blocker sentence, so a refused click's focus move ARRIVES WITH ITS
   * REASON. The `<output>` is already on screen before the click (the 'order-type' blocker is
   * derived, not clicked into existence), so its live region announces nothing on a refusal —
   * without this, a screen-reader user hears focus land on "Dine In, button" and is told nothing
   * about why. The surface owns the id (`useId`), because two cart surfaces can be mounted at once
   * and a module constant would collide.
   */
  blockerHintId?: string;
}

/**
 * Order-type segmented picker shared by `OrderTypeToggle` (classic) and
 * `CraftOrderTypeToggle`. The set of buttons is **dynamic** — driven by
 * `useEnabledOrderTypes()` (admin-enabled list), so disabling Delivery in admin
 * hides its button with no client flag. The active button reflects
 * `useOrderType().state.orderType` so the toggle stays in sync with the source
 * of truth (e.g. QR-scan auto-pinning DineIn highlights it without a click).
 *
 * Not memoized here — each template wraps this in its own `React.memo` (props
 * are a single `onPick` function ref).
 */
export default function OrderTypeToggleShell({
  onPick,
  styles,
  focusSignal = 0,
  blockerHintId,
}: Readonly<OrderTypeToggleShellProps>) {
  const { t } = useTranslation();
  const { state } = useOrderType();
  const { enabled, loading } = useEnabledOrderTypes();
  const groupRef = useRef<HTMLFieldSetElement>(null);
  /** The last signal this actually SERVICED — not the last it was told about. See below. */
  const servicedRef = useRef(0);

  // Take the guest to the control, rather than only telling them about it. `focusSignal` starts at
  // 0 and only ever changes on a REFUSED click, so this cannot fire while the basket is merely
  // being read — which is why the derived hint (up from the moment the cart has a line) is not the
  // trigger. `block: 'nearest'` so a toggle already on screen does not jump.
  //
  // It is keyed on the LOADING STATE as well as the signal, and remembers what it serviced, because
  // the CTA stays live while `useEnabledOrderTypes` is still out (only an empty cart disables it).
  // A click refused in that window ran this effect against the ref-less SKELETON below, and keying
  // on `focusSignal` alone meant it never ran again once the buttons mounted: the guest got the
  // outline and no focus — the do-nothing click this exists to remove — until they clicked a second
  // time. `servicedRef` is what keeps the widened deps from re-firing on an unrelated change to the
  // enabled list.
  useEffect(() => {
    if (focusSignal <= 0 || focusSignal === servicedRef.current) return;
    const group = groupRef.current;
    if (!group) return; // still a skeleton — this runs again when the group mounts
    servicedRef.current = focusSignal;
    group.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    group.querySelector('button')?.focus();
  }, [focusSignal, loading, enabled.length]);

  if (loading || enabled.length === 0) {
    // While the admin-enabled list is in flight, render a spacer-shaped skeleton
    // so the panel doesn't visibly jump when the buttons arrive. Empty fallback
    // is also OK if every type is disabled.
    return <div className={styles.skeleton} aria-hidden="true" />;
  }

  return (
    /*
     * `fieldset` + `legend`, not a `div` with `role="group"` and an `aria-label` (Sonar S6819, and
     * the same call `LibraryPickerToolbar` already records). A fieldset's implicit role IS `group`
     * and the legend IS its accessible name, so nothing that queries `getByRole('group', { name:
     * /order type/i })` — the e2e suites do — sees any difference.
     */
    <fieldset
      ref={groupRef}
      className={`${styles.group} ${focusSignal > 0 ? (styles.needsChoice ?? '') : ''}`.trim()}
      aria-describedby={focusSignal > 0 ? blockerHintId : undefined}
    >
      <legend className="sr-only">{t('order_type', 'Order type')}</legend>
      {enabled.map((type) => {
        const isActive = state.orderType === type;
        return (
          <button
            key={type}
            type="button"
            className={`${styles.button} ${isActive ? styles.active : ''}`}
            onClick={() => onPick(type)}
            aria-pressed={isActive}
          >
            <span className={styles.icon}>{ICON_BY_TYPE[type]}</span>
            <span className={styles.label}>{labelFor(type, t)}</span>
          </button>
        );
      })}
    </fieldset>
  );
}

function labelFor(type: OrderType, t: (k: string, fallback: string) => string): string {
  switch (type) {
    case OrderType.DineIn:
      return t('order_type_dine_in', 'Dine In');
    case OrderType.Takeaway:
      return t('order_type_takeaway', 'Takeaway');
    case OrderType.Delivery:
      return t('order_type_delivery', 'Delivery');
  }
}
