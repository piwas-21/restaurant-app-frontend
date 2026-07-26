import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { MIDPOINT_ATTR, VERTEX_ATTR, useWallVertexDrag, vertexAt } from './useWallVertexDrag';
import { planDocument, planWall } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import type { ViewBox } from '@/lib/floorPlan/geometry';
import type { FloorPlanDocument, FloorPlanWall } from '@/types/floorPlan';

/** Stage and viewBox chosen so one screen pixel is exactly one plan centimetre. */
const VIEW_BOX: ViewBox = { x: 0, y: 0, w: 1000, h: 800 };

/** A press whose target carries the handle attribute the hook reads back. */
const handleTarget = (attribute?: string, index?: number) => {
  const el = document.createElement('div');
  if (attribute !== undefined && index !== undefined) {
    el.setAttribute(attribute, String(index));
  }
  return el;
};

const event = (clientX: number, clientY: number, target: Element, over: Record<string, unknown> = {}) =>
  ({
    target,
    clientX,
    clientY,
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    altKey: false,
    ...over,
  }) as unknown as ReactPointerEvent<HTMLDivElement>;

function setup(wall: FloorPlanWall | null = planWall()) {
  const doc = planDocument([], { walls: wall ? [wall] : [] });
  const apply = jest.fn();
  const onSelectVertex = jest.fn();
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
    useWallVertexDrag({
      stageRef: { current: el },
      viewBox: VIEW_BOX,
      document: doc,
      wall,
      snapEnabled: true,
      apply,
      onSelectVertex,
      fallback,
    }),
  );
  /** Press at a plan METRE coordinate — the 1 px = 1 cm stage makes it × 100. */
  const grab = (x: number, y: number, attribute?: string, index?: number) =>
    act(() => result.current.handlers.onPointerDown(event(x * 100, y * 100, handleTarget(attribute, index))));
  const moveTo = (x: number, y: number, over?: Record<string, unknown>) =>
    act(() => result.current.handlers.onPointerMove(event(x * 100, y * 100, handleTarget(), over)));
  const release = () => act(() => result.current.handlers.onPointerUp(event(0, 0, handleTarget())));
  return { result, grab, moveTo, release, apply, onSelectVertex, fallback };
}

const wallOf = (doc: FloorPlanDocument | undefined) => doc?.walls[0];
const committed = (apply: jest.Mock) => wallOf(apply.mock.calls.at(-1)?.[0] as FloorPlanDocument | undefined);

describe('useWallVertexDrag — dragging a corner', () => {
  it('moves the grabbed corner and commits once, on release', () => {
    const { grab, moveTo, release, result, apply, onSelectVertex } = setup();
    grab(5, 1, VERTEX_ATTR, 1);
    expect(onSelectVertex).toHaveBeenCalledWith(1);

    moveTo(6, 2);
    expect(wallOf(result.current.previewDoc ?? undefined)?.points[1]).toEqual({ x: 6, y: 2 });
    expect(apply).not.toHaveBeenCalled();

    release();
    expect(committed(apply)?.points[1]).toEqual({ x: 6, y: 2 });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('clears the preview once the drag has been committed', () => {
    const { grab, moveTo, release, result } = setup();
    grab(5, 1, VERTEX_ATTR, 1);
    moveTo(6, 2);
    release();
    expect(result.current.previewDoc).toBeNull();
  });

  it('leaves the other corners and the openings alone', () => {
    const before = planWall({
      openings: [{ id: 'o1', segmentIndex: 0, offsetMeters: 1, widthMeters: 1, kind: 'door', swingDirection: 'in' }],
    });
    const { grab, moveTo, release, apply } = setup(before);
    grab(5, 1, VERTEX_ATTR, 1);
    moveTo(6, 2);
    release();
    expect(committed(apply)?.points[0]).toEqual(before.points[0]);
    expect(committed(apply)?.openings).toEqual(before.openings);
  });

  it('snaps the dragged corner to the grid', () => {
    const { grab, moveTo, result } = setup();
    grab(5, 1, VERTEX_ATTR, 1);
    moveTo(6.06, 1.94);
    expect(wallOf(result.current.previewDoc ?? undefined)?.points[1]).toEqual({ x: 6, y: 2 });
  });

  it('suspends snapping with Alt, as everywhere else in the editor', () => {
    const { grab, moveTo, result } = setup();
    grab(5, 1, VERTEX_ATTR, 1);
    moveTo(6.06, 1.94, { altKey: true });
    expect(wallOf(result.current.previewDoc ?? undefined)?.points[1]).toEqual({ x: 6.06, y: 1.94 });
  });

  it('will not snap the corner onto itself, which would freeze it in place', () => {
    // Corner 1 sits OFF the grid, so its own old position is the only thing a
    // small nudge could snap to: if the corner were left among the endpoint
    // candidates the drag would pin it there and never move.
    const offGrid = planWall({
      points: [
        { x: 1, y: 1 },
        { x: 5.1, y: 1.1 },
        { x: 5, y: 4 },
        { x: 1, y: 4 },
      ],
    });
    const { grab, moveTo, result } = setup(offGrid);
    grab(5.1, 1.1, VERTEX_ATTR, 1);
    moveTo(5.12, 1.12);
    expect(wallOf(result.current.previewDoc ?? undefined)?.points[1]).toEqual({ x: 5, y: 1 });
  });

  it('still snaps onto the wall s OTHER corners, so a chain can be closed up exactly', () => {
    const offGrid = planWall({
      points: [
        { x: 1, y: 1 },
        { x: 5.1, y: 1.1 },
        { x: 5, y: 4 },
        { x: 1, y: 4 },
      ],
    });
    const { grab, moveTo, result } = setup(offGrid);
    grab(5.1, 1.1, VERTEX_ATTR, 1);
    moveTo(5.02, 3.98);
    expect(wallOf(result.current.previewDoc ?? undefined)?.points[1]).toEqual({ x: 5, y: 4 });
  });

  it('abandons the drag on cancel, committing nothing', () => {
    const { grab, moveTo, result, apply } = setup();
    grab(5, 1, VERTEX_ATTR, 1);
    moveTo(6, 2);
    act(() => result.current.handlers.onPointerCancel(event(0, 0, handleTarget())));
    expect(apply).not.toHaveBeenCalled();
    expect(result.current.previewDoc).toBeNull();
  });
});

describe('useWallVertexDrag — midpoint inserts a corner', () => {
  it('inserts at the midpoint and drags the new corner in one motion', () => {
    const { grab, moveTo, release, apply, onSelectVertex } = setup();
    // Midpoint of side 0, (1,1) → (5,1), is (3, 1).
    grab(3, 1, MIDPOINT_ATTR, 0);
    expect(onSelectVertex).toHaveBeenCalledWith(1);

    moveTo(3, 2);
    release();
    expect(committed(apply)?.points).toEqual([
      { x: 1, y: 1 },
      { x: 3, y: 2 },
      { x: 5, y: 1 },
      { x: 5, y: 4 },
      { x: 1, y: 4 },
    ]);
  });

  it('commits the bare insert even if the pointer never moved', () => {
    const { grab, release, apply } = setup();
    grab(3, 1, MIDPOINT_ATTR, 0);
    release();
    expect(committed(apply)?.points).toHaveLength(5);
  });
});

describe('useWallVertexDrag — passing the press on', () => {
  it.each([
    ['no handle under the pointer', undefined, undefined],
    ['a handle but no wall selected', VERTEX_ATTR, 1],
  ])('hands %s down the chain', (_label, attribute, index) => {
    const { grab, fallback } = setup(_label.includes('no wall') ? null : planWall());
    grab(3, 3, attribute, index);
    expect(fallback.onPointerDown).toHaveBeenCalled();
  });

  it('ignores a non-primary button', () => {
    const { result, fallback } = setup();
    act(() => result.current.handlers.onPointerDown(event(500, 100, handleTarget(VERTEX_ATTR, 1), { button: 2 })));
    expect(fallback.onPointerDown).toHaveBeenCalled();
  });

  it('leaves move and up to the next layer while no drag is running', () => {
    const { moveTo, release, fallback } = setup();
    moveTo(3, 3);
    release();
    expect(fallback.onPointerMove).toHaveBeenCalled();
    expect(fallback.onPointerUp).toHaveBeenCalled();
  });
});

describe('vertexAt', () => {
  it('reads the picked corner, and nothing when there is none', () => {
    expect(vertexAt(planWall(), 1)).toEqual({ x: 5, y: 1 });
    expect(vertexAt(planWall(), null)).toBeNull();
    expect(vertexAt(null, 1)).toBeNull();
    expect(vertexAt(planWall(), 9)).toBeNull();
  });
});
