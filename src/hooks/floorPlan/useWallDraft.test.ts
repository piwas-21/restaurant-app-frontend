import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useWallDraft } from './useWallDraft';
import { planDocument } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import type { ViewBox } from '@/lib/floorPlan/geometry';
import type { FloorPlanDocument } from '@/types/floorPlan';

/** Stage and viewBox chosen so one screen pixel is exactly one plan centimetre. */
const VIEW_BOX: ViewBox = { x: 0, y: 0, w: 1000, h: 800 };

const event = (clientX: number, clientY: number, over: Record<string, unknown> = {}) =>
  ({
    target: document.createElement('div'),
    clientX,
    clientY,
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    detail: 1,
    shiftKey: false,
    altKey: false,
    ...over,
  }) as unknown as ReactPointerEvent<HTMLDivElement>;

function setup({ active = true, doc = planDocument([]) }: { active?: boolean; doc?: FloorPlanDocument } = {}) {
  const apply = jest.fn();
  const onCreated = jest.fn();
  const onDone = jest.fn();
  const fallback = {
    onPointerDown: jest.fn(),
    onPointerMove: jest.fn(),
    onPointerUp: jest.fn(),
    onPointerCancel: jest.fn(),
  };
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 }) as DOMRect;
  const { result } = renderHook(() =>
    useWallDraft({
      stageRef: { current: el },
      viewBox: VIEW_BOX,
      document: doc,
      active,
      snapEnabled: true,
      apply,
      onCreated,
      onDone,
      fallback,
    }),
  );
  /** Click at a plan METRE coordinate — the 1 px = 1 cm stage makes it × 100. */
  const clickAt = (x: number, y: number, over?: Record<string, unknown>) =>
    act(() => result.current.handlers.onPointerDown(event(x * 100, y * 100, over)));
  const moveTo = (x: number, y: number, over?: Record<string, unknown>) =>
    act(() => result.current.handlers.onPointerMove(event(x * 100, y * 100, over)));
  const press = (key: string) =>
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    });
  return { result, clickAt, moveTo, press, apply, onCreated, onDone, fallback };
}

/** The wall the hook pushed onto the document, or undefined if it pushed nothing. */
const created = (apply: jest.Mock) => (apply.mock.calls.at(-1)?.[0] as FloorPlanDocument | undefined)?.walls.at(-1);

describe('useWallDraft — placing vertices', () => {
  it('collects a vertex per click and exposes them for the overlay', () => {
    const { clickAt, result } = setup();
    clickAt(1, 1);
    clickAt(4, 1);
    expect(result.current.draft?.points).toEqual([
      { x: 1, y: 1 },
      { x: 4, y: 1 },
    ]);
  });

  it('commits nothing until the chain is finished — a half-drawn run is not a wall', () => {
    const { clickAt, apply } = setup();
    clickAt(1, 1);
    clickAt(4, 1);
    expect(apply).not.toHaveBeenCalled();
  });

  it('tracks the snapped cursor between clicks, so the readout has a segment', () => {
    const { clickAt, moveTo, result } = setup();
    clickAt(1, 1);
    // Snapped onto the flat ray from (1, 1) with its length rounded to the 25 cm
    // grid — a 2.02 m reach becomes a clean 2.00 m run.
    moveTo(3.02, 1.04);
    expect(result.current.draft?.cursor).toEqual({ point: { x: 3, y: 1 }, kind: 'angle' });
  });

  it('ignores a non-primary button — a right-click must not place a corner', () => {
    const { clickAt, result, fallback } = setup();
    clickAt(1, 1, { button: 2 });
    expect(result.current.draft?.points).toEqual([]);
    expect(fallback.onPointerDown).toHaveBeenCalled();
  });

  // A middle-drag pans. Claiming only its pointer-DOWN would start a pan that
  // then never moved, leaving the plan unscrollable while the tool is armed.
  it('hands a pan its whole pointer sequence, not just the press', () => {
    const { result, clickAt, moveTo, fallback } = setup();
    clickAt(1, 1, { button: 1 });
    moveTo(2, 2);
    act(() => result.current.handlers.onPointerUp(event(200, 200)));

    expect(fallback.onPointerMove).toHaveBeenCalled();
    expect(fallback.onPointerUp).toHaveBeenCalled();
    expect(result.current.draft?.points).toEqual([]);
  });

  it('takes the next primary press back after a pan', () => {
    const { result, clickAt, moveTo } = setup();
    clickAt(1, 1, { button: 1 });
    act(() => result.current.handlers.onPointerUp(event(100, 100)));
    clickAt(2, 2);
    moveTo(3, 2);

    expect(result.current.draft?.points).toEqual([{ x: 2, y: 2 }]);
    expect(result.current.draft?.cursor).not.toBeNull();
  });
});

describe('useWallDraft — finishing', () => {
  it('Enter commits an open run and hands the tool back', () => {
    const { clickAt, press, apply, onCreated, onDone } = setup();
    clickAt(1, 1);
    clickAt(4, 1);
    press('Enter');

    expect(created(apply)).toMatchObject({
      isClosed: false,
      points: [
        { x: 1, y: 1 },
        { x: 4, y: 1 },
      ],
    });
    expect(onCreated).toHaveBeenCalledWith('local-wall-1');
    expect(onDone).toHaveBeenCalled();
  });

  it('a second press of a double-click finishes without placing a duplicate corner', () => {
    const { clickAt, apply } = setup();
    clickAt(1, 1);
    clickAt(4, 1);
    clickAt(4, 1, { detail: 2 });
    expect(created(apply)?.points).toHaveLength(2);
  });

  it('clicking the first corner again closes the chain into a room', () => {
    const { clickAt, apply } = setup();
    clickAt(1, 1);
    clickAt(4, 1);
    clickAt(4, 4);
    clickAt(1.02, 1.02);

    expect(created(apply)).toMatchObject({ isClosed: true, floorStyle: 'wood' });
    expect(created(apply)?.points).toHaveLength(3);
  });

  it('Enter on a single corner commits nothing — one vertex is a dot, not a wall', () => {
    const { clickAt, press, apply, onDone } = setup();
    clickAt(1, 1);
    press('Enter');
    expect(apply).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('useWallDraft — abandoning', () => {
  it('Escape drops the chain and returns to Select', () => {
    const { clickAt, press, result, apply, onDone } = setup();
    clickAt(1, 1);
    clickAt(4, 1);
    press('Escape');

    expect(result.current.draft?.points).toEqual([]);
    expect(apply).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it('Backspace takes back the last corner', () => {
    const { clickAt, press, result } = setup();
    clickAt(1, 1);
    clickAt(4, 1);
    press('Backspace');
    expect(result.current.draft?.points).toEqual([{ x: 1, y: 1 }]);
  });
});

describe('useWallDraft — inert while the tool is not active', () => {
  it('reports no draft and passes every press down the chain', () => {
    const { clickAt, moveTo, result, fallback } = setup({ active: false });
    clickAt(1, 1);
    moveTo(2, 2);
    expect(result.current.draft).toBeNull();
    expect(fallback.onPointerDown).toHaveBeenCalled();
    expect(fallback.onPointerMove).toHaveBeenCalled();
  });
});
