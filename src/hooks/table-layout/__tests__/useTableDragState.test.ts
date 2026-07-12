import { act, renderHook } from '@testing-library/react';
import { useTableDragState } from '../useTableDragState';

describe('useTableDragState', () => {
  it('starts with no drag in progress', () => {
    const { result } = renderHook(() => useTableDragState());

    expect(result.current.draggingTable).toBeNull();
    expect(result.current.draggingEntrance).toBe(false);
    expect(result.current.dragOffset).toEqual({ x: 0, y: 0 });
  });

  it('tracks the table being dragged', () => {
    const { result } = renderHook(() => useTableDragState());

    act(() => result.current.setDraggingTable('table-9'));

    expect(result.current.draggingTable).toBe('table-9');
  });

  it('tracks the entrance drag flag and the pointer offset', () => {
    const { result } = renderHook(() => useTableDragState());

    act(() => {
      result.current.setDraggingEntrance(true);
      result.current.setDragOffset({ x: 5, y: 7 });
    });

    expect(result.current.draggingEntrance).toBe(true);
    expect(result.current.dragOffset).toEqual({ x: 5, y: 7 });
  });
});
