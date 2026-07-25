import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEditorMarquee } from './useEditorMarquee';
import { planDocument, tableGeometry } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import type { ViewBox } from '@/lib/floorPlan/geometry';
import type { StagePointerPhase } from './editorStage';

/** Stage and viewBox chosen so one screen pixel is exactly one plan centimetre. */
const VIEW_BOX: ViewBox = { x: 0, y: 0, w: 1000, h: 800 };
const DOC = planDocument([
  tableGeometry({ id: 'a', positionX: 1, positionY: 1 }),
  tableGeometry({ id: 'b', positionX: 3, positionY: 1 }),
  tableGeometry({ id: 'c', positionX: 1, positionY: 6 }),
]);

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

const setup = (selectedIds: string[] = []) => {
  const onSelectMany = jest.fn();
  const fallback = {
    onPointerDown: jest.fn(),
    onPointerMove: jest.fn(),
    onPointerUp: jest.fn(),
    onPointerCancel: jest.fn(),
  };
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 }) as DOMRect;
  el.setPointerCapture = jest.fn();
  const { result } = renderHook(() =>
    useEditorMarquee({
      stageRef: { current: el },
      viewBox: VIEW_BOX,
      document: DOC,
      enabled: true,
      selectedIds,
      onSelectMany,
      fallback,
    }),
  );
  const fire = (phase: StagePointerPhase, x: number, y: number, over?: Record<string, unknown>) =>
    act(() => result.current.handlers[phase](event(x, y, over)));
  return { result, fire, onSelectMany, fallback };
};

const key = (type: 'keydown' | 'keyup') =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { code: 'Space' }));
  });

describe('useEditorMarquee — sweeping', () => {
  it('selects every table the band touched', () => {
    const { fire, onSelectMany } = setup();
    fire('onPointerDown', 20, 20);
    fire('onPointerMove', 400, 200);
    fire('onPointerUp', 400, 200);

    expect(onSelectMany).toHaveBeenCalledWith(['a', 'b']);
  });

  it('exposes the live band so the overlay can draw it, and clears it after', () => {
    const { fire, result } = setup();
    fire('onPointerDown', 400, 200);
    fire('onPointerMove', 20, 20);

    expect(result.current.band).toEqual({ x: 0.2, y: 0.2, width: 3.8, height: 1.8 });
    fire('onPointerUp', 20, 20);
    expect(result.current.band).toBeNull();
  });

  it('selects on a flick where pointerup arrives before the band state flushes', () => {
    // React batches pointermove at continuous priority: a fast sweep delivers
    // down/move/up in ONE task, so settle must read the ref, not the state.
    const { result, onSelectMany } = setup(['c']);
    act(() => {
      result.current.handlers.onPointerDown(event(20, 20));
      result.current.handlers.onPointerMove(event(400, 200));
      result.current.handlers.onPointerUp(event(400, 200));
    });

    expect(onSelectMany).toHaveBeenCalledWith(['a', 'b']);
  });

  it('unions with the current selection on a shift-sweep, never dropping one back out', () => {
    const { fire, onSelectMany } = setup(['b', 'c']);
    fire('onPointerDown', 20, 20, { shiftKey: true });
    fire('onPointerMove', 400, 200, { shiftKey: true });
    fire('onPointerUp', 400, 200, { shiftKey: true });

    expect(onSelectMany).toHaveBeenCalledWith(['b', 'c', 'a']);
  });
});

describe('useEditorMarquee — clicks on bare plan', () => {
  it('clears the selection', () => {
    const { fire, onSelectMany } = setup(['a']);
    fire('onPointerDown', 500, 500);
    fire('onPointerUp', 500, 500);

    expect(onSelectMany).toHaveBeenCalledWith([]);
  });

  it('keeps the selection on a shift-click, so a mis-click costs nothing', () => {
    const { fire, onSelectMany } = setup(['a']);
    fire('onPointerDown', 500, 500, { shiftKey: true });
    fire('onPointerUp', 500, 500, { shiftKey: true });

    expect(onSelectMany).not.toHaveBeenCalled();
  });

  it('selects nothing and keeps the selection when a sweep is cancelled', () => {
    const { fire, result, onSelectMany } = setup(['a']);
    fire('onPointerDown', 20, 20);
    fire('onPointerMove', 400, 200);
    fire('onPointerCancel', 400, 200);

    expect(onSelectMany).not.toHaveBeenCalled();
    expect(result.current.band).toBeNull();
  });
});

describe('useEditorMarquee — when the pointer should pan instead', () => {
  it('never loses a selection to a right-click, and never sweeps with one', () => {
    const { fire, fallback, onSelectMany } = setup(['a']);
    fire('onPointerDown', 20, 20, { button: 2 });
    fire('onPointerMove', 400, 200, { button: 2 });
    fire('onPointerUp', 400, 200, { button: 2 });

    expect(onSelectMany).not.toHaveBeenCalled();
    expect(fallback.onPointerDown).toHaveBeenCalledTimes(1);
  });

  it('hands a middle-drag to pan — the conventional pan once the left button sweeps', () => {
    const { fire, fallback, onSelectMany } = setup();
    fire('onPointerDown', 20, 20, { button: 1 });

    expect(fallback.onPointerDown).toHaveBeenCalledTimes(1);
    expect(onSelectMany).not.toHaveBeenCalled();
  });

  it('forgets a held Space when the window loses focus, or the marquee dies for good', () => {
    const { fire, onSelectMany } = setup();
    key('keydown');
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    fire('onPointerDown', 20, 20);
    fire('onPointerMove', 400, 200);
    fire('onPointerUp', 400, 200);

    expect(onSelectMany).toHaveBeenCalledWith(['a', 'b']);
  });

  it('hands a finger straight to pan: there is no second button to reserve', () => {
    const { fire, fallback, onSelectMany } = setup();
    fire('onPointerDown', 20, 20, { pointerType: 'touch' });
    fire('onPointerMove', 400, 200, { pointerType: 'touch' });
    fire('onPointerUp', 400, 200, { pointerType: 'touch' });

    expect(fallback.onPointerDown).toHaveBeenCalledTimes(1);
    expect(fallback.onPointerMove).toHaveBeenCalledTimes(1);
    expect(onSelectMany).not.toHaveBeenCalled();
  });

  it('hands a space-held drag to pan (§4.2), and sweeps again once space is released', () => {
    const { fire, fallback, onSelectMany } = setup();
    key('keydown');
    fire('onPointerDown', 20, 20);
    expect(fallback.onPointerDown).toHaveBeenCalledTimes(1);
    expect(onSelectMany).not.toHaveBeenCalled();

    key('keyup');
    fire('onPointerDown', 20, 20);
    fire('onPointerMove', 400, 200);
    fire('onPointerUp', 400, 200);
    expect(onSelectMany).toHaveBeenCalledWith(['a', 'b']);
  });
});
