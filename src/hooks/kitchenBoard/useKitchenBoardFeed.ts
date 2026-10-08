'use client';

import { useCallback, useEffect, useReducer, useRef, type Dispatch, type MutableRefObject } from 'react';
import { ApiError } from '@/utils/apiClient';
import { routeApiError } from '@/utils/apiFormErrors';
import { drainKitchenBoardWorkPages, type KitchenBoardWorkBatch } from '@/services/kitchenBoardFeedSync';
import { getKitchenBoardWork } from '@/services/kitchenBoardService';
import type { KitchenBoardCursors } from '@/types/kitchenBoard';
import { initialKitchenBoardState, kitchenBoardReducer, type KitchenBoardAction } from './kitchenBoardState';

const SYNC_INTERVAL_MS = 15_000;
const INVALID_CURSOR_CODES = new Set(['InvalidOperationalQueueCursor', 'ExpiredOperationalQueueCursor']);
const EMPTY_CURSORS: KitchenBoardCursors = { orders: null, corrections: null, completions: null };

interface ActiveSync {
  readonly generation: number;
  readonly promise: Promise<void>;
}

function isInvalidCursor(reason: unknown): boolean {
  return (
    reason instanceof ApiError && typeof reason.errorCode === 'string' && INVALID_CURSOR_CODES.has(reason.errorCode)
  );
}

async function readBatch(
  replace: boolean,
  cursors: KitchenBoardCursors,
  resetCursors: () => void,
): Promise<{ readonly batch: KitchenBoardWorkBatch; readonly replace: boolean }> {
  if (replace) {
    const batch = await drainKitchenBoardWorkPages(getKitchenBoardWork, EMPTY_CURSORS);
    return { batch, replace: true };
  }
  try {
    const batch = await drainKitchenBoardWorkPages(getKitchenBoardWork, cursors);
    return { batch, replace: false };
  } catch (reason: unknown) {
    if (!isInvalidCursor(reason)) throw reason;
    resetCursors();
    const batch = await drainKitchenBoardWorkPages(getKitchenBoardWork, EMPTY_CURSORS);
    return { batch, replace: true };
  }
}

async function synchronizeRound(
  replace: boolean,
  requestIsCurrent: () => boolean,
  cursorsRef: MutableRefObject<KitchenBoardCursors>,
  dispatch: Dispatch<KitchenBoardAction>,
  resetCursors: (requestIsCurrent: () => boolean) => void,
): Promise<void> {
  dispatch({ type: 'requestStarted' });
  try {
    const result = await readBatch(replace, cursorsRef.current, () => resetCursors(requestIsCurrent));
    if (!requestIsCurrent()) return;
    cursorsRef.current = result.batch.cursors;
    dispatch({ type: 'feedReceived', batch: result.batch, replace: result.replace });
  } catch (reason: unknown) {
    routeApiError(reason);
    if (requestIsCurrent()) dispatch({ type: 'requestFailed' });
  }
}

export function useKitchenBoardFeed(enabled: boolean) {
  const [state, dispatch] = useReducer(kitchenBoardReducer, initialKitchenBoardState);
  const mountedRef = useRef(false);
  const enabledRef = useRef(enabled);
  const generationRef = useRef(0);
  const cursorsRef = useRef<KitchenBoardCursors>(EMPTY_CURSORS);
  const syncPromiseRef = useRef<ActiveSync | null>(null);
  const resetQueuedGenerationRef = useRef<number | null>(null);

  const synchronize = useCallback(async (replace = false): Promise<void> => {
    if (!enabledRef.current || !mountedRef.current) return;
    const requestGeneration = generationRef.current;
    const activeSync = syncPromiseRef.current;
    if (activeSync?.generation === requestGeneration) {
      if (replace) resetQueuedGenerationRef.current = requestGeneration;
      return activeSync.promise;
    }

    const requestIsCurrent = () =>
      mountedRef.current && enabledRef.current && requestGeneration === generationRef.current;
    const run = async () => {
      let shouldReplace = replace;
      while (requestIsCurrent()) {
        if (resetQueuedGenerationRef.current === requestGeneration) resetQueuedGenerationRef.current = null;
        await synchronizeRound(shouldReplace, requestIsCurrent, cursorsRef, dispatch, () => {
          if (requestIsCurrent()) cursorsRef.current = EMPTY_CURSORS;
        });
        if (resetQueuedGenerationRef.current !== requestGeneration) break;
        shouldReplace = true;
      }
    };

    const request = run();
    const activeRequest = { generation: requestGeneration, promise: request };
    syncPromiseRef.current = activeRequest;
    try {
      await request;
    } finally {
      if (syncPromiseRef.current === activeRequest) syncPromiseRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    dispatch({ type: 'actionErrorCleared' });
    await synchronize(true);
  }, [synchronize]);

  useEffect(() => {
    mountedRef.current = true;
    enabledRef.current = enabled;
    generationRef.current += 1;
    if (!enabled) {
      cursorsRef.current = EMPTY_CURSORS;
      resetQueuedGenerationRef.current = null;
      dispatch({ type: 'reset' });
      return () => {
        mountedRef.current = false;
        generationRef.current += 1;
      };
    }

    cursorsRef.current = EMPTY_CURSORS;
    void synchronize(true);
    const interval = window.setInterval(() => void synchronize(false), SYNC_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      resetQueuedGenerationRef.current = null;
      window.clearInterval(interval);
    };
  }, [enabled, synchronize]);

  return { state, dispatch, refresh, synchronize };
}
