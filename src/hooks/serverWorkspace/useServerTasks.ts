'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import { deliverServerTask, getServerTaskFeed } from '@/services/serverWorkspaceService';
import type { ServerServiceTask, ServerTaskBucket } from '@/types/serverTasks';
import { ApiError, getErrorMessage } from '@/utils/apiClient';
import {
  initialServerTaskFeedState,
  serverTaskReducer,
  type ServerTaskFeedAction,
  type ServerTaskFeedState,
} from './serverTaskReducer';

const PAGE_SIZE = 50;
const SYNC_INTERVAL_MS = 30_000;
const CURSOR_ERRORS = new Set(['InvalidOperationalQueueCursor', 'ExpiredOperationalQueueCursor']);

export interface ServerTasksState extends ServerTaskFeedState {
  readonly refresh: () => Promise<void>;
  readonly loadMore: () => Promise<void>;
  readonly deliver: (orderId: string) => Promise<void>;
}

function isInvalidCursor(reason: unknown): boolean {
  return reason instanceof ApiError && typeof reason.errorCode === 'string' && CURSOR_ERRORS.has(reason.errorCode);
}

function dispatchError(dispatch: Dispatch<ServerTaskFeedAction>, reason: unknown) {
  dispatch({ type: 'requestFailed', error: getErrorMessage(reason) ?? 'server.tasks.load_failed', stale: true });
}

/** Reads and incrementally reconciles one server task bucket. */
export function useServerTasks(bucket: ServerTaskBucket): ServerTasksState {
  const [state, setState] = useState<ServerTaskFeedState>(initialServerTaskFeedState);
  const stateRef = useRef(state);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const dispatch = useCallback((action: ServerTaskFeedAction) => {
    setState((current) => {
      const next = serverTaskReducer(current, action);
      stateRef.current = next;
      return next;
    });
  }, []);

  const loadPage = useCallback(
    async (cursor: string | null, replace: boolean): Promise<void> => {
      const requestId = ++requestRef.current;
      dispatch({ type: 'requestStarted', reset: replace });
      try {
        const feed = await getServerTaskFeed({ bucket, cursor, pageSize: PAGE_SIZE });
        if (!mountedRef.current || requestId !== requestRef.current) return;
        dispatch({ type: 'pageReceived', feed, replace });
      } catch (reason: unknown) {
        if (!mountedRef.current || requestId !== requestRef.current) return;
        if (cursor && isInvalidCursor(reason)) {
          await loadPage(null, true);
          return;
        }
        dispatchError(dispatch, reason);
      }
    },
    [bucket, dispatch],
  );

  const refresh = useCallback(async () => loadPage(null, true), [loadPage]);
  const loadMore = useCallback(async () => {
    const cursor = stateRef.current.nextCursor;
    if (!cursor || !stateRef.current.hasMore) return;
    await loadPage(cursor, false);
  }, [loadPage]);

  const deliver = useCallback(
    async (orderId: string) => {
      const task = stateRef.current.items.find((item) => item.orderId === orderId);
      if (!task) throw new Error('server.tasks.task_missing');
      const action = task.permittedDeliveryActions.find((candidate) => candidate.action === 'HandOver');
      if (!action?.allowed) throw new ApiError(200, '', undefined, action?.reasonCode ?? 'DeliveryNotPermitted');
      try {
        await deliverServerTask(orderId, { expectedVersion: task.version });
      } catch (reason: unknown) {
        if (reason instanceof ApiError && reason.errorCode === 'OrderVersionConflict') await refresh();
        throw reason;
      }
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    mountedRef.current = true;
    void loadPage(null, true);
    const interval = window.setInterval(() => {
      const cursor = stateRef.current.nextCursor;
      if (cursor) void loadPage(cursor, false);
    }, SYNC_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      window.clearInterval(interval);
    };
  }, [loadPage]);

  return { ...state, refresh, loadMore, deliver };
}

export interface ServerTaskCountState {
  readonly count: number;
  readonly connectionState: 'connected' | 'reconnecting' | 'stale' | 'offline';
  readonly lastConfirmed: string | null;
  readonly refresh: () => Promise<void>;
}

/** Small all-bucket probe used by route chrome to show an accurate Tasks badge. */
export function useServerTaskCount(enabled = true): ServerTaskCountState {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const confirmedRef = useRef(false);
  const [lastConfirmed, setLastConfirmed] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ServerTaskCountState['connectionState']>('reconnecting');
  const mountedRef = useRef(true);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    setConnectionState('reconnecting');
    try {
      const feed = await getServerTaskFeed({ pageSize: 1 });
      if (!mountedRef.current) return;
      countRef.current = feed.totalCount;
      confirmedRef.current = true;
      setCount(feed.totalCount);
      setLastConfirmed(feed.serverTime);
      setConnectionState('connected');
    } catch (reason: unknown) {
      if (!mountedRef.current) return;
      console.error('Failed to refresh server task count:', reason);
      // The shell surfaces this failure as stale/offline without rendering raw operational diagnostics.
      setConnectionState(confirmedRef.current ? 'stale' : 'offline');
    }
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setConnectionState('connected');
      return;
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), SYNC_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [enabled, refresh]);

  return { count, connectionState, lastConfirmed, refresh };
}

export function taskIsDeliverable(task: ServerServiceTask): boolean {
  return task.permittedDeliveryActions.some((action) => action.action === 'HandOver' && action.allowed);
}
