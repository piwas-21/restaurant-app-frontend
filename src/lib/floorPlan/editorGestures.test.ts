/**
 * @jest-environment jsdom
 */
import type { FloorPlanDocument, FloorPlanTableGeometry } from '@/types/floorPlan';
import { MIN_TABLE_SIZE_M, gestureFromTarget, resolveGesture, type Gesture } from './editorGestures';
import { ROTATE_HANDLE } from './handles';
import { anchorOf as anchor, planDocument as doc, tableGeometry } from './__fixtures__/editorFixtures';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** These suites all work around a table at (2, 2) rather than the fixture default. */
const table = (over: Partial<FloorPlanTableGeometry> = {}): FloorPlanTableGeometry =>
  tableGeometry({ positionX: 2, positionY: 2, ...over });

const input = (document: FloorPlanDocument, point: { x: number; y: number }, over = {}) => ({
  document,
  point,
  modifiers: { alt: false, shift: false },
  snapEnabled: true,
  toleranceMeters: 0.05,
  ...over,
});

const move = (id: string, grabX = 0, grabY = 0): Gesture => ({ kind: 'move', id, grabX, grabY });

describe('editorGestures — gestureFromTarget', () => {
  const plan = doc([table({ id: 'a' })]);

  /** A minimal SVG subtree, so `closest()` behaves as it does in the real scene. */
  const scene = (): SVGSVGElement => {
    const node = (tag: string, id: string, attrs: Record<string, string> = {}) => {
      const el = globalThis.document.createElementNS(SVG_NS, tag);
      el.setAttribute('id', id);
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value);
      }
      return el;
    };
    const svg = globalThis.document.createElementNS(SVG_NS, 'svg');
    const group = node('g', 'table-a', { 'data-table-id': 'a' });
    group.appendChild(node('rect', 'top'));
    svg.append(
      group,
      node('rect', 'grip', { 'data-handle': 'se' }),
      node('circle', 'rot', { 'data-handle': ROTATE_HANDLE }),
      node('rect', 'bogus', { 'data-handle': 'not-a-grip' }),
      node('rect', 'floor'),
    );
    return svg;
  };

  const at = (id: string, selectedId: string | null = 'a') => {
    const target = scene().querySelector(`#${id}`);
    if (!target) {
      throw new Error(`fixture is missing #${id}`);
    }
    return gestureFromTarget(target, plan, selectedId, { x: 2.5, y: 2.5 });
  };

  it('starts a move from anywhere inside a table, grabbing at the offset pressed', () => {
    expect(at('top')).toEqual({ kind: 'move', id: 'a', grabX: -0.5, grabY: -0.5 });
  });

  it('starts a resize from a grip, acting on the selected table', () => {
    expect(at('grip')).toEqual({ kind: 'resize', id: 'a', anchor: anchor('se') });
  });

  it('starts a rotate from the rotate grip, recording where on the ring it was grabbed', () => {
    // Pressed down-right of the centre: 135° round, on a table sitting at 0°.
    expect(at('rot')).toEqual({ kind: 'rotate', id: 'a', grabAngle: 135 });
  });

  it('starts nothing on empty plan, so the caller pans instead', () => {
    expect(at('floor')).toBeNull();
  });

  it('starts nothing for an unrecognised handle token', () => {
    expect(at('bogus')).toBeNull();
  });

  it('ignores grips when nothing is selected', () => {
    expect(at('grip', null)).toBeNull();
  });
});

describe('editorGestures — move', () => {
  it('snaps the centre to the grid', () => {
    const result = resolveGesture(move('a'), input(doc([table({ id: 'a' })]), { x: 3.31, y: 2.06 }));
    expect(result?.patch).toEqual({ positionX: 3.25, positionY: 2 });
    expect(result?.guides).toEqual([]);
  });

  it('pulls onto a neighbour centre line and reports the guide to draw', () => {
    // A 2 m neighbour, so exactly one of its edge/centre marks is in range.
    const plan = doc([table({ id: 'a' }), table({ id: 'b', positionX: 5.1, positionY: 5, width: 2, height: 2 })]);
    const result = resolveGesture(move('a'), input(plan, { x: 5.02, y: 2 }, { toleranceMeters: 0.15 }));
    expect(result?.patch.positionX).toBeCloseTo(5.1, 6);
    expect(result?.patch.positionY).toBe(2);
    expect(result?.guides).toEqual([{ axis: 'x', atMeters: 5.1 }]);
  });

  it('suspends snapping while Alt is held', () => {
    const held = { modifiers: { alt: true, shift: false } };
    const result = resolveGesture(move('a'), input(doc([table({ id: 'a' })]), { x: 3.31, y: 2.06 }, held));
    expect(result?.patch).toEqual({ positionX: 3.31, positionY: 2.06 });
    expect(result?.guides).toEqual([]);
  });

  it('honours the grab offset so the table does not jump to the pointer', () => {
    const result = resolveGesture(move('a', 0.5, -0.5), input(doc([table({ id: 'a' })]), { x: 3, y: 3 }));
    expect(result?.patch).toEqual({ positionX: 3.5, positionY: 2.5 });
  });

  it('clamps a centre dragged past the plan edge', () => {
    const result = resolveGesture(move('a'), input(doc([table({ id: 'a' })]), { x: 40, y: -9 }));
    expect(result?.patch).toEqual({ positionX: 10, positionY: 0 });
  });
});

describe('editorGestures — rotate', () => {
  const plan = doc([table({ id: 'a' })]);
  /** Grabbed exactly at the grip's resting point, so the pointer angle is the angle. */
  const rotate: Gesture = { kind: 'rotate', id: 'a', grabAngle: 0 };
  // ~99.6° round from straight up.
  const point = { x: 3, y: 2.17 };

  it('snaps to 15° by default', () => {
    expect(resolveGesture(rotate, input(plan, point))?.patch).toEqual({ rotation: 105 });
  });

  it('drops to a free 1° while Shift is held', () => {
    const held = { modifiers: { alt: false, shift: true } };
    expect(resolveGesture(rotate, input(plan, point, held))?.patch).toEqual({ rotation: 100 });
  });

  it('steps by 90° while Alt is held', () => {
    const held = { modifiers: { alt: true, shift: false } };
    expect(resolveGesture(rotate, input(plan, point, held))?.patch).toEqual({ rotation: 90 });
  });

  it('rotates freely when snapping is switched off', () => {
    expect(resolveGesture(rotate, input(plan, point, { snapEnabled: false }))?.patch).toEqual({ rotation: 100 });
  });

  it('subtracts where the ring was grabbed, so a wide hit target never jumps the table', () => {
    const offRing: Gesture = { kind: 'rotate', id: 'a', grabAngle: 30 };
    expect(resolveGesture(offRing, input(plan, point, { snapEnabled: false }))?.patch).toEqual({ rotation: 70 });
  });
});

describe('editorGestures — resize', () => {
  const plan = doc([table({ id: 'a' })]);
  const grip = (id: string): Gesture => ({ kind: 'resize', id: 'a', anchor: anchor(id) });

  it('grows towards the pointer, keeping the opposite edge pinned', () => {
    const result = resolveGesture(grip('e'), input(plan, { x: 3.5, y: 2 }));
    expect(result?.patch).toEqual({ positionX: 2.5, positionY: 2, width: 2, height: 1 });
  });

  it('rounds the new extent to the grid', () => {
    expect(resolveGesture(grip('e'), input(plan, { x: 3.34, y: 2 }))?.patch.width).toBeCloseTo(1.75, 6);
  });

  it('resizes freely while Alt is held', () => {
    const held = { modifiers: { alt: true, shift: false } };
    expect(resolveGesture(grip('e'), input(plan, { x: 3.34, y: 2 }, held))?.patch.width).toBeCloseTo(1.84, 6);
  });

  it('never shrinks below the minimum footprint', () => {
    expect(resolveGesture(grip('e'), input(plan, { x: 1, y: 2 }))?.patch.width).toBe(MIN_TABLE_SIZE_M);
  });

  it('never grows past the plan, which is where the server would silently clamp it', () => {
    const result = resolveGesture(grip('se'), input(plan, { x: 60, y: 40 }));
    expect(result?.patch).toMatchObject({ width: 10, height: 8 });
  });
});

describe('editorGestures — resolveGesture guard', () => {
  it('returns null when the gesture table has gone (a reload landed mid-drag)', () => {
    expect(resolveGesture(move('ghost'), input(doc([table({ id: 'a' })]), { x: 1, y: 1 }))).toBeNull();
  });
});
