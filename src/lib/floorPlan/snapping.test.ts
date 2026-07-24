import { alignmentSnap, rotationStep, snapAngle, snapToGrid, type SnapRect } from './snapping';

describe('floorPlan/snapping — snapToGrid', () => {
  it('rounds a metre value to the grid step', () => {
    expect(snapToGrid(1.13, 25)).toBeCloseTo(1.25, 10); // 25cm grid
    expect(snapToGrid(1.12, 25)).toBeCloseTo(1.0, 10);
    expect(snapToGrid(0.44, 10)).toBeCloseTo(0.4, 10);
  });

  it('is a no-op when disabled or the grid is degenerate', () => {
    expect(snapToGrid(1.13, 25, false)).toBe(1.13);
    expect(snapToGrid(1.13, 0)).toBe(1.13);
  });
});

describe('floorPlan/snapping — alignmentSnap', () => {
  const target: SnapRect = { x: 2.03, y: 3, widthMeters: 1, heightMeters: 1 };

  it('snaps a centre onto an aligned neighbour and reports an x guide', () => {
    const other: SnapRect = { x: 2, y: 5, widthMeters: 1, heightMeters: 1 };
    const result = alignmentSnap(target, [other], 0.05);
    expect(result.x).toBeCloseTo(2, 10);
    expect(result.guides.some((g) => g.axis === 'x')).toBe(true);
    // y is 2m from the other's centre — no y snap.
    expect(result.guides.every((g) => g.axis !== 'y')).toBe(true);
  });

  it('snaps an edge to another edge', () => {
    // target left edge = 1.53; other right edge = 1.5 → snaps left edge to 1.5.
    const other: SnapRect = { x: 1, y: 3, widthMeters: 1, heightMeters: 1 };
    const result = alignmentSnap(target, [other], 0.05);
    expect(result.x).toBeCloseTo(2, 10); // centre moves so left edge hits 1.5
  });

  it('does not snap outside the tolerance', () => {
    const other: SnapRect = { x: 2.5, y: 5, widthMeters: 1, heightMeters: 1 };
    const result = alignmentSnap(target, [other], 0.02);
    expect(result.x).toBe(2.03);
    expect(result.guides).toHaveLength(0);
  });

  it('picks the closest candidate when several are in range', () => {
    const near: SnapRect = { x: 2.02, y: 3, widthMeters: 1, heightMeters: 1 };
    const far: SnapRect = { x: 2.05, y: 3, widthMeters: 1, heightMeters: 1 };
    const result = alignmentSnap(target, [far, near], 0.1);
    expect(result.x).toBeCloseTo(2.02, 10);
  });
});

describe('floorPlan/snapping — rotation', () => {
  it('chooses the step from the modifiers', () => {
    expect(rotationStep({})).toBe(15);
    expect(rotationStep({ shift: true })).toBe(1);
    expect(rotationStep({ alt: true })).toBe(90);
    expect(rotationStep({ shift: true, alt: true })).toBe(90); // alt wins
  });

  it('snaps an angle to the step and normalises to [0, 360)', () => {
    expect(snapAngle(52, 15)).toBe(45);
    expect(snapAngle(-10, 15)).toBe(345);
    expect(snapAngle(358, 90)).toBe(0);
    expect(snapAngle(44, 0)).toBe(44); // degenerate step → 1°
  });
});
