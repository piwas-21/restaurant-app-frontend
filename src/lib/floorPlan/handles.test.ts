import type { OrientedRect } from './geometry';
import { RESIZE_HANDLES, angleFromPointer, handlePoint, resizeHandle, resizeRect, rotateHandlePoint } from './handles';
import { anchorOf as anchor } from './__fixtures__/editorFixtures';

const rect = (over: Partial<OrientedRect> = {}): OrientedRect => ({
  x: over.x ?? 4,
  y: over.y ?? 3,
  widthMeters: over.widthMeters ?? 2,
  heightMeters: over.heightMeters ?? 1,
  rotationDegrees: over.rotationDegrees ?? 0,
});

const close = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 6);

describe('handles — anchors', () => {
  it('exposes eight grips, one per corner and edge', () => {
    expect(RESIZE_HANDLES).toHaveLength(8);
    expect(new Set(RESIZE_HANDLES.map((h) => h.id)).size).toBe(8);
  });

  it('looks a grip up by its data-handle token', () => {
    expect(resizeHandle('se')).toEqual({ id: 'se', sx: 1, sy: 1 });
  });

  it('returns null for the rotate token, an unknown token and undefined', () => {
    expect(resizeHandle('rotate')).toBeNull();
    expect(resizeHandle('nope')).toBeNull();
    expect(resizeHandle(undefined)).toBeNull();
  });
});

describe('handles — positions', () => {
  it('puts each grip on its own corner of an unrotated rect', () => {
    const r = rect();
    expect(handlePoint(r, anchor('nw'))).toEqual({ x: 3, y: 2.5 });
    expect(handlePoint(r, anchor('se'))).toEqual({ x: 5, y: 3.5 });
    expect(handlePoint(r, anchor('n'))).toEqual({ x: 4, y: 2.5 });
    expect(handlePoint(r, anchor('e'))).toEqual({ x: 5, y: 3 });
  });

  it('carries the grips around with the rect when it is rotated', () => {
    // A quarter turn swaps the axes: the "north" grip now sits due east.
    const p = handlePoint(rect({ rotationDegrees: 90 }), anchor('n'));
    close(p.x, 4.5);
    close(p.y, 3);
  });

  it('floats the rotate grip above the top edge, on the rect axis', () => {
    const p = rotateHandlePoint(rect(), 0.4);
    expect(p).toEqual({ x: 4, y: 2.1 });
  });

  it('swings the rotate grip round with the rect', () => {
    const p = rotateHandlePoint(rect({ rotationDegrees: 180 }), 0.4);
    close(p.x, 4);
    close(p.y, 3.9);
  });
});

describe('handles — angleFromPointer', () => {
  const centre = { x: 0, y: 0 };

  it('reads straight up as 0°, matching the grip at rest', () => {
    expect(angleFromPointer(centre, { x: 0, y: -1 })).toBe(0);
  });

  it('reads a quarter and a half turn clockwise', () => {
    expect(angleFromPointer(centre, { x: 1, y: 0 })).toBe(90);
    expect(angleFromPointer(centre, { x: 0, y: 1 })).toBe(180);
  });

  it('normalises anti-clockwise angles into [0, 360)', () => {
    expect(angleFromPointer(centre, { x: -1, y: 0 })).toBe(270);
  });
});

describe('handles — resizeRect', () => {
  const options = { minSizeMeters: 0.3 };

  it('pins the opposite corner and moves the grabbed one to the pointer', () => {
    const result = resizeRect(rect(), anchor('se'), { x: 7, y: 5 }, options);
    expect(result).toEqual({ x: 5, y: 3.75, widthMeters: 4, heightMeters: 2.5 });
    // The pinned north-west corner is exactly where it started.
    const nw = handlePoint({ ...result, rotationDegrees: 0 }, anchor('nw'));
    expect(nw).toEqual({ x: 3, y: 2.5 });
  });

  it('changes one axis only for an edge grip', () => {
    const result = resizeRect(rect(), anchor('e'), { x: 6, y: 99 }, options);
    expect(result.widthMeters).toBe(3);
    expect(result.heightMeters).toBe(1);
    expect(result.y).toBe(3);
  });

  it('measures along the rect own axes when it is rotated', () => {
    // Turned 90°, pulling the "east" grip due south lengthens its width.
    const result = resizeRect(rect({ rotationDegrees: 90 }), anchor('e'), { x: 4, y: 5 }, options);
    close(result.widthMeters, 3);
    close(result.heightMeters, 1);
  });

  it('stops at the minimum instead of inverting when dragged past the pinned edge', () => {
    const result = resizeRect(rect(), anchor('e'), { x: 0, y: 3 }, options);
    expect(result.widthMeters).toBe(0.3);
    // Still pinned on the west edge, so it shrank rather than flipped.
    close(result.x - result.widthMeters / 2, 3);
  });

  it('rounds the new extent to the grid step when one is given', () => {
    const result = resizeRect(rect(), anchor('e'), { x: 6.13, y: 3 }, { ...options, snapStepMeters: 0.25 });
    close(result.widthMeters, 3.25);
  });

  it('keeps the minimum even when the grid step would round below it', () => {
    const result = resizeRect(rect(), anchor('e'), { x: 3.01, y: 3 }, { ...options, snapStepMeters: 0.25 });
    expect(result.widthMeters).toBe(0.3);
  });

  it('stops at the per-axis ceiling, so the canvas never shows a size Save would shrink', () => {
    const bounded = { ...options, maxWidthMeters: 6, maxHeightMeters: 4 };
    const result = resizeRect(rect(), anchor('se'), { x: 60, y: 40 }, bounded);
    expect(result.widthMeters).toBe(6);
    expect(result.heightMeters).toBe(4);
  });

  it('keeps the opposite corner pinned at the ceiling rather than drifting', () => {
    const bounded = { ...options, maxWidthMeters: 6, maxHeightMeters: 4 };
    const result = resizeRect(rect(), anchor('se'), { x: 60, y: 40 }, bounded);
    expect(handlePoint({ ...result, rotationDegrees: 0 }, anchor('nw'))).toEqual({ x: 3, y: 2.5 });
  });
});
