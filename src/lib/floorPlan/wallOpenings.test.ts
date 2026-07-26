import {
  DEFAULT_OPENING_WIDTH_M,
  MAX_WALL_OPENINGS,
  MIN_OPENING_WIDTH_M,
  addWallOpening,
  canAddOpening,
  fitOpening,
  longestSegmentIndex,
  removeWallOpening,
  updateWallOpening,
} from './wallOpenings';
import { planDocument, planWall } from './__fixtures__/editorFixtures';
import type { FloorPlanOpening, FloorPlanWall } from '@/types/floorPlan';

/** The fixture room: (1,1) → (5,1) → (5,4) → (1,4), closed. Sides 4, 3, 4, 3 m. */
const room = (openings: FloorPlanOpening[] = []): FloorPlanWall => planWall({ openings });
const doc = (wall: FloorPlanWall) => planDocument([], { walls: [wall] });

const opening = (over: Partial<FloorPlanOpening> = {}): FloorPlanOpening => ({
  id: 'o1',
  segmentIndex: 0,
  offsetMeters: 1,
  widthMeters: 1,
  kind: 'door',
  swingDirection: 'in',
  ...over,
});

describe('wallOpenings — fitOpening', () => {
  it('keeps an opening that already fits', () => {
    expect(fitOpening(4, 1, 0.9)).toEqual({ offsetMeters: 1, widthMeters: 0.9 });
  });

  it('caps the width at the side length, then the offset at what is left', () => {
    expect(fitOpening(2, 5, 6)).toEqual({ offsetMeters: 0, widthMeters: 2 });
  });

  it('pushes a too-far opening back onto the side', () => {
    expect(fitOpening(4, 3.8, 1)).toEqual({ offsetMeters: 3, widthMeters: 1 });
  });

  it('will not shrink below the narrowest opening worth drawing', () => {
    expect(fitOpening(4, 0, 0.01).widthMeters).toBe(MIN_OPENING_WIDTH_M);
  });
});

describe('wallOpenings — addWallOpening', () => {
  it('centres a new door on the named side, at its natural width', () => {
    const wall = room();
    const after = addWallOpening(doc(wall), wall, 0, 'door');
    expect(after.openings).toHaveLength(1);
    expect(after.openings[0]).toMatchObject({
      segmentIndex: 0,
      kind: 'door',
      widthMeters: DEFAULT_OPENING_WIDTH_M.door,
      swingDirection: 'in',
    });
    // A 4 m side, a 0.9 m door → (4 − 0.9) / 2.
    expect(after.openings[0].offsetMeters).toBeCloseTo(1.55, 6);
  });

  it('gives a window and a gap no swing — only a door has a leaf', () => {
    const wall = room();
    expect(addWallOpening(doc(wall), wall, 0, 'window').openings[0].swingDirection).toBe('none');
    expect(addWallOpening(doc(wall), wall, 0, 'opening').openings[0].swingDirection).toBe('none');
  });

  it('mints a local id that does not collide with one already on the plan', () => {
    const wall = room([opening({ id: 'local-opening-2' })]);
    expect(addWallOpening(doc(wall), wall, 1, 'door').openings[1].id).toBe('local-opening-3');
  });

  it('refuses a side the wall does not have', () => {
    const wall = room();
    expect(addWallOpening(doc(wall), wall, 9, 'door')).toBe(wall);
  });

  it('refuses once the wall is at the cap, rather than letting the save 400', () => {
    const full = room(Array.from({ length: MAX_WALL_OPENINGS }, (_, i) => opening({ id: `o${i}` })));
    expect(addWallOpening(doc(full), full, 0, 'door')).toBe(full);
    expect(canAddOpening(full)).toBe(false);
  });
});

describe('wallOpenings — updateWallOpening', () => {
  it('patches the named opening only', () => {
    const wall = room([opening(), opening({ id: 'o2', segmentIndex: 1 })]);
    const after = updateWallOpening(wall, 'o1', { offsetMeters: 2 });
    expect(after.openings[0].offsetMeters).toBe(2);
    expect(after.openings[1]).toEqual(wall.openings[1]);
  });

  it('re-fits an opening moved onto a shorter side, instead of leaving it hanging', () => {
    // Side 1 is 3 m; a 2.8 m-wide opening 2.5 m along would run past its end.
    const wall = room([opening({ offsetMeters: 2.5, widthMeters: 2.8 })]);
    const after = updateWallOpening(wall, 'o1', { segmentIndex: 1 });
    expect(after.openings[0]).toMatchObject({ segmentIndex: 1, widthMeters: 2.8 });
    expect(after.openings[0].offsetMeters).toBeCloseTo(0.2, 6);
  });

  it('carries the natural width of a new kind, so a window→door leaves no 1.2 m leaf', () => {
    const wall = room([opening({ kind: 'window', widthMeters: DEFAULT_OPENING_WIDTH_M.window })]);
    expect(updateWallOpening(wall, 'o1', { kind: 'door' }).openings[0].widthMeters).toBe(DEFAULT_OPENING_WIDTH_M.door);
  });

  it('honours an explicit width over the kind default', () => {
    const wall = room([opening({ kind: 'window' })]);
    expect(updateWallOpening(wall, 'o1', { kind: 'door', widthMeters: 1.5 }).openings[0].widthMeters).toBe(1.5);
  });

  it('returns the wall itself for an unknown id, so a no-op never enters the undo stack', () => {
    const wall = room([opening()]);
    expect(updateWallOpening(wall, 'nope', { offsetMeters: 2 })).toBe(wall);
  });

  it('leaves the opening alone when moved to a side that does not exist', () => {
    const wall = room([opening()]);
    expect(updateWallOpening(wall, 'o1', { segmentIndex: 9 }).openings[0]).toEqual(wall.openings[0]);
  });
});

describe('wallOpenings — removeWallOpening', () => {
  it('drops the named opening', () => {
    const wall = room([opening(), opening({ id: 'o2' })]);
    expect(removeWallOpening(wall, 'o1').openings.map((o) => o.id)).toEqual(['o2']);
  });
});

describe('wallOpenings — removeWallOpening identity', () => {
  it('returns the wall itself when it had no such opening', () => {
    const wall = room([opening()]);
    expect(removeWallOpening(wall, 'nope')).toBe(wall);
  });
});

describe('wallOpenings — longestSegmentIndex', () => {
  it('finds the side a new opening lands on by default', () => {
    // Sides 4, 3, 4, 3 — the first 4 m side wins the tie.
    expect(longestSegmentIndex(room())).toBe(0);
  });

  it('picks a later side when it is genuinely longer', () => {
    const wall = planWall({
      isClosed: false,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 9, y: 0 },
      ],
    });
    expect(longestSegmentIndex(wall)).toBe(1);
  });
});
