'use client';

// The guest confirmation screen's live watch (order confirmation flows, plan S3): polls the
// anonymous guest-status endpoint while the order awaits a decision and through active preparation,
// pauses endpoint calls while the tab is hidden, then stops at Ready or a terminal state. Its
// dedicated rate bucket supports this responsive cadence without competing with payment returns.
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
        // The caller re-schedules while awaiting a decision or preparing; the effect below stops
        // after Ready, a terminal status, or an unavailable token.
        schedule();
      }, POLL_INTERVAL_MS);
    };
    schedule();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [orderId, token]);

  // Keep the customer countdown current while the kitchen works; Ready and terminal states need no
  // more polling. A legacy direct-flow PendingApproval still waits on the customer.
  const shouldPoll =
    phase === 'reviewing' ||
    phase === 'loading' ||
    (phase !== 'unavailable' && (status?.status === 'Confirmed' || status?.status === 'Preparing'));
  useEffect(() => {
    if (!shouldPoll && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [shouldPoll]);

  return { status, phase };
}
