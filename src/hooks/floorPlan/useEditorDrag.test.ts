import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEditorDrag } from './useEditorDrag';
import { ROTATE_HANDLE } from '@/lib/floorPlan/handles';
import { planDocument, planItem, tableGeometry } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import type { ViewBox } from '@/lib/floorPlan/geometry';
import type { StagePointerPhase } from './editorStage';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Stage and viewBox chosen so one screen pixel is exactly one plan centimetre. */
const VIEW_BOX: ViewBox = { x: 0, y: 0, w: 1000, h: 800 };
const DOC = planDocument([tableGeometry({ id: 'a', positionX: 2, positionY: 2 })]);
/**
 * A table whose size and angle are NOT on the snap lattice — the shape RUMI
 * actually seeds. Snapping quantises absolutely, so without a drag threshold the
 * first jittered move of a *press* would round it onto the lattice.
 */
const OFF_LATTICE = planDocument([
  tableGeometry({ id: 'a', positionX: 2, positionY: 2, width: 1.2, height: 0.8, rotation: 20 }),
]);

const stageRef = () => {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 }) as DOMRect;
  el.setPointerCapture = jest.fn();
  return { current: el };
};

/** The scene's pointer targets: a table group, a resize grip, the rotate grip, bare floor. */
const targets = () => {
  const node = (tag: string, attrs: Record<string, string> = {}) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) {
      el.setAttribute(name, value);
    }
    return el;
  };
  const svg = document.createElementNS(SVG_NS, 'svg');
  const table = node('g', { 'data-table-id': 'a' });
  const grip = node('rect', { 'data-handle': 'se' });
  const rotate = node('circle', { 'data-handle': ROTATE_HANDLE });
  const floor = node('rect');
  svg.append(table, grip, rotate, floor);
  return { table, grip, rotate, floor };
};

const event = (target: Element, clientX: number, clientY: number, pointerType = 'mouse') =>
  ({
    target,
    clientX,
    clientY,
    pointerId: 1,
    pointerType,
    altKey: false,
    shiftKey: false,
  }) as unknown as ReactPointerEvent<HTMLDivElement>;

const setup = (selected: string[] = [], doc = DOC) => {
  const onCommit = jest.fn();
  const onSelect = jest.fn();
  const fallback = {
    onPointerDown: jest.fn(),
    onPointerMove: jest.fn(),
    onPointerUp: jest.fn(),
    onPointerCancel: jest.fn(),
  };
  const ref = stageRef();
  const { result } = renderHook(() =>
    useEditorDrag({
      stageRef: ref,
      viewBox: VIEW_BOX,
      document: doc,
      snapEnabled: true,
      selectedIds: selected,
      onSelect,
      onCommit,
      fallback,
    }),
  );
  const fire = (phase: StagePointerPhase, target: Element, x: number, y: number, pointerType?: string) =>
    act(() => result.current.handlers[phase](event(target, x, y, pointerType)));
  return { result, fire, onCommit, onSelect, fallback, ...targets() };
};

describe('useEditorDrag — history accounting', () => {
  it('commits exactly one entry for a drag, however many moves it took', () => {
    const { fire, onCommit, table } = setup();
    fire('onPointerDown', table, 200, 200);
    fire('onPointerMove', table, 240, 260);
    fire('onPointerMove', table, 280, 290);
    fire('onPointerMove', table, 300, 300);
    fire('onPointerUp', table, 300, 300);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].tables[0]).toMatchObject({ id: 'a', positionX: 3, positionY: 3 });
  });

  it('commits nothing for a tap that only selects', () => {
    const { fire, onCommit, onSelect, table } = setup();
    fire('onPointerDown', table, 200, 200);
    fire('onPointerUp', table, 200, 200);

    expect(onSelect).toHaveBeenCalledWith('a', false);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits nothing for a press that wobbles below the drag threshold', () => {
    // Off-lattice, so only the threshold can save it — snapping back to the same
    // grid cell would rescue an on-lattice table whatever the threshold were.
    const { fire, onCommit, table } = setup(['a'], OFF_LATTICE);
    fire('onPointerDown', table, 200, 200);
    fire('onPointerMove', table, 201, 201);
    fire('onPointerUp', table, 201, 201);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits nothing when a drag is cancelled mid-gesture', () => {
    const { fire, onCommit, result, table } = setup();
    fire('onPointerDown', table, 200, 200);
    fire('onPointerMove', table, 300, 300);
    expect(result.current.previewDoc).not.toBeNull();

    fire('onPointerCancel', table, 300, 300);
    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.previewDoc).toBeNull();
    expect(result.current.gesture).toBeNull();
  });

  it('commits nothing for a drag that ends where it started', () => {
    const { fire, onCommit, table } = setup();
    fire('onPointerDown', table, 200, 200);
    fire('onPointerMove', table, 300, 300);
    fire('onPointerMove', table, 200, 200);
    fire('onPointerUp', table, 200, 200);

    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('useEditorDrag — grips', () => {
  it('resizes the selection from a grip, committing once', () => {
    const { fire, onCommit, grip } = setup(['a']);
    fire('onPointerDown', grip, 250, 250);
    fire('onPointerMove', grip, 350, 250);
    fire('onPointerUp', grip, 350, 250);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].tables[0].width).toBeCloseTo(2, 6);
  });

  it('does not resize an off-lattice table on a tap — the grip is not a button', () => {
    const { fire, onCommit, grip } = setup(['a'], OFF_LATTICE);
    fire('onPointerDown', grip, 260, 240);
    fire('onPointerMove', grip, 261, 240);
    fire('onPointerUp', grip, 261, 240);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('does not resize on a finger tap that drifts, as every real tap does', () => {
    // 6px of drift clears the mouse slop but not a touch tap's, per the platforms.
    const { fire, onCommit, grip } = setup(['a'], OFF_LATTICE);
    fire('onPointerDown', grip, 260, 240, 'touch');
    fire('onPointerMove', grip, 264, 244, 'touch');
    fire('onPointerUp', grip, 264, 244, 'touch');

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('still resizes once a finger genuinely drags', () => {
    const { fire, onCommit, grip } = setup(['a'], OFF_LATTICE);
    fire('onPointerDown', grip, 260, 240, 'touch');
    fire('onPointerMove', grip, 360, 240, 'touch');
    fire('onPointerUp', grip, 360, 240, 'touch');

    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('does not rotate an off-lattice table on a tap', () => {
    const { fire, onCommit, rotate } = setup(['a'], OFF_LATTICE);
    fire('onPointerDown', rotate, 200, 100);
    fire('onPointerMove', rotate, 201, 100);
    fire('onPointerUp', rotate, 201, 100);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('reports the running gesture and its pre-gesture origin for the overlay ghost', () => {
    const { fire, result, rotate } = setup(['a']);
    fire('onPointerDown', rotate, 200, 100);

    expect(result.current.gesture).toEqual({
      kind: 'rotate',
      origin: { x: 2, y: 2, widthMeters: 1, heightMeters: 1, rotationDegrees: 0 },
    });
  });

  it('rotates from the rotate grip without jumping when the ring is grabbed off-centre', () => {
    const { fire, onCommit, rotate } = setup(['a']);
    // Pressed a quarter turn round the ring, then moved 45° further.
    fire('onPointerDown', rotate, 300, 200);
    fire('onPointerMove', rotate, 300, 300);
    fire('onPointerUp', rotate, 300, 300);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].tables[0].rotation).toBe(45);
  });
});

describe('useEditorDrag — multi-selection', () => {
  it('carries every selected table by the same delta, in one history entry', () => {
    const doc = planDocument([
      tableGeometry({ id: 'a', positionX: 2, positionY: 2 }),
      tableGeometry({ id: 'b', positionX: 4, positionY: 3 }),
    ]);
    const { fire, onCommit, table } = setup(['a', 'b'], doc);
    fire('onPointerDown', table, 200, 200);
    fire('onPointerMove', table, 300, 300);
    fire('onPointerUp', table, 300, 300);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].tables).toMatchObject([
      { id: 'a', positionX: 3, positionY: 3 },
      { id: 'b', positionX: 5, positionY: 4 },
    ]);
  });

  it('drags only the pressed table when a DIFFERENT one was selected', () => {
    // The regression: `onSelect` is a setState, so the handler still sees the
    // pre-press selection — using it as the follower list dragged the old one.
    const doc = planDocument([
      tableGeometry({ id: 'a', positionX: 2, positionY: 2 }),
      tableGeometry({ id: 'b', positionX: 4, positionY: 3 }),
    ]);
    const { fire, onCommit, table } = setup(['b'], doc);
    fire('onPointerDown', table, 200, 200);
    fire('onPointerMove', table, 300, 300);
    fire('onPointerUp', table, 300, 300);

    expect(onCommit.mock.calls[0][0].tables).toMatchObject([
      { id: 'a', positionX: 3, positionY: 3 },
      { id: 'b', positionX: 4, positionY: 3 },
    ]);
  });

  it('picks up a shift-added table straight away, without waiting for a re-render', () => {
    const doc = planDocument([
      tableGeometry({ id: 'a', positionX: 2, positionY: 2 }),
      tableGeometry({ id: 'b', positionX: 4, positionY: 3 }),
    ]);
    const { result, onCommit, table } = setup(['b'], doc);
    act(() =>
      result.current.handlers.onPointerDown({
        ...event(table, 200, 200),
        shiftKey: true,
      } as unknown as ReactPointerEvent<HTMLDivElement>),
    );
    act(() => result.current.handlers.onPointerMove(event(table, 300, 300)));
    act(() => result.current.handlers.onPointerUp(event(table, 300, 300)));

    expect(onCommit.mock.calls[0][0].tables).toMatchObject([
      { id: 'a', positionX: 3, positionY: 3 },
      { id: 'b', positionX: 5, positionY: 4 },
    ]);
  });

  it('starts no drag when a shift-press DEselects the table under the cursor', () => {
    const { result, onCommit, onSelect, table } = setup(['a', 'b']);
    act(() =>
      result.current.handlers.onPointerDown({
        ...event(table, 200, 200),
        shiftKey: true,
      } as unknown as ReactPointerEvent<HTMLDivElement>),
    );
    act(() => result.current.handlers.onPointerMove(event(table, 300, 300)));
    act(() => result.current.handlers.onPointerUp(event(table, 300, 300)));

    expect(onSelect).toHaveBeenCalledWith('a', true);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('does not collapse the group when a press lands on one of its tables', () => {
    const { fire, onSelect, table } = setup(['a', 'b']);
    fire('onPointerDown', table, 200, 200);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('collapses to the one table when that press turns out to be a tap', () => {
    const { fire, onSelect, table } = setup(['a', 'b']);
    fire('onPointerDown', table, 200, 200);
    fire('onPointerUp', table, 200, 200);

    expect(onSelect).toHaveBeenCalledWith('a', false);
  });

  it('keeps the group after a real drag, so it can be dragged again', () => {
    const { fire, onSelect, table } = setup(['a', 'b']);
    fire('onPointerDown', table, 200, 200);
    fire('onPointerMove', table, 300, 300);
    fire('onPointerUp', table, 300, 300);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('passes Shift through so a press can add to the selection', () => {
    const { result, onSelect, table } = setup(['b']);
    act(() =>
      result.current.handlers.onPointerDown({
        ...event(table, 200, 200),
        shiftKey: true,
      } as unknown as ReactPointerEvent<HTMLDivElement>),
    );

    expect(onSelect).toHaveBeenCalledWith('a', true);
  });

  it('draws no grips for a group, so a grip press cannot start a gesture', () => {
    const { fire, fallback, grip } = setup(['a', 'b']);
    fire('onPointerDown', grip, 250, 250);

    expect(fallback.onPointerDown).toHaveBeenCalledTimes(1);
  });
});

describe('useEditorDrag — fall-through to pan', () => {
  it('hands an empty-space press to the pan/pinch fallback and selects nothing', () => {
    const { fire, fallback, onSelect, floor } = setup();
    fire('onPointerDown', floor, 500, 500);

    expect(fallback.onPointerDown).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('hands moves to the fallback while nothing is grabbed', () => {
    const { fire, fallback, floor } = setup();
    fire('onPointerMove', floor, 500, 500);
    fire('onPointerUp', floor, 500, 500);
    fire('onPointerCancel', floor, 500, 500);

    expect(fallback.onPointerMove).toHaveBeenCalledTimes(1);
    expect(fallback.onPointerUp).toHaveBeenCalledTimes(1);
    expect(fallback.onPointerCancel).toHaveBeenCalledTimes(1);
  });

  it('ignores a grip press when nothing is selected, so the canvas still pans', () => {
    const { fire, fallback, onSelect, grip } = setup([]);
    fire('onPointerDown', grip, 250, 250);

    expect(fallback.onPointerDown).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('useEditorDrag — placed items', () => {
  /** A 1 m column at (6, 3), reached by pressing bare plan inside its footprint. */
  const WITH_ITEM = planDocument([tableGeometry({ id: 'a', positionX: 2, positionY: 2 })], {
    items: [planItem({ id: 'col', x: 6, y: 3 })],
  });

  it('grabs an item pressed on bare plan inside its footprint, and selects it', () => {
    const { fire, onSelect, onCommit, floor } = setup([], WITH_ITEM);
    fire('onPointerDown', floor, 600, 300);
    fire('onPointerMove', floor, 650, 300);
    fire('onPointerUp', floor, 650, 300);

    expect(onSelect).toHaveBeenCalledWith('col', false);
    expect(onCommit.mock.calls[0][0].items[0]).toMatchObject({ x: 6.5, y: 3 });
  });

  it('commits nothing for a tap on an item — a press is not an edit', () => {
    const { fire, onCommit, floor } = setup([], WITH_ITEM);
    fire('onPointerDown', floor, 600, 300);
    fire('onPointerUp', floor, 600, 300);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('carries a table along when it is part of the selection', () => {
    const { fire, onCommit, floor } = setup(['col', 'a'], WITH_ITEM);
    fire('onPointerDown', floor, 600, 300);
    fire('onPointerMove', floor, 700, 300);
    fire('onPointerUp', floor, 700, 300);

    const next = onCommit.mock.calls[0][0];
    expect(next.items[0]).toMatchObject({ x: 7 });
    expect(next.tables[0]).toMatchObject({ positionX: 3 });
  });

  it('still pans from bare plan that no item covers', () => {
    const { fire, fallback, floor } = setup([], WITH_ITEM);
    fire('onPointerDown', floor, 100, 700);

    expect(fallback.onPointerDown).toHaveBeenCalledTimes(1);
  });
});
