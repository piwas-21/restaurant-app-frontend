'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildSseErrorHandler,
  buildSseUrl,
  healthCheckNeedsReconnect,
  registerServerSseListeners,
  useSseRecovery,
  HEALTH_CHECK_INTERVAL_MS,
  MAX_SILENCE_MS,
  MIN_RECONNECT_INTERVAL_MS,
  MAX_RECONNECT_ATTEMPTS,
  MAX_BACKOFF_MS,
  SSE_ENDPOINT,
  INITIAL_CONNECT_DELAY_MS,
  type ConnectionState,
  type UseServerOrdersStreamOptions,
  type UseServerOrdersStreamReturn,
} from './serverOrdersSseHandlers';

export type { ConnectionState };

/**
 * Owns the server (waitstaff) orders SSE connection: connect/reconnect
 * with backoff, health-check timer, and dispatch of order events
 * (builders + listener wiring live in `serverOrdersSseHandlers`).
 */
export function useServerOrdersStream({
  onOrderUpdate,
  onTablesRefreshRequested,
  onVisibilityResume,
}: UseServerOrdersStreamOptions): UseServerOrdersStreamReturn {
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
  const onTablesRefreshRequestedRef = useRef(onTablesRefreshRequested);
  const onVisibilityResumeRef = useRef(onVisibilityResume);
  onOrderUpdateRef.current = onOrderUpdate;
  onTablesRefreshRequestedRef.current = onTablesRefreshRequested;
  onVisibilityResumeRef.current = onVisibilityResume;

  const cleanup = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (healthCheckIntervalRef.current) clearInterval(healthCheckIntervalRef.current);
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    healthCheckIntervalRef.current = reconnectTimeoutRef.current = null;
  }, []);

  const markEvent = useCallback(() => {
    const t = new Date();
    lastEventTimeRef.current = t;
    setLastEventTime(t);
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
    const connectionId = `srv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    connectionIdRef.current = connectionId;
    const isCurrent = () => isMountedRef.current && connectionIdRef.current === connectionId;

    try {
      setConnectionState('connecting');

      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5221';
      const url = buildSseUrl(apiBase, SSE_ENDPOINT, localStorage.getItem('auth_token'));

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      // Seed lastEventTime on open so the health check can detect a
      // connection that is silent from the very start (no `connected`
      // event, no heartbeat) — otherwise lastEventTimeRef stays null
      // and the OPEN-state health check would never trip.
      eventSource.onopen = () => {
        if (!isCurrent()) return;
        markEvent();
      };

      const setConnected = () => {
        setIsConnected(true);
        setConnectionState('connected');
      };
      const resetReconnectAttempts = () => {
        reconnectAttemptRef.current = 0;
      };
      registerServerSseListeners(eventSource, {
        isCurrent,
        markEvent,
        setConnected,
        resetReconnectAttempts,
        clearError: () => setError(null),
        onOrderUpdate: (updater) => onOrderUpdateRef.current(updater),
        onTablesRefreshRequested: () => onTablesRefreshRequestedRef.current(),
      });

      eventSource.onerror = buildSseErrorHandler({
        connectionId,
        connectionIdRef,
        isMountedRef,
        reconnectAttemptRef,
        reconnectTimeoutRef,
        cleanup,
        setDown: () => {
          setIsConnected(false);
          setConnectionState('error');
        },
        setMaxReached: () => setError('Real-time updates unavailable - using polling'),
        scheduleReconnect: (delayMs) => {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) connect();
          }, delayMs);
        },
        maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
        maxBackoffMs: MAX_BACKOFF_MS,
      });

      healthCheckIntervalRef.current = setInterval(() => {
        if (!isCurrent()) return;
        const check = healthCheckNeedsReconnect(eventSourceRef.current, lastEventTimeRef.current, MAX_SILENCE_MS);
        if (check.reconnect) {
          console.warn(`⚠️ Server SSE: ${check.reason}, reconnecting...`);
          reconnectAttemptRef.current = 0;
          // cleanup() first so connect() doesn't early-return on the
          // still-OPEN-but-silent EventSource (readyState !== CLOSED guard).
          cleanup();
          connect();
        }
      }, HEALTH_CHECK_INTERVAL_MS);
    } catch (err) {
      console.error('Error connecting to SSE:', err);
      if (!isMountedRef.current) return;
      setIsConnected(false);
      setConnectionState('error');
      setError('SSE unavailable - using polling');
    }
  }, [cleanup, markEvent]);

  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    connect();
  }, [connect]);

  // Initial mount: connect after a short delay (matches pre-split timing
  // so the polling loop has already issued its first fetch).
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
    onResume: () => onVisibilityResumeRef.current(),
    isMountedRef,
    eventSourceRef,
  });

  return { isConnected, lastEventTime, connectionState, error };
}
