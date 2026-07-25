import { clampViewBox, isZoomed, MIN_SPAN_CM, panViewBox, zoomViewBox } from './viewport';

const bounds = { x: 0, y: 0, w: 1000, h: 800 };

describe('floorPlan/viewport — clampViewBox', () => {
  it('never lets the viewBox exceed the fitted frame', () => {
    expect(clampViewBox({ x: -50, y: -50, w: 2000, h: 2000 }, bounds)).toEqual(bounds);
  });

  it('clamps a translated viewBox back inside the frame', () => {
    expect(clampViewBox({ x: 900, y: 700, w: 400, h: 300 }, bounds)).toEqual({ x: 600, y: 500, w: 400, h: 300 });
    expect(clampViewBox({ x: -100, y: -100, w: 400, h: 300 }, bounds)).toEqual({ x: 0, y: 0, w: 400, h: 300 });
  });
});

describe('floorPlan/viewport — zoomViewBox', () => {
  it('zooms in about a focal point, keeping it stationary', () => {
    const zoomed = zoomViewBox(bounds, 2, { x: 0, y: 0 }, bounds);
    expect(zoomed).toEqual({ x: 0, y: 0, w: 500, h: 400 });
  });

  it('will not zoom out past the fitted frame', () => {
    expect(zoomViewBox({ x: 200, y: 200, w: 500, h: 400 }, 0.1, { x: 400, y: 400 }, bounds)).toEqual(bounds);
  });

  it('will not zoom in past the minimum span', () => {
    const zoomed = zoomViewBox({ x: 0, y: 0, w: MIN_SPAN_CM, h: MIN_SPAN_CM * 0.8 }, 4, { x: 0, y: 0 }, bounds);
    expect(zoomed.w).toBe(MIN_SPAN_CM);
  });
});

describe('floorPlan/viewport — panViewBox', () => {
  it('translates the viewBox by the negated delta and clamps', () => {
    const vb = { x: 200, y: 200, w: 400, h: 300 };
    expect(panViewBox(vb, 50, 50, bounds)).toEqual({ x: 150, y: 150, w: 400, h: 300 });
    // A large pan is clamped to the frame edge.
    expect(panViewBox(vb, -1000, 0, bounds)).toEqual({ x: 600, y: 200, w: 400, h: 300 });
  });
});

describe('floorPlan/viewport — isZoomed', () => {
  it('is false at the fitted frame and true when zoomed in', () => {
    expect(isZoomed(bounds, bounds)).toBe(false);
    expect(isZoomed({ x: 0, y: 0, w: 500, h: 400 }, bounds)).toBe(true);
  });
});
