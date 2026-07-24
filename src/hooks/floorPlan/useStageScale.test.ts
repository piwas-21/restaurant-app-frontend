import { act, renderHook } from '@testing-library/react';
import { useStageScale } from './useStageScale';
import type { ViewBox } from '@/lib/floorPlan/geometry';

/** 12 m × 8 m plus the renderer's 20 cm padding ring. */
const VIEW_BOX: ViewBox = { x: -20, y: -20, w: 1240, h: 840 };

const stage = (width: number, height: number) => {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ width, height, left: 0, top: 0 }) as DOMRect;
  return { current: el };
};

/** The ref is built once, as `usePlanViewport` hands over a stable one. */
const scaleOf = (width: number, height: number, viewBox: ViewBox = VIEW_BOX) => {
  const ref = stage(width, height);
  return renderHook(() => useStageScale(ref, viewBox)).result.current;
};

describe('useStageScale', () => {
  it('reports 0 while the stage has no measurable size', () => {
    expect(scaleOf(0, 0)).toBe(0);
  });

  it('reports 0 when there is no stage at all', () => {
    expect(renderHook(() => useStageScale({ current: null }, VIEW_BOX)).result.current).toBe(0);
  });

  it('reports 0 while disabled, so nothing is sized before the plan loads', () => {
    const ref = stage(1240, 840);
    expect(renderHook(() => useStageScale(ref, VIEW_BOX, false)).result.current).toBe(0);
  });

  it('takes the smaller axis ratio, matching the renderer own xMidYMid meet fit', () => {
    // Wider than the plan's aspect: the height is what actually constrains it.
    expect(scaleOf(2480, 840)).toBeCloseTo(1, 6);
    expect(scaleOf(1240, 1680)).toBeCloseTo(1, 6);
  });

  it('scales with the stage, so zooming the browser changes the pixels per centimetre', () => {
    expect(scaleOf(2480, 1680)).toBeCloseTo(2, 6);
  });

  it('re-measures on a window resize where ResizeObserver is unavailable', () => {
    const ref = stage(1240, 840);
    const { result } = renderHook(() => useStageScale(ref, VIEW_BOX));
    expect(result.current).toBeCloseTo(1, 6);

    ref.current.getBoundingClientRect = () => ({ width: 2480, height: 1680, left: 0, top: 0 }) as DOMRect;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBeCloseTo(2, 6);
  });

  it('observes the element itself when the platform provides a ResizeObserver', () => {
    const observe = jest.fn();
    const disconnect = jest.fn();
    // jsdom has no ResizeObserver, so the browser path needs an explicit stand-in.
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: class {
        observe = observe;
        disconnect = disconnect;
      },
    });
    try {
      const ref = stage(1240, 840);
      const { unmount } = renderHook(() => useStageScale(ref, VIEW_BOX));
      expect(observe).toHaveBeenCalledTimes(1);
      unmount();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(globalThis, 'ResizeObserver');
    }
  });
});
