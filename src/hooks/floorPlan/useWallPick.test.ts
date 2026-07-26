import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useWallPick } from './useWallPick';
import { planDocument, planWall } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import type { ViewBox } from '@/lib/floorPlan/geometry';

/** Stage and viewBox chosen so one screen pixel is exactly one plan centimetre. */
const VIEW_BOX: ViewBox = { x: 0, y: 0, w: 1000, h: 800 };
const DOC = planDocument([], { walls: [planWall()] });

const event = (clientX: number, clientY: number, over: Record<string, unknown> = {}) =>
  ({
    target: document.createElement('div'),
    clientX,
    clientY,
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    shiftKey: false,
    ...over,
  }) as unknown as ReactPointerEvent<HTMLDivElement>;

function setup(enabled = true) {
  const onPickWall = jest.fn();
  const fallback = {
    onPointerDown: jest.fn(),
    onPointerMove: jest.fn(),
    onPointerUp: jest.fn(),
    onPointerCancel: jest.fn(),
  };
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 }) as DOMRect;
  const { result } = renderHook(() =>
    useWallPick({
      stageRef: { current: el },
      viewBox: VIEW_BOX,
      document: DOC,
      enabled,
      onPickWall,
      fallback,
    }),
  );
  /** Press at a plan METRE coordinate — the 1 px = 1 cm stage makes it × 100. */
  const pressAt = (x: number, y: number, over?: Record<string, unknown>) =>
    act(() => result.current.handlers.onPointerDown(event(x * 100, y * 100, over)));
  return { pressAt, onPickWall, fallback };
}

describe('useWallPick', () => {
  it('selects the wall the press landed on', () => {
    const { pressAt, onPickWall, fallback } = setup();
    pressAt(3, 1);
    expect(onPickWall).toHaveBeenCalledWith('w1');
    expect(fallback.onPointerDown).not.toHaveBeenCalled();
  });

  it('hands bare plan on to the marquee layer', () => {
    const { pressAt, onPickWall, fallback } = setup();
    pressAt(3, 2.5);
    expect(onPickWall).not.toHaveBeenCalled();
    expect(fallback.onPointerDown).toHaveBeenCalled();
  });

  it('leaves a shift-press alone — shift is the objects modifier, not a wall one', () => {
    const { pressAt, onPickWall, fallback } = setup();
    pressAt(3, 1, { shiftKey: true });
    expect(onPickWall).not.toHaveBeenCalled();
    expect(fallback.onPointerDown).toHaveBeenCalled();
  });

  it('leaves a right-click alone — it must never change the selection', () => {
    const { pressAt, onPickWall } = setup();
    pressAt(3, 1, { button: 2 });
    expect(onPickWall).not.toHaveBeenCalled();
  });

  it('is inert while another tool owns the plan', () => {
    const { pressAt, onPickWall, fallback } = setup(false);
    pressAt(3, 1);
    expect(onPickWall).not.toHaveBeenCalled();
    expect(fallback.onPointerDown).toHaveBeenCalled();
  });
});
