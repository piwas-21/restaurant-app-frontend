import { useEffect, useRef, MutableRefObject } from 'react';
import { OrderDto } from '@/types/order';

export interface OrderEventPayload {
  orderId?: string;
  order?: Partial<OrderDto> & { id?: string };
}

export type OrdersUpdater = (prev: OrderDto[]) => OrderDto[];

/**
 * Pure builders that translate an SSE order-event payload into an updater
 * for the cashier orders list. Extracted from the SSE hook so the
 * connect-loop in `useCashierOrdersStream` stays under the file-length
 * limit (and so these can be unit-tested without mocking EventSource).
 *
 * Wire order matters when the SSE hook subscribes — keep it stable.
 */
export const cashierOrderEventBuilders: ReadonlyArray<{
  event: string;
  build: (data: OrderEventPayload) => OrdersUpdater;
}> = [
  {
    event: 'order-created',
    build: (data) => (prev) => {
      const newOrder = (data.order || (data as unknown as OrderDto)) as OrderDto;
      if (prev.some((o) => o.id === newOrder.id)) return prev;
      return [newOrder, ...prev];
    },
  },
  {
    event: 'order-status-changed',
    build: (data) => (prev) => {
      const orderId = data.orderId || data.order?.id;
      return prev.map((order) =>
        order.id === orderId ? (data.order as OrderDto) || ({ ...order, ...data } as OrderDto) : order,
      );
    },
  },
  {
    event: 'order-ready',
    build: (data) => (prev) => {
      const orderId = data.orderId || data.order?.id;
      return prev.map((order) =>
        order.id === orderId ? ({ ...order, status: 'Ready', ...(data.order || {}) } as OrderDto) : order,
      );
    },
  },
  {
    event: 'order-completed',
    build: (data) => (prev) => {
      const orderId = data.orderId || data.order?.id;
      return prev.map((order) =>
        order.id === orderId ? ({ ...order, status: 'Completed', ...(data.order || {}) } as OrderDto) : order,
      );
    },
  },
  {
    event: 'focus-order-update',
    build: (data) => (prev) => {
      const orderId = data.orderId || data.order?.id;
      const isFocus = (data as unknown as { isFocus?: boolean }).isFocus;
      return prev.map((order) =>
        order.id === orderId ? ({ ...order, isFocusOrder: isFocus, ...(data.order || {}) } as OrderDto) : order,
      );
    },
  },
];

/** Build the SSE URL with the auth token threaded as a query param (EventSource has no header API). */
export function buildSseUrl(apiBase: string, endpoint: string, authToken: string | null): string {
  return authToken ? `${apiBase}${endpoint}?token=${encodeURIComponent(authToken)}` : `${apiBase}${endpoint}`;
}

/**
 * Compute the next reconnect delay (exponential backoff) given the attempt
 * counter, or `null` if the cap was reached.
 */
export function computeReconnectDelay(attempt: number, maxAttempts: number, maxBackoffMs: number): number | null {
  if (attempt > maxAttempts) return null;
  return Math.min(1000 * Math.pow(1.5, attempt), maxBackoffMs);
}

export interface SseListenerContext {
  isCurrent: () => boolean;
  markEvent: () => void;
  setConnected: () => void;
  resetReconnectAttempts: () => void;
  clearError: () => void;
  onOrderUpdate: (updater: OrdersUpdater) => void;
}

/**
 * Register the `connected`/`heartbeat` and per-order-event listeners on a
 * fresh EventSource. Extracted so the connect-loop in
 * `useCashierOrdersStream` stays under the file-length limit and so the
 * dispatch logic is testable against a fake EventSource.
 */
export function registerCashierSseListeners(eventSource: EventSource, ctx: SseListenerContext): void {
  eventSource.addEventListener('connected', (event) => {
    if (!ctx.isCurrent()) return;
    try {
      JSON.parse((event as MessageEvent).data);
      ctx.setConnected();
      ctx.clearError();
      ctx.markEvent();
      ctx.resetReconnectAttempts();
    } catch (err) {
      console.error('SSE: error parsing connected event:', err);
    }
  });

  eventSource.addEventListener('heartbeat', () => {
    if (ctx.isCurrent()) ctx.markEvent();
  });

  for (const { event, build } of cashierOrderEventBuilders) {
    eventSource.addEventListener(event, (e) => {
      if (!ctx.isCurrent()) return;
      try {
        const data = JSON.parse((e as MessageEvent).data) as OrderEventPayload;
        ctx.onOrderUpdate(build(data));
        ctx.markEvent();
        ctx.resetReconnectAttempts();
      } catch (err) {
        console.error(`Error parsing ${event} event:`, err);
      }
    });
  }
}

export interface UseSseRecoveryOptions {
  reconnect: () => void;
  onResume: () => void;
  onOffline: () => void;
  isMountedRef: MutableRefObject<boolean>;
  eventSourceRef: MutableRefObject<EventSource | null>;
  lastEventTimeRef: MutableRefObject<Date | null>;
  maxSilenceMs: number;
}

/**
 * Wires up tab-visibility + network online/offline listeners. On
 * recovery (tab visible OR network online), notifies the consumer
 * (`onResume`) and reconnects the SSE channel if it's closed or stale.
 * Extracted so `useCashierOrdersStream` stays under the file-length cap.
 */
export function useSseRecovery({
  reconnect,
  onResume,
  onOffline,
  isMountedRef,
  eventSourceRef,
  lastEventTimeRef,
  maxSilenceMs,
}: UseSseRecoveryOptions): void {
  const reconnectRef = useRef(reconnect);
  const onResumeRef = useRef(onResume);
  const onOfflineRef = useRef(onOffline);
  reconnectRef.current = reconnect;
  onResumeRef.current = onResume;
  onOfflineRef.current = onOffline;

  useEffect(() => {
    const recover = () => {
      if (!isMountedRef.current) return;
      onResumeRef.current();
      const lastEvent = lastEventTimeRef.current;
      const stale = lastEvent && Date.now() - lastEvent.getTime() > maxSilenceMs;
      const closed = !eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED;
      if (closed || stale) reconnectRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') recover();
    };
    const handleOffline = () => {
      if (isMountedRef.current) onOfflineRef.current();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', recover);
    window.addEventListener('offline', handleOffline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', recover);
      window.removeEventListener('offline', handleOffline);
    };
  }, [eventSourceRef, isMountedRef, lastEventTimeRef, maxSilenceMs]);
}

/** Decide whether the SSE channel needs a reconnect based on its current readyState + last-event time. */
export function shouldReconnectChannel(
  eventSource: EventSource | null,
  lastEvent: Date | null,
  lastConnectAttemptAt: number,
  config: { maxSilenceMs: number; stuckConnectingMs: number },
): boolean {
  if (!eventSource || eventSource.readyState === EventSource.CLOSED) return true;
  if (eventSource.readyState === EventSource.CONNECTING) {
    return Date.now() - lastConnectAttemptAt > config.stuckConnectingMs;
  }
  if (eventSource.readyState === EventSource.OPEN && lastEvent) {
    return Date.now() - lastEvent.getTime() > config.maxSilenceMs;
  }
  return false;
}
