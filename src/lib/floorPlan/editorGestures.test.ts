/**
 * @jest-environment jsdom
 */
import type { FloorPlanDocument, FloorPlanTableGeometry } from '@/types/floorPlan';
import { MIN_MOVABLE_SIZE_M, gestureFromTarget, resolveGesture, type Gesture } from './editorGestures';
import { ROTATE_HANDLE } from './handles';
import { anchorOf as anchor, planDocument as doc, planItem, tableGeometry } from './__fixtures__/editorFixtures';

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

  const at = (id: string, selectedIds: string[] = ['a']) => {
    const target = scene().querySelector(`#${id}`);
    if (!target) {
      throw new Error(`fixture is missing #${id}`);
    }
    return gestureFromTarget(target, plan, selectedIds, { x: 2.5, y: 2.5 });
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
    expect(at('grip', [])).toBeNull();
  });
});

describe('editorGestures — gestureFromTarget over items', () => {
  /** Bare plan under the pointer: items are hit by footprint, not by DOM. */
  const floor = (): Element => globalThis.document.createElementNS(SVG_NS, 'rect');
  // A 1 m column at (6, 3) and a 2.4 × 1.6 m rug under it, drawn first.
  const plan = doc([table({ id: 'a' })], {
    items: [
      planItem({ id: 'rug', kind: 'rug', x: 6, y: 3, widthMeters: 2.4, heightMeters: 1.6, zIndex: 0 }),
      planItem({ id: 'col', x: 6, y: 3, zIndex: 1 }),
    ],
  });
  const press = (point: { x: number; y: number }, pad = 0) => gestureFromTarget(floor(), plan, [], point, pad);

  it('grabs an item pressed anywhere inside its footprint, not just on its ink', () => {
    // Dead centre of the column, where its symbol draws nothing but an outline.
    expect(press({ x: 6, y: 3 })).toMatchObject({ kind: 'move', id: 'col' });
  });

  it('takes the topmost item when two overlap', () => {
    // Inside both; the column is drawn last, so it is the one you grab.
    expect(press({ x: 6.3, y: 3.2 })).toMatchObject({ id: 'col' });
    // Inside the rug only.
    expect(press({ x: 7, y: 3.2 })).toMatchObject({ id: 'rug' });
  });

  it('misses bare plan, so the caller still marquees or pans', () => {
    expect(press({ x: 1, y: 6 })).toBeNull();
  });

  it('takes the item with the highest zIndex, not the last in the array', () => {
    // The renderer stacks by zIndex, so the pointer must too — otherwise a future
    // z-order control would grab the object *under* the one you can see.
    const stacked = doc([], {
      items: [planItem({ id: 'over', x: 6, y: 3, zIndex: 9 }), planItem({ id: 'under', x: 6, y: 3, zIndex: 1 })],
    });
    expect(gestureFromTarget(floor(), stacked, [], { x: 6, y: 3 })).toMatchObject({ id: 'over' });
  });

  // S8 made the wayfinding kinds first-class objects, so they ARE grabbable now
  // — a zone region is dragged like anything else once the inspector can edit
  // the name it carries.
  it.each(['zone', 'label', 'text_label', 'entrance'])('grabs a %s by its footprint', (kind) => {
    const withZone = doc([], { items: [planItem({ id: 'z1', kind, x: 6, y: 3, widthMeters: 4, heightMeters: 3 })] });
    expect(gestureFromTarget(floor(), withZone, [], { x: 6, y: 3 })).toMatchObject({ id: 'z1', kind: 'move' });
  });

  // A zone can be metres across, so an object standing inside one must still win
  // the press — otherwise the region would swallow every table on top of it.
  it('lets an object inside a zone win the press', () => {
    const stacked = doc([], {
      items: [
        planItem({ id: 'z1', kind: 'zone', x: 6, y: 3, widthMeters: 4, heightMeters: 3, zIndex: 0 }),
        planItem({ id: 'col', kind: 'column', x: 6, y: 3, zIndex: 5 }),
      ],
    });
    expect(gestureFromTarget(floor(), stacked, [], { x: 6, y: 3 })).toMatchObject({ id: 'col' });
  });

  it('grows the hit area by the caller’s screen-pixel tolerance', () => {
    const alone = doc([], { items: [planItem({ id: 'col', x: 6, y: 3 })] });
    const near = (pad: number) => gestureFromTarget(floor(), alone, [], { x: 6.56, y: 3 }, pad);
    // 6 cm outside the column's edge: a miss on its own, a hit with a 10 cm pad.
    expect(near(0)).toBeNull();
    expect(near(0.1)).toMatchObject({ id: 'col' });
  });

  it('lets a TABLE win over an item beneath it', () => {
    const group = globalThis.document.createElementNS(SVG_NS, 'g');
    group.setAttribute('data-table-id', 'a');
    // The pointer is inside the rug too, but a table was pressed.
    expect(gestureFromTarget(group, plan, [], { x: 6, y: 3 })).toMatchObject({ kind: 'move', id: 'a' });
  });

  it('rotates and resizes a selected item through the same grips', () => {
    const grip = globalThis.document.createElementNS(SVG_NS, 'rect');
    grip.setAttribute('data-handle', 'se');
    expect(gestureFromTarget(grip, plan, ['col'], { x: 6.5, y: 3.5 })).toEqual({
      kind: 'resize',
      id: 'col',
      anchor: anchor('se'),
    });
  });
});

describe('editorGestures — moving an item', () => {
  const plan = doc([], { items: [planItem({ id: 'col', x: 3, y: 3 })] });

  it('snaps and clamps an item exactly as it does a table', () => {
    expect(resolveGesture(move('col'), input(plan, { x: 4.06, y: -2 }))?.patch).toEqual({ x: 4, y: 0 });
  });

  it('aligns an item to a table edge, guide and all', () => {
    const mixed = doc([table({ id: 'a', positionX: 5.1, positionY: 5 })], {
      items: [planItem({ id: 'col', x: 3, y: 3 })],
    });
    const result = resolveGesture(move('col'), input(mixed, { x: 5.02, y: 2 }, { toleranceMeters: 0.15 }));
    // Both are 1 m, so lining their LEFT edges up (the guide at 4.6) is what puts
    // the item's centre on 5.1 — the snap is between footprints, not centres.
    expect(result?.patch.x).toBeCloseTo(5.1, 6);
    expect(result?.guides).toEqual([{ axis: 'x', atMeters: 4.6 }]);
  });
});

describe('editorGestures — move', () => {
  it('snaps the centre to the grid', () => {
    const result = resolveGesture(move('a'), input(doc([table({ id: 'a' })]), { x: 3.31, y: 2.06 }));
    expect(result?.patch).toEqual({ x: 3.25, y: 2 });
    expect(result?.guides).toEqual([]);
  });

  it('pulls onto a neighbour centre line and reports the guide to draw', () => {
    // A 2 m neighbour, so exactly one of its edge/centre marks is in range.
    const plan = doc([table({ id: 'a' }), table({ id: 'b', positionX: 5.1, positionY: 5, width: 2, height: 2 })]);
    const result = resolveGesture(move('a'), input(plan, { x: 5.02, y: 2 }, { toleranceMeters: 0.15 }));
    expect(result?.patch.x).toBeCloseTo(5.1, 6);
    expect(result?.patch.y).toBe(2);
    expect(result?.guides).toEqual([{ axis: 'x', atMeters: 5.1 }]);
  });

  it('suspends snapping while Alt is held', () => {
    const held = { modifiers: { alt: true, shift: false } };
    const result = resolveGesture(move('a'), input(doc([table({ id: 'a' })]), { x: 3.31, y: 2.06 }, held));
    expect(result?.patch).toEqual({ x: 3.31, y: 2.06 });
    expect(result?.guides).toEqual([]);
  });

  it('honours the grab offset so the table does not jump to the pointer', () => {
    const result = resolveGesture(move('a', 0.5, -0.5), input(doc([table({ id: 'a' })]), { x: 3, y: 3 }));
    expect(result?.patch).toEqual({ x: 3.5, y: 2.5 });
  });

  it('clamps a centre dragged past the plan edge', () => {
    const result = resolveGesture(move('a'), input(doc([table({ id: 'a' })]), { x: 40, y: -9 }));
    expect(result?.patch).toEqual({ x: 10, y: 0 });
  });
});

describe('editorGestures — rotate', () => {
  const plan = doc([table({ id: 'a' })]);
  /** Grabbed exactly at the grip's resting point, so the pointer angle is the angle. */
  const rotate: Gesture = { kind: 'rotate', id: 'a', grabAngle: 0 };
  // ~99.6° round from straight up.
  const point = { x: 3, y: 2.17 };

  it('snaps to 15° by default', () => {
    expect(resolveGesture(rotate, input(plan, point))?.patch).toEqual({ rotationDegrees: 105 });
  });

  it('drops to a free 1° while Shift is held', () => {
    const held = { modifiers: { alt: false, shift: true } };
    expect(resolveGesture(rotate, input(plan, point, held))?.patch).toEqual({ rotationDegrees: 100 });
  });

  it('steps by 90° while Alt is held', () => {
    const held = { modifiers: { alt: true, shift: false } };
    expect(resolveGesture(rotate, input(plan, point, held))?.patch).toEqual({ rotationDegrees: 90 });
  });

  it('rotates freely when snapping is switched off', () => {
    expect(resolveGesture(rotate, input(plan, point, { snapEnabled: false }))?.patch).toEqual({ rotationDegrees: 100 });
  });

  it('subtracts where the ring was grabbed, so a wide hit target never jumps the table', () => {
    const offRing: Gesture = { kind: 'rotate', id: 'a', grabAngle: 30 };
    expect(resolveGesture(offRing, input(plan, point, { snapEnabled: false }))?.patch).toEqual({ rotationDegrees: 70 });
  });
});

describe('editorGestures — resize', () => {
  const plan = doc([table({ id: 'a' })]);
  const grip = (id: string): Gesture => ({ kind: 'resize', id: 'a', anchor: anchor(id) });

  it('grows towards the pointer, keeping the opposite edge pinned', () => {
    const result = resolveGesture(grip('e'), input(plan, { x: 3.5, y: 2 }));
    expect(result?.patch).toEqual({ x: 2.5, y: 2, widthMeters: 2, heightMeters: 1 });
  });

  it('rounds the new extent to the grid', () => {
    expect(resolveGesture(grip('e'), input(plan, { x: 3.34, y: 2 }))?.patch.widthMeters).toBeCloseTo(1.75, 6);
  });

  it('resizes freely while Alt is held', () => {
    const held = { modifiers: { alt: true, shift: false } };
    expect(resolveGesture(grip('e'), input(plan, { x: 3.34, y: 2 }, held))?.patch.widthMeters).toBeCloseTo(1.84, 6);
  });

  it('never shrinks below the minimum footprint', () => {
    expect(resolveGesture(grip('e'), input(plan, { x: 1, y: 2 }))?.patch.widthMeters).toBe(MIN_MOVABLE_SIZE_M);
  });

  it('never grows past the plan, which is where the server would silently clamp it', () => {
    const result = resolveGesture(grip('se'), input(plan, { x: 60, y: 40 }));
    expect(result?.patch).toMatchObject({ widthMeters: 10, heightMeters: 8 });
  });
});

describe('editorGestures — resolveGesture guard', () => {
  it('returns null when the gesture table has gone (a reload landed mid-drag)', () => {
    expect(resolveGesture(move('ghost'), input(doc([table({ id: 'a' })]), { x: 1, y: 1 }))).toBeNull();
  });
});
