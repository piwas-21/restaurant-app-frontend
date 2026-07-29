import { useCallback, useRef } from 'react';
import { clearBasketOrderType } from '@/services/basketChannelService';
import { trackEvent } from '@/lib/analytics';

/**
 * Tells the SERVER basket it has no channel, deferred so a channel chosen moments later wins.
 *
 * ORDER-TYPE-AVAILABILITY-PLAN §9.17. `Basket.OrderType` is what arms `BasketChannelGuard`, and
 * until the DELETE existed the client had no way to unset it — the PUT takes a non-nullable order
 * type. So every path that dropped the guest's channel left the server judging later adds against a
 * channel nobody held, and refusing them for a reason the guest could not see.
 *
 * Extracted from `OrderTypeContext` to keep that file inside its 250-LOC budget.
 */
export interface ServerChannelDisarm {
  /** Schedule the disarm. Superseded by a later {@link ServerChannelDisarm.cancelPendingDisarm}. */
  requestServerDisarm: () => void;
  /** Call when the guest now HOLDS a channel, so a queued disarm must not land after the PUT. */
  cancelPendingDisarm: () => void;
}

export function useServerChannelDisarm(): ServerChannelDisarm {
  // Bumped by every channel write, so the LAST intent in a burst wins.
  const generationRef = useRef(0);

  const cancelPendingDisarm = useCallback(() => {
    generationRef.current++;
  }, []);

  const requestServerDisarm = useCallback(() => {
    const generation = ++generationRef.current;

    // The deferral is load-bearing, not politeness. `useOrderTypeEnabledGuard` clears and then sets
    // in immediate succession: G4 clears when the held channel is no longer offered, `orderType` is
    // in that effect's dep array, so the effect re-runs and G8 assigns the sole remaining channel.
    // Sending the DELETE inline would put it in flight against the PUT that `useAssertBasketChannel`
    // fires for the new channel, with no ordering between them — and if the DELETE landed last the
    // server would sit on `null` while the client holds a channel. That is the INVERSE of the bug
    // §9.17 closes and strictly worse, because null is PERMISSIVE: the guard would be disarmed and
    // every later add waved through. It would not self-heal either, since `useAssertBasketChannel`
    // records the attempt and only retries when the basket's line count changes.
    //
    // A macrotask rather than a microtask because that handoff is a React render cycle, not a
    // promise chain — a microtask would fire before G8 ever ran.
    setTimeout(() => {
      if (generationRef.current !== generation) return; // a channel was chosen; the PUT supersedes us

      // Fire-and-forget: these paths are not guest-initiated (a TTL expiring, an owner disabling a
      // channel), so blocking or raising an error would interrupt them about something they did not
      // ask for. Not SILENT though — tracked as well as logged, because a console warning on a
      // guest's phone is observable by nobody, and "the client holds no channel but the server is
      // still armed" is exactly the divergence this exists to close (§9.13's rule).
      clearBasketOrderType().catch((err) => {
        console.warn('Could not clear the basket order type on the server:', err);
        trackEvent('basket_channel_clear_failed');
      });
    }, 0);
  }, []);

  return { requestServerDisarm, cancelPendingDisarm };
}
