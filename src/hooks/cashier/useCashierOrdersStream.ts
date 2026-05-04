'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildSseUrl,
  computeReconnectDelay,
  registerCashierSseListeners,
  shouldReconnectChannel,
  useSseRecovery,
  OrdersUpdater,
} from './cashierSseHandlers';

const HEALTH_CHECK_INTERVAL_MS = 20000;
const MAX_SILENCE_MS = 35000;
const MIN_RECONNECT_INTERVAL_MS = 2000;
const STUCK_CONNECTING_TIMEOUT_MS = 15000;
const MAX_RECONNECT_ATTEMPTS = 15;
const MAX_BACKOFF_MS = 30000;
const SSE_ENDPOINT = '/api/events/service';
const INITIAL_CONNECT_DELAY_MS = 500;

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseCashierOrdersStreamOptions {
  /** Called whenever an SSE order event arrives, with a function to mutate the orders list. */
  onOrderUpdate: (updater: OrdersUpdater) => void;
  /** Called when the tab regains focus or the network comes back online — caller refreshes. */
  onReconnectRequested: () => void;
}

export interface UseCashierOrdersStreamReturn {
  isConnected: boolean;
  lastEventTime: Date | null;
  connectionState: ConnectionState;
  error: string | null;
  /** Reset reconnect attempts and (re)open the SSE channel. */
  reconnect: () => void;
}

/**
 * Owns the cashier orders SSE connection: connect/reconnect with backoff,
 * health-check timer, visibility/online listeners, and dispatch of the
 * order-event types (handlers live in `cashierSseHandlers`). State-agnostic
 * — the caller passes `onOrderUpdate` to mutate the orders list.
 */
export function useCashierOrdersStream({
  onOrderUpdate,
  onReconnectRequested,
}: UseCashierOrdersStreamOptions): UseCashierOrdersStreamReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const lastEventTimeRef = useRef<Date | null>(null);
  const lastReconnectTimeRef = useRef<number>(0);
  const connectionIdRef = useRef<string>('');
  const isMountedRef = useRef(true);

  // Stable callback refs — caller may pass inline lambdas without re-wiring SSE.
  const onOrderUpdateRef = useRef(onOrderUpdate);
  const onReconnectRequestedRef = useRef(onReconnectRequested);
  onOrderUpdateRef.current = onOrderUpdate;
  onReconnectRequestedRef.current = onReconnectRequested;

  const cleanup = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (healthCheckIntervalRef.current) clearInterval(healthCheckIntervalRef.current);
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    healthCheckIntervalRef.current = null;
    reconnectTimeoutRef.current = null;
  }, []);

  const markEvent = useCallback(() => {
    lastEventTimeRef.current = new Date();
    setLastEventTime(lastEventTimeRef.current);
  }, []);

  const markChannelDown = useCallback((message: string | null) => {
    setIsConnected(false);
    setConnectionState('error');
    if (message != null) setError(message);
  }, []);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    // Throttle rapid reconnects.
    const now = Date.now();
    if (now - lastReconnectTimeRef.current < MIN_RECONNECT_INTERVAL_MS) {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) connect();
      }, MIN_RECONNECT_INTERVAL_MS);
      return;
    }
    lastReconnectTimeRef.current = now;

    if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) return;
    cleanup();

    // connectionId guards against stale closures from a superseded attempt.
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    connectionIdRef.current = connectionId;
    const isCurrent = () => isMountedRef.current && connectionIdRef.current === connectionId;

    try {
      setConnectionState('connecting');

      const apiBase = process.env.NEXT_PUBLIC_API_URL;
      if (!apiBase) {
        // Misconfiguration: SSE can't be reached. Polling continues to deliver orders.
        markChannelDown('SSE unavailable - NEXT_PUBLIC_API_URL not set; polling only');
        return;
      }
      const url = buildSseUrl(apiBase, SSE_ENDPOINT, localStorage.getItem('auth_token'));

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      registerCashierSseListeners(eventSource, {
        isCurrent,
        markEvent,
        setConnected: () => {
          setIsConnected(true);
          setConnectionState('connected');
        },
        resetReconnectAttempts: () => {
          reconnectAttemptRef.current = 0;
        },
        clearError: () => setError(null),
        onOrderUpdate: (updater) => onOrderUpdateRef.current(updater),
      });

      eventSource.onerror = () => {
        if (connectionIdRef.current !== connectionId || !isMountedRef.current) return;
        console.error(`SSE: connection error [${connectionId}]`, { readyState: eventSource.readyState });
        markChannelDown(null);
        cleanup();
        reconnectAttemptRef.current += 1;
        const backoffMs = computeReconnectDelay(reconnectAttemptRef.current, MAX_RECONNECT_ATTEMPTS, MAX_BACKOFF_MS);
        if (backoffMs == null) {
          setError('Real-time SSE unavailable - using polling (every 5s)');
          return;
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) connect();
        }, backoffMs);
      };

      healthCheckIntervalRef.current = setInterval(() => {
        if (!isCurrent()) return;
        const needsReconnect = shouldReconnectChannel(
          eventSourceRef.current,
          lastEventTimeRef.current,
          lastReconnectTimeRef.current,
          { maxSilenceMs: MAX_SILENCE_MS, stuckConnectingMs: STUCK_CONNECTING_TIMEOUT_MS },
        );
        if (needsReconnect) {
          if (eventSourceRef.current?.readyState === EventSource.CONNECTING) eventSourceRef.current.close();
          reconnectAttemptRef.current = 0;
          connect();
        }
      }, HEALTH_CHECK_INTERVAL_MS);
    } catch (err) {
      console.error('Error connecting to SSE:', err);
      if (isMountedRef.current) markChannelDown('SSE unavailable - using polling (every 5s)');
    }
  }, [cleanup, markEvent, markChannelDown]);

  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    connect();
  }, [connect]);

  // Initial mount: connect after a short delay to ensure the consumer is ready.
  useEffect(() => {
    isMountedRef.current = true;
    const initialTimeout = setTimeout(() => {
      if (isMountedRef.current) connect();
    }, INITIAL_CONNECT_DELAY_MS);
    return () => {
      isMountedRef.current = false;
      clearTimeout(initialTimeout);
      cleanup();
    };
    // SSE lifecycle is mount-once; depending on `connect`/`cleanup` would
    // tear down the live channel on every render that produces new refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSseRecovery({
    reconnect,
    onResume: () => onReconnectRequestedRef.current(),
    onOffline: () => {
      setIsConnected(false);
      setConnectionState('disconnected');
      setError('Network connection lost');
    },
    isMountedRef,
    eventSourceRef,
    lastEventTimeRef,
    maxSilenceMs: MAX_SILENCE_MS,
  });

  return { isConnected, lastEventTime, connectionState, error, reconnect };
}
