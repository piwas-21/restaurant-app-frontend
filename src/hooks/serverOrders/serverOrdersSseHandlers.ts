import { useEffect, useRef, MutableRefObject } from 'react';
import { OrderDto } from '@/types/order';

export interface OrderEventPayload {
  orderId?: string;
  order?: Partial<OrderDto> & { id?: string; type?: string };
}

export type OrdersUpdater = (prev: OrderDto[]) => OrderDto[];

/**
 * Pure builders that translate a server-app SSE order-event payload into
 * an updater for the orders list. Extracted from the SSE hook so the
 * connect-loop in `useServerOrdersStream` stays under the file-length
 * limit (and so these can be unit-tested without mocking EventSource).
 *
 * Order of registration does not matter functionally — kept stable for
 * predictability.
 */
export const serverOrderEventBuilders: ReadonlyArray<{
  event: string;
  build: (data: OrderEventPayload) => OrdersUpdater;
}> = [
  {
    event: 'order-created',
    build: (data) => (prev) => {
      const newOrder = (data.order || (data as unknown as OrderDto)) as OrderDto & { type?: string };
      // Server view only cares about dine-in orders.
      if (newOrder.type !== 'DineIn') return prev;
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
    event: 'order-completed',
    build: (data) => (prev) => {
      const orderId = data.orderId || data.order?.id;
      return prev.map((order) =>
        order.id === orderId ? ({ ...order, status: 'Completed', ...(data.order || {}) } as OrderDto) : order,
      );
    },
  },
];

/** Event names whose arrival should also trigger a tables refresh (status display depends on them). */
export const TABLE_REFRESH_TRIGGER_EVENTS: ReadonlySet<string> = new Set([
  'order-created',
  'order-status-changed',
  'order-completed',
]);

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
  onTablesRefreshRequested: () => void;
}

/**
 * Register the `connected`/`heartbeat` and per-order-event listeners on a
 * fresh EventSource. Extracted so the connect-loop in
 * `useServerOrdersStream` stays under the file-length limit and so the
 * dispatch logic is testable against a fake EventSource.
 */
export function registerServerSseListeners(eventSource: EventSource, ctx: SseListenerContext): void {
  eventSource.addEventListener('connected', (event) => {
    if (!ctx.isCurrent()) return;
    try {
      JSON.parse((event as MessageEvent).data);
      ctx.setConnected();
      ctx.clearError();
      ctx.markEvent();
      ctx.resetReconnectAttempts();
    } catch (err) {
      console.error('Server SSE: error parsing connected event:', err);
    }
  });

  eventSource.addEventListener('heartbeat', () => {
    if (ctx.isCurrent()) ctx.markEvent();
  });

  for (const { event, build } of serverOrderEventBuilders) {
    eventSource.addEventListener(event, (e) => {
      if (!ctx.isCurrent()) return;
      try {
        const data = JSON.parse((e as MessageEvent).data) as OrderEventPayload;
        ctx.onOrderUpdate(build(data));
        if (TABLE_REFRESH_TRIGGER_EVENTS.has(event)) ctx.onTablesRefreshRequested();
        ctx.markEvent();
        // order-completed historically didn't reset the reconnect counter;
        // the other order events did. Preserve that subtle distinction so
        // behaviour is unchanged from the pre-split hook.
        if (event !== 'order-completed') ctx.resetReconnectAttempts();
      } catch (err) {
        console.error(`Error parsing ${event} event:`, err);
      }
    });
  }
}

export interface UseSseRecoveryOptions {
  reconnect: () => void;
  onResume: () => void;
  isMountedRef: MutableRefObject<boolean>;
  eventSourceRef: MutableRefObject<EventSource | null>;
}

/**
 * Wires up the tab-visibility listener. On recovery (tab visible) notify
 * the consumer (`onResume` → refresh data) and reconnect the SSE channel
 * if it's closed. Extracted so `useServerOrdersStream` stays under the
 * file-length cap.
 */
export function useSseRecovery({ reconnect, onResume, isMountedRef, eventSourceRef }: UseSseRecoveryOptions): void {
  const reconnectRef = useRef(reconnect);
  const onResumeRef = useRef(onResume);
  reconnectRef.current = reconnect;
  onResumeRef.current = onResume;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !isMountedRef.current) return;
      onResumeRef.current();
      const eventSource = eventSourceRef.current;
      if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
        reconnectRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [eventSourceRef, isMountedRef]);
}

export interface SseErrorHandlerContext {
  connectionId: string;
  connectionIdRef: MutableRefObject<string>;
  isMountedRef: MutableRefObject<boolean>;
  reconnectAttemptRef: MutableRefObject<number>;
  reconnectTimeoutRef: MutableRefObject<NodeJS.Timeout | null>;
  cleanup: () => void;
  setDown: () => void;
  setMaxReached: () => void;
  scheduleReconnect: (delayMs: number) => void;
  maxReconnectAttempts: number;
  maxBackoffMs: number;
}

/**
 * Build the EventSource `onerror` callback. Extracted from
 * `useServerOrdersStream` so the stream hook stays under the
 * file-length cap. Behaviour matches the pre-split error path:
 * stale-connection guard, mounted guard, mark-down, cleanup,
 * exponential backoff via `computeReconnectDelay`, and the same
 * console log lines.
 */
export function buildSseErrorHandler(ctx: SseErrorHandlerContext): () => void {
  return () => {
    if (ctx.connectionIdRef.current !== ctx.connectionId) return;
    console.error(`❌ Server SSE: Connection error [${ctx.connectionId}]`);
    if (!ctx.isMountedRef.current) return;
    ctx.setDown();
    ctx.cleanup();
    ctx.reconnectAttemptRef.current += 1;
    const backoffMs = computeReconnectDelay(ctx.reconnectAttemptRef.current, ctx.maxReconnectAttempts, ctx.maxBackoffMs);
    if (backoffMs == null) {
      console.warn('⚠️ Server SSE: Max reconnect attempts reached, using polling only');
      ctx.setMaxReached();
      return;
    }
    console.warn(`🔄 Server SSE: Reconnecting in ${Math.round(backoffMs / 1000)}s`);
    ctx.scheduleReconnect(backoffMs);
  };
}

/**
 * Decide whether a health-check tick should trigger a reconnect, and
 * return a human-readable reason for the log line. Extracted from
 * `useServerOrdersStream` for testability and to keep the stream hook
 * under the file-length cap.
 */
export function healthCheckNeedsReconnect(
  eventSource: EventSource | null,
  lastEvent: Date | null,
  maxSilenceMs: number,
): { reconnect: boolean; reason?: string } {
  if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
    return { reconnect: true, reason: 'Connection closed' };
  }
  if (eventSource.readyState === EventSource.OPEN && lastEvent) {
    const silenceMs = Date.now() - lastEvent.getTime();
    if (silenceMs > maxSilenceMs) {
      return { reconnect: true, reason: `No events for ${Math.round(silenceMs / 1000)}s` };
    }
  }
  return { reconnect: false };
}
