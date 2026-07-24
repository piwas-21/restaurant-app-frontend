import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEditorDrag } from './useEditorDrag';
import { ROTATE_HANDLE } from '@/lib/floorPlan/handles';
import { planDocument, tableGeometry } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import type { ViewBox } from '@/lib/floorPlan/geometry';

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

const setup = (selectedId: string | null = null, doc = DOC) => {
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
      selectedId,
      onSelect,
      onCommit,
      fallback,
    }),
  );
  const fire = (
    phase: 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel',
    target: Element,
    x: number,
    y: number,
    pointerType?: string,
  ) => act(() => result.current.handlers[phase](event(target, x, y, pointerType)));
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

    expect(onSelect).toHaveBeenCalledWith('a');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits nothing for a press that wobbles below the drag threshold', () => {
    // Off-lattice, so only the threshold can save it — snapping back to the same
    // grid cell would rescue an on-lattice table whatever the threshold were.
    const { fire, onCommit, table } = setup('a', OFF_LATTICE);
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
    const { fire, onCommit, grip } = setup('a');
    fire('onPointerDown', grip, 250, 250);
    fire('onPointerMove', grip, 350, 250);
    fire('onPointerUp', grip, 350, 250);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].tables[0].width).toBeCloseTo(2, 6);
  });

  it('does not resize an off-lattice table on a tap — the grip is not a button', () => {
    const { fire, onCommit, grip } = setup('a', OFF_LATTICE);
    fire('onPointerDown', grip, 260, 240);
    fire('onPointerMove', grip, 261, 240);
    fire('onPointerUp', grip, 261, 240);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('does not resize on a finger tap that drifts, as every real tap does', () => {
    // 6px of drift clears the mouse slop but not a touch tap's, per the platforms.
    const { fire, onCommit, grip } = setup('a', OFF_LATTICE);
    fire('onPointerDown', grip, 260, 240, 'touch');
    fire('onPointerMove', grip, 264, 244, 'touch');
    fire('onPointerUp', grip, 264, 244, 'touch');

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('still resizes once a finger genuinely drags', () => {
    const { fire, onCommit, grip } = setup('a', OFF_LATTICE);
    fire('onPointerDown', grip, 260, 240, 'touch');
    fire('onPointerMove', grip, 360, 240, 'touch');
    fire('onPointerUp', grip, 360, 240, 'touch');

    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('does not rotate an off-lattice table on a tap', () => {
    const { fire, onCommit, rotate } = setup('a', OFF_LATTICE);
    fire('onPointerDown', rotate, 200, 100);
    fire('onPointerMove', rotate, 201, 100);
    fire('onPointerUp', rotate, 201, 100);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('reports the running gesture and its pre-gesture origin for the overlay ghost', () => {
    const { fire, result, rotate } = setup('a');
    fire('onPointerDown', rotate, 200, 100);

    expect(result.current.gesture).toEqual({
      kind: 'rotate',
      origin: { positionX: 2, positionY: 2, width: 1, height: 1, rotation: 0 },
    });
  });

  it('rotates from the rotate grip without jumping when the ring is grabbed off-centre', () => {
    const { fire, onCommit, rotate } = setup('a');
    // Pressed a quarter turn round the ring, then moved 45° further.
    fire('onPointerDown', rotate, 300, 200);
    fire('onPointerMove', rotate, 300, 300);
    fire('onPointerUp', rotate, 300, 300);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].tables[0].rotation).toBe(45);
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
    const { fire, fallback, onSelect, grip } = setup(null);
    fire('onPointerDown', grip, 250, 250);

    expect(fallback.onPointerDown).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
