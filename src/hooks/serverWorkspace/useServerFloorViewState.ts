'use client';

import { useCallback, useEffect, useState } from 'react';

export type ServerFloorView = 'map' | 'list';
export interface ServerFloorViewState {
  view: ServerFloorView;
  zoneId: string | null;
  scrollTop: number;
}

const STORAGE_KEY = 'server.floor.workspace.v2';
const DEFAULT_STATE: ServerFloorViewState = { view: 'map', zoneId: null, scrollTop: 0 };
let storageWarningShown = false;

function warnStorageFailure(error: unknown) {
  if (storageWarningShown) return;
  storageWarningShown = true;
  console.warn('Could not persist the Server floor view; continuing with session defaults', error);
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch (error) {
    warnStorageFailure(error);
    return null;
  }
}

export function readServerFloorViewState(): ServerFloorViewState {
  const store = storage();
  if (!store) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) ?? '') as Partial<ServerFloorViewState>;
    return {
      view: parsed.view === 'list' ? 'list' : 'map',
      zoneId: typeof parsed.zoneId === 'string' ? parsed.zoneId : null,
      scrollTop: typeof parsed.scrollTop === 'number' && parsed.scrollTop >= 0 ? parsed.scrollTop : 0,
    };
  } catch (error) {
    warnStorageFailure(error);
    return { ...DEFAULT_STATE };
  }
}

export function useServerFloorViewState() {
  const [state, setState] = useState<ServerFloorViewState>(() => readServerFloorViewState());

  useEffect(() => {
    const store = storage();
    if (!store) return;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // A blocked or full session store must not prevent floor service.
      warnStorageFailure(error);
    }
  }, [state]);

  const setView = useCallback((view: ServerFloorView) => setState((current) => ({ ...current, view })), []);
  const setZoneId = useCallback((zoneId: string | null) => setState((current) => ({ ...current, zoneId })), []);
  const setScrollTop = useCallback((scrollTop: number) => setState((current) => ({ ...current, scrollTop })), []);

  return { ...state, setView, setZoneId, setScrollTop };
}

export { STORAGE_KEY as SERVER_FLOOR_VIEW_STORAGE_KEY };
