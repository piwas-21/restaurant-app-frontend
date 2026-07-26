import {
  canRemoveVertex,
  distanceAlong,
  insertWallVertex,
  moveWallVertex,
  removeWallVertex,
  segmentMidpoints,
} from './wallEditing';
import { wallSegments } from './walls';
import { planWall } from './__fixtures__/editorFixtures';
import type { FloorPlanOpening, FloorPlanWall } from '@/types/floorPlan';

/** An opening on `segmentIndex`, 1 m along and 1 m wide unless overridden. */
const opening = (over: Partial<FloorPlanOpening> = {}): FloorPlanOpening => ({
  id: 'o1',
  segmentIndex: 0,
  offsetMeters: 1,
  widthMeters: 1,
  kind: 'door',
  swingDirection: 'in',
  ...over,
});

/** The fixture room: (1,1) → (5,1) → (5,4) → (1,4), closed. Sides 4, 3, 4, 3 m. */
const room = (openings: FloorPlanOpening[] = []): FloorPlanWall => planWall({ openings });

const segmentsOf = (wall: FloorPlanWall) => wall.openings.map((o) => o.segmentIndex);

describe('wallEditing — distanceAlong', () => {
  it('projects a point onto the segment and reports how far along it is', () => {
    const segment = wallSegments(room())[0]; // (1,1) → (5,1)
    expect(distanceAlong(segment, { x: 3, y: 1.4 })).toBeCloseTo(2, 6);
  });

  it('reports zero for a zero-length side rather than dividing by it', () => {
    const degenerate = planWall({
      isClosed: false,
      points: [
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ],
    });
    expect(distanceAlong(wallSegments(degenerate)[0], { x: 5, y: 5 })).toBe(0);
  });

  it('clamps to the segment ends rather than running off it', () => {
    const segment = wallSegments(room())[0];
    expect(distanceAlong(segment, { x: 9, y: 1 })).toBeCloseTo(4, 6);
    expect(distanceAlong(segment, { x: -3, y: 1 })).toBe(0);
  });
});

describe('wallEditing — moveWallVertex', () => {
  it('moves one corner and leaves the rest, and the openings, alone', () => {
    const before = room([opening()]);
    const after = moveWallVertex(before, 1, { x: 6, y: 1.5 });
    expect(after.points[1]).toEqual({ x: 6, y: 1.5 });
    expect(after.points[0]).toEqual(before.points[0]);
    expect(after.openings).toEqual(before.openings);
  });

  it('ignores an index the wall does not have', () => {
    const before = room();
    expect(moveWallVertex(before, 9, { x: 0, y: 0 })).toBe(before);
  });
});

describe('wallEditing — insertWallVertex', () => {
  it('splits the named side, putting the new corner right after it', () => {
    const after = insertWallVertex(room(), 0, { x: 3, y: 1 });
    expect(after.points).toEqual([
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 4 },
      { x: 1, y: 4 },
    ]);
  });

  it('renumbers openings on the sides after the split', () => {
    const after = insertWallVertex(room([opening({ segmentIndex: 2 }), opening({ id: 'o2', segmentIndex: 0 })]), 1, {
      x: 5,
      y: 2.5,
    });
    expect(segmentsOf(after)).toEqual([3, 0]);
  });

  it('keeps an opening that lands entirely in the first half', () => {
    // Side 0 runs 0→4 m; the opening spans 0.5→1.5, the split is at 3 m.
    const after = insertWallVertex(room([opening({ offsetMeters: 0.5 })]), 0, { x: 4, y: 1 });
    expect(after.openings[0]).toMatchObject({ segmentIndex: 0, offsetMeters: 0.5 });
  });

  it('re-measures an opening that lands in the second half from that half s start', () => {
    // The opening spans 3.0→4.0 m; the split is at 2 m, so it becomes 1.0→2.0 on side 1.
    const after = insertWallVertex(room([opening({ offsetMeters: 3 })]), 0, { x: 3, y: 1 });
    expect(after.openings[0]).toMatchObject({ segmentIndex: 1, offsetMeters: 1 });
  });

  it('drops an opening the new corner would run through — a door cannot bend', () => {
    // The opening spans 1.0→2.0 m and the split lands at 1.5 m, inside it.
    const after = insertWallVertex(room([opening()]), 0, { x: 2.5, y: 1 });
    expect(after.openings).toEqual([]);
  });

  it('ignores a side the wall does not have', () => {
    const before = room();
    expect(insertWallVertex(before, 9, { x: 0, y: 0 })).toBe(before);
  });
});

describe('wallEditing — removeWallVertex', () => {
  it('removes the corner', () => {
    const after = removeWallVertex(room(), 1);
    expect(after.points).toEqual([
      { x: 1, y: 1 },
      { x: 5, y: 4 },
      { x: 1, y: 4 },
    ]);
  });

  it('drops the openings on the two sides that merged, and renumbers the rest', () => {
    const before = room([
      opening({ id: 'a', segmentIndex: 0 }), // merges away
      opening({ id: 'b', segmentIndex: 1 }), // merges away
      opening({ id: 'c', segmentIndex: 2 }), // survives, renumbered
    ]);
    const after = removeWallVertex(before, 1);
    expect(after.openings.map((o) => o.id)).toEqual(['c']);
    expect(after.openings[0].segmentIndex).toBe(1);
  });

  it('wraps to the closing side when corner 0 goes from a closed room', () => {
    const before = room([opening({ id: 'a', segmentIndex: 3 }), opening({ id: 'b', segmentIndex: 1 })]);
    const after = removeWallVertex(before, 0);
    // Side 3 is corner 0's predecessor on a closed chain, so it merges away too.
    expect(after.openings.map((o) => o.id)).toEqual(['b']);
  });

  it('refuses to take a room below three corners', () => {
    const triangle = planWall({
      points: [
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 4 },
      ],
    });
    expect(removeWallVertex(triangle, 0)).toBe(triangle);
    expect(canRemoveVertex(triangle)).toBe(false);
  });

  it('refuses to take an open run below two corners', () => {
    const run = planWall({
      isClosed: false,
      points: [
        { x: 1, y: 1 },
        { x: 4, y: 1 },
      ],
    });
    expect(removeWallVertex(run, 0)).toBe(run);
    expect(canRemoveVertex(run)).toBe(false);
  });

  it('allows it while there is room to spare', () => {
    expect(canRemoveVertex(room())).toBe(true);
  });
});

describe('wallEditing — segmentMidpoints', () => {
  it('offers one insert point per side, closing side included', () => {
    const mids = segmentMidpoints(room());
    expect(mids).toHaveLength(4);
    expect(mids[0]).toMatchObject({ segmentIndex: 0, point: { x: 3, y: 1 }, lengthMeters: 4 });
  });

  it('skips a zero-length side — there is nothing to insert into', () => {
    const degenerate = planWall({
      isClosed: false,
      points: [
        { x: 1, y: 1 },
        { x: 1, y: 1 },
        { x: 4, y: 1 },
      ],
    });
    expect(segmentMidpoints(degenerate).map((m) => m.segmentIndex)).toEqual([1]);
  });
});
