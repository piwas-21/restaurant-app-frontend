import { act, renderHook } from '@testing-library/react';
import {
  readServerFloorViewState,
  SERVER_FLOOR_VIEW_STORAGE_KEY,
  useServerFloorViewState,
} from './useServerFloorViewState';

beforeEach(() => window.sessionStorage.clear());

describe('server floor view state', () => {
  it('ignores malformed or unsafe stored state', () => {
    window.sessionStorage.setItem(SERVER_FLOOR_VIEW_STORAGE_KEY, '{"view":"bad","scrollTop":-4}');

    expect(readServerFloorViewState()).toEqual({ view: 'map', zoneId: null, scrollTop: 0 });
  });

  it('restores view, zone and scroll state within the current session', () => {
    const { result } = renderHook(() => useServerFloorViewState());

    act(() => {
      result.current.setView('list');
      result.current.setZoneId('zone-2');
      result.current.setScrollTop(240);
    });

    expect(readServerFloorViewState()).toEqual({ view: 'list', zoneId: 'zone-2', scrollTop: 240 });
  });

  it('hydrates a stored preference after the deterministic map first render', () => {
    window.sessionStorage.setItem(
      SERVER_FLOOR_VIEW_STORAGE_KEY,
      JSON.stringify({ view: 'list', zoneId: 'zone-2', scrollTop: 120 }),
    );

    const { result } = renderHook(() => useServerFloorViewState());

    expect(result.current.hydrated).toBe(true);
    expect(result.current.hasStoredPreference).toBe(true);
    expect(result.current.view).toBe('list');
    expect(result.current.zoneId).toBe('zone-2');
  });
});
