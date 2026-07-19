import { renderHook, act } from '@testing-library/react';
import { useImageGallery } from './useImageGallery';

describe('useImageGallery', () => {
  it('opens and closes', () => {
    const { result } = renderHook(() => useImageGallery(3));
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.index).toBe(0);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it('opens at a valid start index, clamping out-of-range to 0', () => {
    const { result } = renderHook(() => useImageGallery(3));
    act(() => result.current.open(2));
    expect(result.current.index).toBe(2);
    act(() => result.current.open(9));
    expect(result.current.index).toBe(0);
    act(() => result.current.open(-1));
    expect(result.current.index).toBe(0);
  });

  it('wraps next/prev around the image count', () => {
    const { result } = renderHook(() => useImageGallery(3));
    act(() => result.current.next()); // 1
    act(() => result.current.next()); // 2
    act(() => result.current.next()); // wraps to 0
    expect(result.current.index).toBe(0);
    act(() => result.current.prev()); // wraps to 2
    expect(result.current.index).toBe(2);
  });

  it('stays at 0 when there are no images', () => {
    const { result } = renderHook(() => useImageGallery(0));
    act(() => result.current.open());
    act(() => result.current.next());
    expect(result.current.index).toBe(0);
  });
});
