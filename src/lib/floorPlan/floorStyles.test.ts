import { DEFAULT_FLOOR_STYLE, FLOOR_STYLES, isFloorStyle } from './floorStyles';

// The renderer's pattern table is the source of truth for what can be drawn; a
// style the picker offers but `RoomsLayer` cannot draw would silently fall back
// to wood and read as the picker being broken.
const RENDERED = ['wood', 'deck', 'tile', 'stone', 'carpet'];

describe('floorStyles', () => {
  it('offers only finishes the renderer can draw', () => {
    expect([...FLOOR_STYLES].sort()).toEqual([...RENDERED].sort());
  });

  it('defaults to a finish that is in the list', () => {
    expect(isFloorStyle(DEFAULT_FLOOR_STYLE)).toBe(true);
  });

  it('rejects an unknown or absent value, so an old plan keeps what it has', () => {
    expect(isFloorStyle('terrazzo')).toBe(false);
    expect(isFloorStyle(null)).toBe(false);
    expect(isFloorStyle(undefined)).toBe(false);
  });
});
