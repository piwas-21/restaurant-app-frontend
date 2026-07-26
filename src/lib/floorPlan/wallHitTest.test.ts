import { distanceToSegment, findWall, wallAtPoint } from './wallHitTest';
import { wallSegments } from './walls';
import { planWall } from './__fixtures__/editorFixtures';

const segment = (from: { x: number; y: number }, to: { x: number; y: number }) =>
  wallSegments({ ...planWall(), points: [from, to], isClosed: false })[0];

describe('wallHitTest — distanceToSegment', () => {
  it('measures perpendicular distance to the segment body', () => {
    expect(distanceToSegment({ x: 2, y: 1.5 }, segment({ x: 0, y: 1 }, { x: 4, y: 1 }))).toBeCloseTo(0.5, 6);
  });

  it('clamps past the ends, so the run does not extend to infinity', () => {
    expect(distanceToSegment({ x: 6, y: 1 }, segment({ x: 0, y: 1 }, { x: 4, y: 1 }))).toBeCloseTo(2, 6);
  });

  it('handles a zero-length segment without dividing by zero', () => {
    expect(distanceToSegment({ x: 1, y: 1 }, segment({ x: 0, y: 0 }, { x: 0, y: 0 }))).toBeCloseTo(Math.SQRT2, 6);
  });
});

describe('wallHitTest — wallAtPoint', () => {
  const walls = [planWall()];

  it('picks the wall the pointer is on', () => {
    expect(wallAtPoint(walls, { x: 3, y: 1.05 }, 0.1)).toMatchObject({ wallId: 'w1', segmentIndex: 0 });
  });

  it('reports which segment was nearest, not just which wall', () => {
    expect(wallAtPoint(walls, { x: 4.98, y: 2.5 }, 0.1)?.segmentIndex).toBe(1);
  });

  it('adds half the wall thickness to the tolerance — a thick wall really is wider', () => {
    const thick = [planWall({ thicknessMeters: 0.6 })];
    expect(wallAtPoint(thick, { x: 3, y: 1.28 }, 0.01)).not.toBeNull();
    expect(wallAtPoint(walls, { x: 3, y: 1.28 }, 0.01)).toBeNull();
  });

  it('returns null when nothing is within reach', () => {
    expect(wallAtPoint(walls, { x: 3, y: 2.5 }, 0.1)).toBeNull();
  });

  it('skips a wall with no id — the selection is expressed in ids', () => {
    expect(wallAtPoint([planWall({ id: undefined })], { x: 3, y: 1 }, 0.1)).toBeNull();
  });

  it('closes the loop, so the segment back to the first vertex is pickable too', () => {
    expect(wallAtPoint(walls, { x: 1.02, y: 2.5 }, 0.1)?.segmentIndex).toBe(3);
  });
});

describe('wallHitTest — findWall', () => {
  it('resolves an id against the live walls, and null for anything else', () => {
    const walls = [planWall()];
    expect(findWall(walls, 'w1')).toBe(walls[0]);
    expect(findWall(walls, 'gone')).toBeNull();
    expect(findWall(walls, null)).toBeNull();
  });
});
