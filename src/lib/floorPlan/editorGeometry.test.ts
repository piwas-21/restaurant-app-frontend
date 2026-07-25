import { clampCentreToPlan, overlappingTableIds } from './editorGeometry';
import { tableGeometry as table } from './__fixtures__/editorFixtures';

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

describe('editorGeometry — clampCentreToPlan', () => {
  const plan = { widthMeters: 12, heightMeters: 8 };

  it('passes an in-bounds centre through unchanged', () => {
    expect(clampCentreToPlan(5, 4, plan)).toEqual({ x: 5, y: 4 });
  });

  it('clamps a centre dragged past the plan edges', () => {
    expect(clampCentreToPlan(-3, 20, plan)).toEqual({ x: 0, y: 8 });
  });
});
