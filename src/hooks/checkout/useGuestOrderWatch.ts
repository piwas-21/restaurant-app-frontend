'use client';

// The guest confirmation screen's live watch (order confirmation flows, plan S3): polls the
// anonymous guest-status endpoint while the order is still awaiting the restaurant's decision,
// stops the moment it is decided (Confirmed/Cancelled/Completed) or the tab is hidden, and
// reports the phase the acknowledgement header renders. Its dedicated rate bucket supports this
// responsive cadence without competing with a diner's payment-settlement return.
import { useEffect, useRef, useState } from 'react';
import { getGuestOrderStatus } from '@/services/order/orderQueries';
import type { GuestOrderStatusDto } from '@/types/order';
import { isNotFoundError } from '@/utils/apiClient';

const POLL_INTERVAL_MS = 5_000;

export type GuestOrderPhase = 'loading' | 'reviewing' | 'approved' | 'delay-approval' | 'decided' | 'unavailable';

interface UseGuestOrderWatchResult {
  status: GuestOrderStatusDto | null;
  phase: GuestOrderPhase;
}

function phaseFor(status: GuestOrderStatusDto | null): GuestOrderPhase {
  switch (status?.status) {
    case 'Pending':
      return 'reviewing';
    case 'PendingApproval':
      // Reviewed orders remain restaurant-owned even if an older row reached the legacy delay
      // state before this contract shipped. Keep watching for the cashier's final decision.
      return status.confirmationFlow === 'acknowledge' ? 'reviewing' : 'delay-approval';
    case 'Confirmed':
    case 'Preparing':
    case 'Ready':
      return 'approved';
    case 'Cancelled':
    case 'Completed':
    case 'Refunded':
      return 'decided';
    default:
      return 'reviewing';
  }
}

export function useGuestOrderWatch(orderId: string | null, token: string | null): UseGuestOrderWatchResult {
  const [status, setStatus] = useState<GuestOrderStatusDto | null>(null);
  const [phase, setPhase] = useState<GuestOrderPhase>('loading');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!orderId || !token) {
      setStatus(null);
      setPhase('loading');
      return;
    }

    setStatus(null);
    setPhase('loading');
    let cancelled = false;

    const load = async () => {
      try {
        const next = await getGuestOrderStatus(orderId, token);
        if (cancelled) return;
        setStatus(next);
        setPhase(phaseFor(next));
      } catch (error) {
        if (cancelled) return;
        // Only the backend's indistinguishable unknown-id/wrong-token 404 is terminal. A network
        // loss, 429 or 5xx keeps the last state and the five-second retry alive.
        if (isNotFoundError(error)) setPhase('unavailable');
      }
    };

    void load();

    const schedule = () => {
      timerRef.current = setTimeout(async () => {
        if (document.visibilityState === 'hidden') {
          schedule();
          return;
        }
        await load();
        if (cancelled) return;
        // The caller re-schedules only while the watch is still meaningful; the effect below
        // stops this loop once the order is decided.
        schedule();
      }, POLL_INTERVAL_MS);
    };
    schedule();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [orderId, token]);

  // Stop once the restaurant decides. The direct flow's legacy PendingApproval still waits on the
  // customer; acknowledge flow never does and therefore keeps watching that older state.
  const shouldPoll = phase === 'reviewing' || phase === 'loading';
  useEffect(() => {
    if (!shouldPoll && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [shouldPoll]);

  return { status, phase };
}
