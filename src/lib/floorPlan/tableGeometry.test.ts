import { tableParts } from './tableGeometry';

describe('floorPlan/tableGeometry', () => {
  it('draws a round top with one chair per seat, ringed outside the top', () => {
    const parts = tableParts('round', 4, 1, 1);
    expect(parts.top).toEqual({ kind: 'circle', r: 50 });
    expect(parts.chairs).toHaveLength(4);
    expect(parts.backs).toHaveLength(0);
    // Every chair centre sits on the same ring beyond the 50cm radius
    // (radius + gap + half the chair depth = 50 + 7 + 7.5 = 64.5cm).
    parts.chairs.forEach((c) => expect(Math.hypot(c.cx, c.cy)).toBeCloseTo(64.5, 6));
  });

  it('lays a square-4 top out one chair per side', () => {
    const parts = tableParts('square', 4, 0.92, 0.92);
    expect(parts.top.kind).toBe('rect');
    expect(parts.chairs).toHaveLength(4);
    // One chair centred on each of top/bottom/left/right — angles 0/180/90/270.
    expect(new Set(parts.chairs.map((c) => c.angle))).toEqual(new Set([0, 180, 90, 270]));
  });

  it('splits a rectangle across the two long sides', () => {
    const parts = tableParts('rectangle', 6, 1.65, 0.85);
    expect(parts.chairs).toHaveLength(6);
    const angles = parts.chairs.map((c) => c.angle);
    expect(angles.filter((a) => a === 0)).toHaveLength(3);
    expect(angles.filter((a) => a === 180)).toHaveLength(3);
  });

  it('gives a long 8-top a chair on each short end', () => {
    // aspect 2.3/0.95 ≈ 2.42 ≥ 2.2 and seats ≥ 8 → 1 chair per short end.
    const parts = tableParts('rectangle', 8, 2.3, 0.95);
    expect(parts.chairs).toHaveLength(8);
    const angles = parts.chairs.map((c) => c.angle);
    expect(angles.filter((a) => a === 90)).toHaveLength(1);
    expect(angles.filter((a) => a === 270)).toHaveLength(1);
    expect(angles.filter((a) => a === 0)).toHaveLength(3);
    expect(angles.filter((a) => a === 180)).toHaveLength(3);
  });

  it('draws a booth as a top with two bench backs and no ringed chairs', () => {
    const parts = tableParts('booth', 4, 1.25, 0.78);
    expect(parts.chairs).toHaveLength(0);
    expect(parts.backs).toHaveLength(2);
    expect(parts.top.kind).toBe('rect');
  });

  it('clamps a nonsensical seat count to at least one chair', () => {
    expect(tableParts('round', 0, 0.7, 0.7).chairs).toHaveLength(1);
    expect(tableParts('round', -3, 0.7, 0.7).chairs).toHaveLength(1);
  });

  it('scales the footprint from metres to centimetres', () => {
    const parts = tableParts('rectangle', 4, 2, 1);
    expect(parts.top).toMatchObject({ kind: 'rect', x: -100, y: -50, width: 200, height: 100 });
  });
});
