'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useTableContext } from '@/contexts/TableContext';
import { useCheckout } from '@/contexts/CheckoutContext';
import { OrderType } from '@/types/order';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';
import { needsTakeawayInfoModal } from '@/hooks/order/needsTakeawayInfoModal';
import { useOrderTypeSwitch, type OrderTypeSwitchFlow } from '@/hooks/order/useOrderTypeSwitch';

/**
 * Which follow-up modal to display. `table`/`address`/`takeaway` open after a
 * type is picked; `ordertype`/`contact` are the review-page "Edit" editors
 * (change the order type, or the contact info alone).
 */
export type OrderTypeFollowUp = 'table' | 'address' | 'takeaway' | 'ordertype' | 'contact' | null;

interface FollowUpState {
  /**
   * Which follow-up modal is currently open: 'table' for dine-in,
   * 'address' for delivery, 'takeaway' for guests / incomplete-profile
   * users picking takeaway, null when nothing is open.
   */
  followUp: OrderTypeFollowUp;
  /**
   * Pick a type. DineIn and Delivery always open their detail modal
   * (the modal also captures any missing customer info for guests).
   * Takeaway opens its info modal only when the customer needs to
   * provide name/email/phone — logged-in users with all three on file
   * commit silently and proceed straight to the cart.
   *
   * `source` is the analytics surface tag forwarded to
   * `order_type_selected` so the funnel can distinguish desktop sidebar
   * vs. mobile bottom-sheet. Defaults to 'sidebar'.
   *
   * `forceModal` opens the follow-up modal even when Takeaway would normally
   * skip it (complete profile) — used by the review page's "Edit" so the guest
   * can always change their details.
   */
  pickType: (type: OrderType, source?: string, forceModal?: boolean) => void;
  closeFollowUp: () => void;
  /**
   * Open the order-type editor (the segmented toggle) — the review page's
   * "Edit Order Details". Picking a type there calls `pickType`, which commits
   * the type and opens its detail modal (table/address) in turn.
   */
  editOrderType: () => void;
  /**
   * Open the contact-only editor (name/email/phone) — the review page's "Edit
   * Customer Information". Does NOT change the order type.
   */
  editContact: () => void;
  /**
   * The two-phase basket-channel switch. `OrderFlowModals` renders the itemized conflict confirm
   * from THIS instance — the same page-owns-the-modal rule the rest of this hook follows, and the
   * reason a card cannot own its own `useOrderTypeFollowUp`.
   */
  switchFlow: OrderTypeSwitchFlow;
  /** Guest confirmed the removal: apply it, then run the follow-up the switch was interrupted for. */
  confirmSwitch: () => void;
}

/**
 * Owns the order-type picking flow exposed by the cart sidebar
 * (BUGS-IMPROVEMENTS-PLAN §C1.5.c + §C1.5.e).
 *
 *   1. QR-scan landings (table context present) → pin DineIn + the scanned
 *      table number, OVERRIDING any stored choice (plan §2 / gap G1). Once per
 *      SCAN — the marker lives on TableContext, so a later deliberate switch
 *      survives navigating between /menu, /cart and /checkout. No modal pops.
 *   2. Sidebar order-type toggle → `pickType(type)` commits the type
 *      to OrderTypeContext and opens the relevant detail modal:
 *        - DineIn → 'table' modal (always; also captures guest info)
 *        - Delivery → 'address' modal (always; also captures guest info)
 *        - Takeaway → 'takeaway' modal *only* if the user needs to
 *          provide name/email/phone (guest, OR logged-in with any of
 *          those fields missing on profile). Logged-in users with all
 *          three on file see no modal and the type just commits.
 *   3. Modal Confirm captures the detail; Cancel leaves the type set
 *      with empty detail (recoverable: user can re-click the toggle).
 *
 * The Takeaway-needs-modal? decision is fast-pathed off CheckoutContext
 * first — if customerInfo is already there from a prior modal in this
 * session, no API call. Only when context is empty do we hit
 * /api/User/profile to decide; failure falls through to "open the modal"
 * (safe default — the modal asks for everything anyway).
 */
export function useOrderTypeFollowUp(): FollowUpState {
  const { setOrderType, setTable } = useOrderType();
  const { hasTableContext, tableContext, setTableContext } = useTableContext();
  const { state: checkoutState } = useCheckout();
  const [followUp, setFollowUp] = useState<OrderTypeFollowUp>(null);
  const switchFlow = useOrderTypeSwitch();

  // QR-scan landing → pin DineIn + the scanned table.
  //
  // G1: this used to be gated on `!hasChosenOrderType`, so a returning customer whose stored
  // Takeaway was still in force scanned a table and kept Takeaway — the banner said "Ordering for
  // Table 5" while the order type said otherwise. A physical scan is the strongest signal there
  // is, so it now WINS (plan §2). Not a race: both stores hydrate in mount effects that batch
  // into one render.
  //
  // "Has this scan already pinned?" is tracked on the TABLE CONTEXT, not in a ref here. This hook
  // is mounted per route (/menu, /cart, /checkout/review) while the scan lives in sessionStorage
  // across all of them, so a ref would reset on every navigation and re-pin Dine-In — undoing a
  // guest who deliberately switched to Takeaway, on the page that computes tax from the choice.
  useEffect(() => {
    const { tableId, tableNumber, dineInPinned } = tableContext;
    if (!hasTableContext || !tableId || !tableNumber || dineInPinned) return;

    setTableContext({ dineInPinned: true });
    setOrderType(OrderType.DineIn);
    setTable(tableNumber);
  }, [hasTableContext, tableContext, setTableContext, setOrderType, setTable]);

  // Everything after the switch is permitted: commit the type and open its detail modal. Split out
  // of `pickType` because the conflict confirm has to run it LATER, once the guest says yes.
  const commitType = useCallback(
    async (type: OrderType, source: string, forceModal: boolean) => {
      setOrderType(type);
      // Funnel anchor — fires once per click, regardless of whether a
      // follow-up modal opens (the modal is a sub-step of the same intent).
      trackEvent('order_type_selected', {
        orderType: type,
        source,
        loggedIn: isLoggedInForAnalytics(),
      });
      if (type === OrderType.DineIn) {
        setFollowUp('table');
        return;
      }
      if (type === OrderType.Delivery) {
        setFollowUp('address');
        return;
      }

      // Takeaway: open the info modal only when something is needed (or when forced, e.g. Edit).
      if (forceModal || (await needsTakeawayInfoModal(checkoutState.customerInfo))) {
        setFollowUp('takeaway');
      } else {
        setFollowUp(null);
      }
    },
    [setOrderType, checkoutState.customerInfo],
  );

  const pickType = useCallback(
    async (type: OrderType, source = 'sidebar', forceModal = false) => {
      // Ask the server FIRST when the cart could conflict. Committing optimistically and rolling
      // back on a refusal would flip the whole menu's dimming and the tax line for a moment, then
      // undo it — §4.4's "never drop silently" cuts both ways. The intent rides along so a refused
      // switch can replay THIS pick, not whichever one happened last.
      if (!(await switchFlow.request(type, source, forceModal))) return;
      await commitType(type, source, forceModal);
    },
    [switchFlow, commitType],
  );

  const confirmSwitch = useCallback(() => {
    void (async () => {
      const applied = await switchFlow.confirm();
      if (!applied) return;
      await commitType(applied.orderType, applied.source, applied.forceModal);
    })();
  }, [switchFlow, commitType]);

  const closeFollowUp = useCallback(() => setFollowUp(null), []);
  const editOrderType = useCallback(() => setFollowUp('ordertype'), []);
  const editContact = useCallback(() => setFollowUp('contact'), []);

  return { followUp, pickType, closeFollowUp, editOrderType, editContact, switchFlow, confirmSwitch };
}
