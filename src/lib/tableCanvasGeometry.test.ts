import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CANVAS_ASPECT_PADDING_PCT,
  DEFAULT_ENTRANCE_POSITION,
  TABLE_MARKER_WIDTH_PCT,
  TABLE_MARKER_HEIGHT_PCT,
  toPercentX,
  toPercentY,
  getTableMarkerStyle,
} from './tableCanvasGeometry';

describe('tableCanvasGeometry', () => {
  it('pins the backend-seeder canvas contract (600x500, 6:5)', () => {
    expect(CANVAS_WIDTH).toBe(600);
    expect(CANVAS_HEIGHT).toBe(500);
    // The padding-bottom aspect hack must reproduce exactly 5/6.
    expect(CANVAS_ASPECT_PADDING_PCT).toBeCloseTo(83.3333, 3);
  });

  it('converts canvas units to percentages against the right axis', () => {
    expect(toPercentX(300)).toBe(50);
    expect(toPercentY(250)).toBe(50);
    expect(toPercentX(0)).toBe(0);
    expect(toPercentY(500)).toBe(100);
  });

  it('marker size is a square in canvas units (72x72) despite the 6:5 canvas', () => {
    expect((TABLE_MARKER_WIDTH_PCT / 100) * CANVAS_WIDTH).toBeCloseTo(
      (TABLE_MARKER_HEIGHT_PCT / 100) * CANVAS_HEIGHT,
      10,
    );
  });

  it('getTableMarkerStyle positions and sizes in percent (centre-anchor comes from the marker CSS)', () => {
    expect(getTableMarkerStyle(300, 250)).toEqual({
      left: '50%',
      top: '50%',
      width: '12%',
      height: '14.4%',
    });
  });

  it('default entrance position is the documented {50,10} fallback', () => {
    expect(DEFAULT_ENTRANCE_POSITION).toEqual({ x: 50, y: 10 });
  });
});
