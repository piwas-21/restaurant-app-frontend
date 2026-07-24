import { getSymbol, SYMBOLS } from './symbols';
import { canopyPrim, potPlantPrims } from './symbolPrims';

// The item kinds the seeder writes (FloorPlanSeeder) that carry drawn geometry
// — `label`/`entrance` are handled by dedicated layers, so `label` is excluded.
const SEEDED_GEOMETRY_KINDS = [
  'bar_counter',
  'fireplace',
  'piano',
  'banquette',
  'sofa',
  'rug',
  'wc',
  'plant_large',
  'plant_small',
  'tree',
  'divider',
  'entrance',
];

describe('floorPlan/symbols', () => {
  it('resolves every seeded item kind to a non-empty symbol', () => {
    for (const kind of SEEDED_GEOMETRY_KINDS) {
      const def = getSymbol(kind);
      expect(def).not.toBeNull();
      expect(def?.w).toBeGreaterThan(0);
      expect(def?.h).toBeGreaterThan(0);
      expect(def?.prims.length).toBeGreaterThan(0);
    }
  });

  it('returns null for a kind with no drawn geometry (handled by another layer)', () => {
    expect(getSymbol('label')).toBeNull();
    expect(getSymbol('zone')).toBeNull();
    expect(getSymbol('nonsense')).toBeNull();
  });

  it('aliases the generic `plant` kind to the small potted plant', () => {
    expect(getSymbol('plant')?.prims).toHaveLength(getSymbol('plant_small')?.prims.length ?? -1);
  });

  it('every symbol primitive carries an ink variant', () => {
    for (const def of Object.values(SYMBOLS)) {
      for (const prim of def.prims) {
        expect(typeof prim.variant).toBe('string');
        expect(prim.tag).toMatch(/^(rect|line|path|circle|ellipse)$/);
      }
    }
  });
});

describe('floorPlan/symbolPrims generators', () => {
  it('canopyPrim returns a single closed path in the given variant', () => {
    const prim = canopyPrim(0, 0, 40, 8, -90, 'sceneryFill');
    expect(prim.tag).toBe('path');
    expect(prim.variant).toBe('sceneryFill');
    expect(prim.d?.startsWith('M')).toBe(true);
    expect(prim.d?.endsWith('Z')).toBe(true);
  });

  it('potPlantPrims returns a blade + vein per leaf plus the two-part pot', () => {
    const count = 5;
    const prims = potPlantPrims(31, 42, 26, 18, 30, count);
    expect(prims).toHaveLength(count * 2 + 2);
    expect(prims.every((p) => p.tag === 'path')).toBe(true);
  });
});
