import { act, renderHook } from '@testing-library/react';
import { useTableEntrance } from '../useTableEntrance';

describe('useTableEntrance', () => {
  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('defaults to { x: 50, y: 10 } before any load', () => {
    const { result } = renderHook(() => useTableEntrance());
    expect(result.current.entrancePosition).toEqual({ x: 50, y: 10 });
  });

  it('loadEntrancePosition reads a valid JSON payload from localStorage', () => {
    localStorage.setItem('entrancePosition', JSON.stringify({ x: 12, y: 34 }));
    const { result } = renderHook(() => useTableEntrance());

    act(() => result.current.loadEntrancePosition());

    expect(result.current.entrancePosition).toEqual({ x: 12, y: 34 });
  });

  it('loadEntrancePosition keeps the default when the payload is malformed JSON', () => {
    localStorage.setItem('entrancePosition', '{not-valid-json');
    const { result } = renderHook(() => useTableEntrance());

    act(() => result.current.loadEntrancePosition());

    expect(result.current.entrancePosition).toEqual({ x: 50, y: 10 });
  });

  it('loadEntrancePosition keeps the default when nothing is stored', () => {
    const { result } = renderHook(() => useTableEntrance());

    act(() => result.current.loadEntrancePosition());

    expect(result.current.entrancePosition).toEqual({ x: 50, y: 10 });
  });

  it('saveEntrancePosition persists the position as JSON', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useTableEntrance());

    act(() => result.current.saveEntrancePosition({ x: 20, y: 80 }));

    expect(setItem).toHaveBeenCalledWith('entrancePosition', JSON.stringify({ x: 20, y: 80 }));
    expect(localStorage.getItem('entrancePosition')).toBe(JSON.stringify({ x: 20, y: 80 }));
  });
});
