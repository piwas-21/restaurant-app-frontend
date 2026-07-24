import type { FloorPlanWall } from '@/types/floorPlan';
import { openingSpan, polygonAreaM2, roomLabelAnchor, roomPolygonPoints, wallSegments } from './walls';

const wall = (overrides: Partial<FloorPlanWall>): FloorPlanWall => ({
  points: [],
  thicknessMeters: 0.12,
  isClosed: false,
  zIndex: 0,
  openings: [],
  ...overrides,
});

describe('floorPlan/walls — wallSegments', () => {
  it('returns one segment for a two-point open run', () => {
    const segments = wallSegments(
      wall({
        points: [
          { x: 0, y: 0 },
          { x: 3, y: 4 },
        ],
      }),
    );
    expect(segments).toHaveLength(1);
    // .length here is the segment's geometric length (metres), not a collection.
    expect(segments[0].length).toBeCloseTo(5, 10);
    expect(segments[0].angleRad).toBeCloseTo(Math.atan2(4, 3), 10);
  });

  it('closes the loop for a closed chain (n vertices → n segments)', () => {
    const square = wall({
      isClosed: true,
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ],
    });
    const segments = wallSegments(square);
    expect(segments).toHaveLength(4);
    // The closing segment joins the last vertex back to the first.
    expect(segments[3].start).toEqual({ x: 0, y: 2 });
    expect(segments[3].end).toEqual({ x: 0, y: 0 });
  });

  it('returns no segments for a single point', () => {
    expect(wallSegments(wall({ points: [{ x: 1, y: 1 }] }))).toHaveLength(0);
  });
});

describe('floorPlan/walls — openingSpan', () => {
  const run = wall({
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
  });

  it('places an opening at its offset along the segment', () => {
    const span = openingSpan(run, {
      segmentIndex: 0,
      offsetMeters: 2,
      widthMeters: 1,
      kind: 'door',
      swingDirection: 'in',
    });
    expect(span).not.toBeNull();
    expect(span!.start).toEqual({ x: 2, y: 0 });
    expect(span!.end).toEqual({ x: 3, y: 0 });
  });

  it('clamps an over-running opening onto the segment', () => {
    const span = openingSpan(run, {
      segmentIndex: 0,
      offsetMeters: 20,
      widthMeters: 3,
      kind: 'window',
      swingDirection: 'none',
    });
    expect(span!.end.x).toBeCloseTo(10, 10);
    expect(span!.start.x).toBeCloseTo(7, 10);
  });

  it('returns null for a segment the wall does not have', () => {
    expect(
      openingSpan(run, { segmentIndex: 5, offsetMeters: 1, widthMeters: 1, kind: 'opening', swingDirection: 'none' }),
    ).toBeNull();
  });

  it('returns null for a zero-length segment (coincident vertices)', () => {
    const degenerate = wall({
      points: [
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ],
    });
    expect(
      openingSpan(degenerate, { segmentIndex: 0, offsetMeters: 0, widthMeters: 1, kind: 'door', swingDirection: 'in' }),
    ).toBeNull();
  });
});

describe('floorPlan/walls — rooms', () => {
  const room = wall({
    isClosed: true,
    roomName: 'Main room',
    points: [
      { x: 0.3, y: 0.3 },
      { x: 9.4, y: 0.3 },
      { x: 9.4, y: 8.7 },
      { x: 0.3, y: 8.7 },
    ],
  });

  it('exposes the polygon only for a closed wall', () => {
    expect(roomPolygonPoints(room)).toHaveLength(4);
    expect(
      roomPolygonPoints(
        wall({
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('computes the room area in square metres (shoelace)', () => {
    // 9.1 m × 8.4 m = 76.44 m².
    expect(polygonAreaM2(roomPolygonPoints(room))).toBeCloseTo(76.44, 6);
    expect(
      polygonAreaM2([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ]),
    ).toBe(1);
    // Fewer than three vertices has no area.
    expect(
      polygonAreaM2([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
    ).toBe(0);
  });

  it('anchors the room name inset from the top-left corner', () => {
    const anchor = roomLabelAnchor(room);
    expect(anchor!.x).toBeCloseTo(0.65, 10);
    expect(anchor!.y).toBeCloseTo(0.65, 10);
    expect(roomLabelAnchor(room, 0)).toEqual({ x: 0.3, y: 0.3 });
    expect(
      roomLabelAnchor(
        wall({
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        }),
      ),
    ).toBeNull();
  });
});
