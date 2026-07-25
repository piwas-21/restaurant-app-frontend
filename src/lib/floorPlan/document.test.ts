import type { FloorPlanDocument, FloorPlanItem, FloorPlanWall } from '@/types/floorPlan';
import { anchorOf, planDocument, planItem, tableGeometry } from './__fixtures__/editorFixtures';
import {
  addItem,
  applyGesture,
  addWall,
  patchMovable,
  removeItem,
  removeItems,
  removeWall,
  setPlanSize,
  updateItem,
  updateTable,
  updateWall,
} from './document';

const doc = (): FloorPlanDocument => ({
  id: 'p',
  name: 'Plan',
  widthMeters: 10,
  heightMeters: 8,
  gridSizeCm: 25,
  backgroundStyle: 'plain',
  isDefault: true,
  displayOrder: 0,
  walls: [{ id: 'w1', points: [], thicknessMeters: 0.1, isClosed: false, zIndex: 0, openings: [] }],
  items: [
    { id: 'i1', kind: 'plant_small', x: 1, y: 1, widthMeters: 0.5, heightMeters: 0.5, rotationDegrees: 0, zIndex: 0 },
  ],
  tables: [
    {
      id: 't1',
      tableNumber: '1',
      maxGuests: 4,
      isActive: true,
      isOutdoor: false,
      positionX: 2,
      positionY: 2,
      width: 1,
      height: 1,
      shape: 'round',
      rotation: 0,
    },
  ],
});

describe('floorPlan/document', () => {
  it('patches a table immutably and leaves an unknown id alone', () => {
    const before = doc();
    const after = updateTable(before, 't1', { rotation: 45 });
    expect(after).not.toBe(before);
    expect(after.tables[0].rotation).toBe(45);
    expect(before.tables[0].rotation).toBe(0); // original untouched
    expect(updateTable(before, 'nope', { rotation: 90 }).tables[0].rotation).toBe(0);
  });

  it('patches an item and leaves an unknown id alone', () => {
    expect(updateItem(doc(), 'i1', { x: 3 }).items[0].x).toBe(3);
    const untouched = doc();
    expect(updateItem(untouched, 'nope', { x: 9 })).toEqual(untouched);
  });

  it('adds and removes items', () => {
    const item: FloorPlanItem = {
      id: 'i2',
      kind: 'tree',
      x: 5,
      y: 5,
      widthMeters: 1,
      heightMeters: 1,
      rotationDegrees: 0,
      zIndex: 1,
    };
    expect(addItem(doc(), item).items).toHaveLength(2);
    expect(removeItem(doc(), 'i1').items).toHaveLength(0);
  });

  it('adds, patches and removes walls', () => {
    const wall: FloorPlanWall = {
      id: 'w2',
      points: [],
      thicknessMeters: 0.15,
      isClosed: true,
      roomName: 'X',
      zIndex: 1,
      openings: [],
    };
    expect(addWall(doc(), wall).walls).toHaveLength(2);
    expect(updateWall(doc(), 'w1', { roomName: 'Main' }).walls[0].roomName).toBe('Main');
    expect(updateWall(doc(), 'nope', { roomName: 'X' }).walls[0].roomName).toBeUndefined();
    expect(removeWall(doc(), 'w1').walls).toHaveLength(0);
  });

  it('sets the plan size', () => {
    const after = setPlanSize(doc(), 12, 9);
    expect(after.widthMeters).toBe(12);
    expect(after.heightMeters).toBe(9);
  });

  it('removes several items in one edit, and returns the same document for none', () => {
    const before = addItem(doc(), { ...doc().items[0], id: 'i2' });
    expect(removeItems(before, ['i1', 'i2']).items).toHaveLength(0);
    expect(removeItems(before, ['ghost'])).toBe(before);
  });
});

describe('document — patchMovable', () => {
  it('writes a normalised patch onto a TABLE under its own column names', () => {
    const after = patchMovable(doc(), 't1', { x: 5, rotationDegrees: 90 });
    expect(after.tables[0]).toMatchObject({ positionX: 5, rotation: 90, positionY: 2 });
  });

  it('writes the same patch onto an ITEM untranslated', () => {
    const after = patchMovable(doc(), 'i1', { x: 5, rotationDegrees: 90 });
    expect(after.items[0]).toMatchObject({ x: 5, rotationDegrees: 90, y: 1 });
  });

  it('leaves the document untouched for an id in neither collection', () => {
    const before = doc();
    expect(patchMovable(before, 'zzz', { x: 9 })).toBe(before);
  });
});

describe('document — applyGesture', () => {
  const plan = planDocument(
    [
      tableGeometry({ id: 'a', positionX: 2, positionY: 2 }),
      tableGeometry({ id: 'b', positionX: 4, positionY: 3 }),
      tableGeometry({ id: 'c', positionX: 8, positionY: 6 }),
    ],
    { items: [planItem({ id: 'i1', x: 6, y: 4 })] },
  );
  const moveTo = (x: number, y: number) => ({ patch: { x, y }, guides: [] });
  const move = { kind: 'move', id: 'a', grabX: 0, grabY: 0 } as const;

  it('carries every other selected table by the same delta', () => {
    const next = applyGesture(plan, move, moveTo(3, 4), ['a', 'b']);
    expect(next.tables).toMatchObject([
      { id: 'a', positionX: 3, positionY: 4 },
      { id: 'b', positionX: 5, positionY: 5 },
      { id: 'c', positionX: 8, positionY: 6 },
    ]);
  });

  it('clamps each follower to the plan on its own, squashing a group against a wall', () => {
    // 'c' is already near the corner of the 10 × 8 plan, so it stops before 'a' does.
    const next = applyGesture(plan, move, moveTo(5, 5), ['a', 'c']);
    expect(next.tables[2]).toMatchObject({ positionX: 10, positionY: 8 });
  });

  it('moves only the grabbed table when nothing else is selected', () => {
    const next = applyGesture(plan, move, moveTo(3, 4), ['a']);
    expect(next.tables[1]).toEqual(plan.tables[1]);
  });

  it.each(['rotate', 'resize'] as const)('leaves the rest of the selection alone on a %s', (kind) => {
    const gesture =
      kind === 'rotate'
        ? ({ kind, id: 'a', grabAngle: 0 } as const)
        : ({ kind, id: 'a', anchor: anchorOf('e') } as const);
    const next = applyGesture(plan, gesture, { patch: { rotationDegrees: 45, widthMeters: 2 }, guides: [] }, [
      'a',
      'b',
    ]);
    expect(next.tables[1]).toEqual(plan.tables[1]);
  });

  it('carries a selected ITEM along with a table drag, and back the other way', () => {
    const withItem = applyGesture(plan, move, moveTo(3, 4), ['a', 'i1']);
    expect(withItem.items[0]).toMatchObject({ x: 7, y: 6 });

    const grabItem = { kind: 'move', id: 'i1', grabX: 0, grabY: 0 } as const;
    const fromItem = applyGesture(plan, grabItem, moveTo(7, 5), ['i1', 'a']);
    expect(fromItem.items[0]).toMatchObject({ x: 7, y: 5 });
    expect(fromItem.tables[0]).toMatchObject({ positionX: 3, positionY: 3 });
  });

  it('moves nothing for a move patch that carries no position at all', () => {
    // `patch` is a Partial, so the delta falls back to "no change" rather than NaN.
    expect(applyGesture(plan, move, { patch: {}, guides: [] }, ['a', 'b']).tables).toEqual(plan.tables);
  });

  it('still applies the patch when the grabbed table has gone from the document', () => {
    const gone = { kind: 'move', id: 'ghost', grabX: 0, grabY: 0 } as const;
    expect(applyGesture(plan, gone, moveTo(3, 4), ['ghost', 'b']).tables).toEqual(plan.tables);
  });
});
