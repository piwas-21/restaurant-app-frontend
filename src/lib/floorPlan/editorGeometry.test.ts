import {
  clampCentreToPlan,
  geometrySnapshot,
  otherTableRects,
  overlappingTableIds,
  sameGeometry,
  tableOrientedRect,
  tableSnapRect,
} from './editorGeometry';
import { tableGeometry as table } from './__fixtures__/editorFixtures';

describe('editorGeometry — rect derivations', () => {
  it('reads centre + size straight through for the snap rect', () => {
    expect(tableSnapRect(table({ positionX: 2, positionY: 3, width: 1.2, height: 0.8 }))).toEqual({
      x: 2,
      y: 3,
      widthMeters: 1.2,
      heightMeters: 0.8,
    });
  });

  it('adds rotation for the oriented rect', () => {
    expect(tableOrientedRect(table({ rotation: 45 })).rotationDegrees).toBe(45);
  });

  it('lists the other tables as alignment targets, excluding the dragged one', () => {
    const tables = [table({ id: 'a' }), table({ id: 'b', positionX: 5 }), table({ id: 'c', positionX: 9 })];
    const rects = otherTableRects(tables, 'b');
    expect(rects).toHaveLength(2);
    expect(rects.map((r) => r.x)).toEqual([1, 9]);
  });
});

describe('editorGeometry — overlappingTableIds', () => {
  it('flags both tables of an overlapping pair and leaves clear ones out', () => {
    const tables = [
      table({ id: 'a', positionX: 1, positionY: 1 }),
      table({ id: 'b', positionX: 1.2, positionY: 1 }), // overlaps a
      table({ id: 'c', positionX: 8, positionY: 8 }), // far away
    ];
    const hits = overlappingTableIds(tables);
    expect(hits).toEqual(new Set(['a', 'b']));
  });

  it('does not flag tables that merely touch at an edge', () => {
    const tables = [
      table({ id: 'a', positionX: 1, positionY: 1, width: 1, height: 1 }),
      table({ id: 'b', positionX: 2, positionY: 1, width: 1, height: 1 }), // left edge = a right edge
    ];
    expect(overlappingTableIds(tables).size).toBe(0);
  });

  it('is empty for a single table', () => {
    expect(overlappingTableIds([table({ id: 'a' })]).size).toBe(0);
  });
});

describe('editorGeometry — geometry snapshots', () => {
  it('keeps only the geometry a canvas gesture can change', () => {
    expect(geometrySnapshot(table({ id: 'a', tableNumber: '9', maxGuests: 8, rotation: 45 }))).toEqual({
      positionX: 1,
      positionY: 1,
      width: 1,
      height: 1,
      rotation: 45,
    });
  });

  it('treats a table whose metadata changed as geometrically unchanged', () => {
    const before = geometrySnapshot(table({ id: 'a', tableNumber: '1' }));
    const after = geometrySnapshot(table({ id: 'a', tableNumber: '2', maxGuests: 12 }));
    expect(sameGeometry(before, after)).toBe(true);
  });

  it.each(['positionX', 'positionY', 'width', 'height', 'rotation'] as const)('notices a changed %s', (field) => {
    const before = geometrySnapshot(table({}));
    const after = geometrySnapshot(table({ [field]: 4 }));
    expect(sameGeometry(before, after)).toBe(false);
  });
});

describe('editorGeometry — clampCentreToPlan', () => {
  const plan = { widthMeters: 12, heightMeters: 8 };

  it('passes an in-bounds centre through unchanged', () => {
    expect(clampCentreToPlan(5, 4, plan)).toEqual({ x: 5, y: 4 });
  });

  it('clamps a centre dragged past the plan edges', () => {
    expect(clampCentreToPlan(-3, 20, plan)).toEqual({ x: 0, y: 8 });
  });
});
