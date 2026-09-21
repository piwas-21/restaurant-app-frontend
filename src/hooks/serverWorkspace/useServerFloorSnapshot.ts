'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getServerFloorSnapshot } from '@/services/serverWorkspaceService';
import type { ServerFloorSnapshot } from '@/types/serverWorkspace';
import { getErrorMessage } from '@/utils/apiClient';
import type { ConnectionState } from '@/lib/operationalStatus';

const REFRESH_INTERVAL_MS = 30_000;
const MAX_TIMEOUT_MS = 2_147_483_647;

export interface ServerFloorSnapshotState {
  snapshot: ServerFloorSnapshot | null;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  connectionState: ConnectionState;
  refresh: () => Promise<void>;
}

/** Owns the flag-true floor read and leaves the last confirmed snapshot visible after a failure. */
export function useServerFloorSnapshot(): ServerFloorSnapshotState {
  const [snapshot, setSnapshot] = useState<ServerFloorSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  const scheduledRefreshRef = useRef<number | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    setIsLoading(true);
    try {
      const next = await getServerFloorSnapshot();
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setSnapshot(next);
      setError(null);
      if (scheduledRefreshRef.current !== null) {
        window.clearTimeout(scheduledRefreshRef.current);
        scheduledRefreshRef.current = null;
      }
      const serverNow = Date.parse(next.tenantTime);
      const nextStateChange = next.nextStateChangeAt ? Date.parse(next.nextStateChangeAt) : Number.NaN;
      if (Number.isFinite(serverNow) && Number.isFinite(nextStateChange)) {
        const delay = Math.min(MAX_TIMEOUT_MS, Math.max(1000, nextStateChange - serverNow));
        scheduledRefreshRef.current = window.setTimeout(() => {
          scheduledRefreshRef.current = null;
          void refreshRef.current();
        }, delay);
      }
    } catch (reason: unknown) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setError(getErrorMessage(reason) ?? 'floor_plan_load_error');
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRef.current = refresh;
    mountedRef.current = true;
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      window.clearInterval(interval);
      if (scheduledRefreshRef.current !== null) window.clearTimeout(scheduledRefreshRef.current);
      scheduledRefreshRef.current = null;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const isStale = Boolean(error && snapshot);
  const connectionState: ConnectionState = isStale
    ? 'stale'
    : error
      ? 'offline'
      : isLoading
        ? 'reconnecting'
        : 'connected';

  return { snapshot, isLoading, isStale, error, connectionState, refresh };
}
