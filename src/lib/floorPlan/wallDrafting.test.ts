import {
  DEFAULT_WALL_THICKNESS_M,
  draftReadout,
  draftWall,
  nearestPoint,
  snapDraftPoint,
  snapToAngleRay,
  wallVertices,
  type DraftSnapContext,
} from './wallDrafting';
import { planDocument, planWall } from './__fixtures__/editorFixtures';
import type { FloorPlanPoint } from '@/types/floorPlan';

const context = (over: Partial<DraftSnapContext> = {}): DraftSnapContext => ({
  points: [],
  otherVertices: [],
  gridSizeCm: 25,
  snapEnabled: true,
  suspendSnap: false,
  freeAngle: false,
  toleranceMeters: 0.2,
  ...over,
});

describe('wallDrafting — snapToAngleRay', () => {
  it('projects onto the nearest 45° ray and quantises the length to the grid', () => {
    const from: FloorPlanPoint = { x: 1, y: 1 };
    // 4° off horizontal and 2.06 m long → a flat run of 2.00 m.
    const snapped = snapToAngleRay(from, { x: 3.06, y: 1.14 }, 25, true);
    expect(snapped.x).toBeCloseTo(3, 5);
    expect(snapped.y).toBeCloseTo(1, 5);
  });

  it('keeps a 45° run exactly diagonal — the reason length, not x/y, is quantised', () => {
    const snapped = snapToAngleRay({ x: 0, y: 0 }, { x: 1.01, y: 0.99 }, 25, true);
    expect(snapped.x).toBeCloseTo(snapped.y, 9);
  });

  it('keeps the full reach when the length is not being quantised', () => {
    // The angle is snapped flat, so the whole distance lands on x — the run is
    // as long as the pointer reached, not as long as its x component was.
    const to = { x: 1.37, y: 0.02 };
    const snapped = snapToAngleRay({ x: 0, y: 0 }, to, 25, false);
    expect(snapped.y).toBeCloseTo(0, 9);
    expect(snapped.x).toBeCloseTo(Math.hypot(to.x, to.y), 9);
  });
});

describe('wallDrafting — nearestPoint', () => {
  it('returns the closest candidate inside the tolerance', () => {
    const found = nearestPoint(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      { x: 0.95, y: 1.02 },
      0.2,
    );
    expect(found).toEqual({ x: 1, y: 1 });
  });

  it('returns null when nothing is close enough', () => {
    expect(nearestPoint([{ x: 0, y: 0 }], { x: 2, y: 2 }, 0.2)).toBeNull();
  });
});

describe('wallDrafting — snapDraftPoint', () => {
  it('snaps a first vertex to the grid', () => {
    const snap = snapDraftPoint({ x: 1.06, y: 2.94 }, context());
    expect(snap).toEqual({ point: { x: 1, y: 3 }, kind: 'grid' });
  });

  it('closes the loop when the pointer returns to the first vertex', () => {
    const points = [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 3 },
    ];
    const snap = snapDraftPoint({ x: 1.05, y: 1.05 }, context({ points }));
    expect(snap.kind).toBe('close');
    expect(snap.point).toEqual({ x: 1, y: 1 });
  });

  it('will not close a two-vertex chain — that is a line drawn twice, not a room', () => {
    const points = [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
    ];
    expect(snapDraftPoint({ x: 1.02, y: 1.02 }, context({ points })).kind).not.toBe('close');
  });

  it('prefers another wall endpoint over the grid, so chains meet exactly', () => {
    const snap = snapDraftPoint({ x: 5.06, y: 3.98 }, context({ otherVertices: [{ x: 5.05, y: 4.02 }] }));
    expect(snap).toEqual({ point: { x: 5.05, y: 4.02 }, kind: 'endpoint' });
  });

  it('snaps to a 45° ray once there is a previous vertex', () => {
    const snap = snapDraftPoint({ x: 4.04, y: 1.11 }, context({ points: [{ x: 1, y: 1 }] }));
    expect(snap.kind).toBe('angle');
    expect(snap.point.y).toBeCloseTo(1, 5);
  });

  it('frees the angle with Shift, falling back to the grid', () => {
    const snap = snapDraftPoint({ x: 4.04, y: 1.11 }, context({ points: [{ x: 1, y: 1 }], freeAngle: true }));
    expect(snap).toEqual({ point: { x: 4, y: 1 }, kind: 'grid' });
  });

  it('returns the raw point when snapping is off, and when Alt suspends it', () => {
    const raw = { x: 1.234, y: 5.678 };
    expect(snapDraftPoint(raw, context({ snapEnabled: false }))).toEqual({ point: raw, kind: 'free' });
    expect(snapDraftPoint(raw, context({ suspendSnap: true }))).toEqual({ point: raw, kind: 'free' });
  });
});

describe('wallDrafting — draftReadout', () => {
  it('reports the metre length and the bearing clockwise from east', () => {
    expect(draftReadout({ x: 1, y: 1 }, { x: 4, y: 1 })).toEqual({ lengthMeters: 3, angleDegrees: 0 });
    expect(draftReadout({ x: 1, y: 1 }, { x: 1, y: 4 })).toEqual({ lengthMeters: 3, angleDegrees: 90 });
  });

  it('normalises a bearing into [0, 360)', () => {
    expect(draftReadout({ x: 1, y: 1 }, { x: 1, y: 0 }).angleDegrees).toBe(270);
  });
});

describe('wallDrafting — draftWall', () => {
  const doc = () => planDocument([], { walls: [planWall()] });

  it('builds an open run of two vertices', () => {
    const wall = draftWall(
      doc(),
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
      ],
      false,
    );
    expect(wall).toMatchObject({
      isClosed: false,
      roomName: null,
      floorStyle: null,
      thicknessMeters: DEFAULT_WALL_THICKNESS_M,
    });
    expect(wall?.points).toHaveLength(2);
  });

  it('mints a local id that does not collide with the walls already there', () => {
    const withLocal = planDocument([], { walls: [planWall({ id: 'local-wall-3' })] });
    expect(
      draftWall(
        withLocal,
        [
          { x: 1, y: 1 },
          { x: 3, y: 1 },
        ],
        false,
      )?.id,
    ).toBe('local-wall-4');
  });

  it('gives a closed chain a default floor, which is what makes it a room', () => {
    const wall = draftWall(
      doc(),
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 3 },
      ],
      true,
    );
    expect(wall).toMatchObject({ isClosed: true, floorStyle: 'wood' });
  });

  it('drops the closing click, which repeats the first vertex', () => {
    const wall = draftWall(
      doc(),
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 3 },
        { x: 1, y: 1 },
      ],
      true,
    );
    expect(wall?.points).toEqual([
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 3 },
    ]);
  });

  it('refuses a chain too short to be what it claims', () => {
    expect(draftWall(doc(), [{ x: 1, y: 1 }], false)).toBeNull();
    expect(
      draftWall(
        doc(),
        [
          { x: 1, y: 1 },
          { x: 3, y: 1 },
        ],
        true,
      ),
    ).toBeNull();
  });
});

describe('wallDrafting — wallVertices', () => {
  it('flattens every wall vertex into one list of snap candidates', () => {
    expect(wallVertices([planWall(), planWall({ id: 'w2', points: [{ x: 8, y: 8 }] })])).toHaveLength(5);
  });
});
