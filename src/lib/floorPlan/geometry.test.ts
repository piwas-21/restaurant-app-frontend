import {
  cmToMetres,
  computeViewBox,
  metresToCm,
  obbOverlap,
  rectCorners,
  screenToPlanCm,
  screenToPlanMetres,
  type OrientedRect,
} from './geometry';

describe('floorPlan/geometry — units', () => {
  it('converts metres ↔ centimetres', () => {
    expect(metresToCm(12)).toBe(1200);
    expect(metresToCm(0.7)).toBe(70);
    expect(cmToMetres(1200)).toBe(12);
    expect(cmToMetres(70)).toBeCloseTo(0.7, 10);
  });
});

describe('floorPlan/geometry — computeViewBox', () => {
  it('rings the room in cm with the default 20cm padding', () => {
    expect(computeViewBox(12, 8)).toEqual({ x: -20, y: -20, w: 1240, h: 840 });
  });

  it('honours a custom padding', () => {
    expect(computeViewBox(14, 9, 10)).toEqual({ x: -10, y: -10, w: 1420, h: 920 });
  });
});

describe('floorPlan/geometry — screenToPlan', () => {
  const viewBox = { x: 0, y: 0, w: 1200, h: 800 };
  const rect = { left: 0, top: 0, width: 600, height: 400 };

  it('maps a screen pixel to plan centimetres', () => {
    expect(screenToPlanCm(300, 200, viewBox, rect)).toEqual({ x: 600, y: 400 });
    expect(screenToPlanCm(0, 0, viewBox, rect)).toEqual({ x: 0, y: 0 });
    expect(screenToPlanCm(600, 400, viewBox, rect)).toEqual({ x: 1200, y: 800 });
  });

  it('accounts for the rect offset and returns metres', () => {
    const offsetRect = { left: 100, top: 50, width: 600, height: 400 };
    expect(screenToPlanMetres(400, 250, viewBox, offsetRect)).toEqual({ x: 6, y: 4 });
  });

  it('inverts xMidYMid meet for a letterboxed (mismatched-aspect) container', () => {
    // A 2:1 viewBox in a square container → uniform 0.5 scale, 125px bars
    // top and bottom. A click on the content's top edge is the room's y=0,
    // not (naive per-axis) y=125.
    const wide = { x: 0, y: 0, w: 1000, h: 500 };
    const square = { left: 0, top: 0, width: 500, height: 500 };
    expect(screenToPlanCm(250, 125, wide, square)).toEqual({ x: 500, y: 0 });
    expect(screenToPlanCm(250, 250, wide, square)).toEqual({ x: 500, y: 250 });
    expect(screenToPlanCm(250, 375, wide, square)).toEqual({ x: 500, y: 500 });
  });

  it('returns the viewBox origin for a degenerate rect (no NaN)', () => {
    expect(screenToPlanCm(300, 200, viewBox, { left: 0, top: 0, width: 0, height: 400 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('floorPlan/geometry — rectCorners', () => {
  it('returns the axis-aligned corners clockwise from top-left', () => {
    const corners = rectCorners({ x: 5, y: 5, widthMeters: 2, heightMeters: 1, rotationDegrees: 0 });
    expect(corners).toEqual([
      { x: 4, y: 4.5 },
      { x: 6, y: 4.5 },
      { x: 6, y: 5.5 },
      { x: 4, y: 5.5 },
    ]);
  });

  it('rotates about the centre', () => {
    const [topLeft] = rectCorners({
      x: 0,
      y: 0,
      widthMeters: 2,
      heightMeters: 2,
      rotationDegrees: 90,
    });
    // (-1,-1) rotated 90° about the origin → (1,-1).
    expect(topLeft.x).toBeCloseTo(1, 10);
    expect(topLeft.y).toBeCloseTo(-1, 10);
  });
});

describe('floorPlan/geometry — obbOverlap', () => {
  const base: OrientedRect = { x: 0, y: 0, widthMeters: 2, heightMeters: 2, rotationDegrees: 0 };

  it('detects overlapping axis-aligned rectangles', () => {
    expect(obbOverlap(base, { ...base, x: 1, y: 1 })).toBe(true);
  });

  it('rejects fully separated rectangles', () => {
    expect(obbOverlap(base, { ...base, x: 5 })).toBe(false);
  });

  it('treats edge-touching rectangles as not overlapping', () => {
    // Centres 2m apart, each 2m wide → they share an edge exactly.
    expect(obbOverlap(base, { ...base, x: 2 })).toBe(false);
  });

  it('detects overlap between a rotated and an axis-aligned rectangle', () => {
    const diamond: OrientedRect = { x: 2.2, y: 0, widthMeters: 2, heightMeters: 2, rotationDegrees: 45 };
    // A 45° square reaches ~1.414m from its centre, so at x=2.2 its left tip
    // (~0.79) pierces the base's right edge (1.0).
    expect(obbOverlap(base, diamond)).toBe(true);
  });

  it('separates on a rotated rect’s own axis when both base axes overlap', () => {
    // A 45° square at (2,2) overlaps the base on BOTH x and y (each spans
    // ~0.59..3.41), so only the diamond's own 45° normal reveals the gap —
    // the case that proves the SAT test includes the rotated rect's axes.
    const diamond: OrientedRect = { x: 2, y: 2, widthMeters: 2, heightMeters: 2, rotationDegrees: 45 };
    expect(obbOverlap(base, diamond)).toBe(false);
  });
});
