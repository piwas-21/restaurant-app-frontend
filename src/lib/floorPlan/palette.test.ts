import { PALETTE_GROUPS, PALETTE_KINDS, defaultItemSize, paletteEntries } from './palette';
import { getSymbol } from './symbols';

describe('palette — the catalogue', () => {
  it('offers only kinds the renderer can actually draw', () => {
    // A palette entry with no symbol would place an invisible object.
    expect(PALETTE_KINDS.every((kind) => getSymbol(kind) !== null)).toBe(true);
  });

  it('lists every kind exactly once across the groups', () => {
    expect(new Set(PALETTE_KINDS).size).toBe(PALETTE_KINDS.length);
  });

  it('leaves the text-carrying kinds to S8', () => {
    expect(PALETTE_KINDS).not.toContain('zone');
    expect(PALETTE_KINDS).not.toContain('text_label');
    expect(PALETTE_KINDS).not.toContain('entrance');
  });

  it('keeps wall-bound openings out — a door on a wall belongs to the wall tool', () => {
    const structure = PALETTE_GROUPS.find((g) => g.id === 'structure');
    expect(structure?.kinds).toContain('door_free');
    expect(structure?.kinds).not.toContain('door');
    expect(structure?.kinds).not.toContain('window');
  });
});

describe('palette — paletteEntries', () => {
  it('resolves each kind to its symbol and landing size', () => {
    const entries = paletteEntries({ id: 'structure', kinds: ['bar_counter'] });
    expect(entries).toEqual([
      { kind: 'bar_counter', symbol: getSymbol('bar_counter'), widthMeters: 3.6, heightMeters: 0.7 },
    ]);
  });

  it('does not offer a kind this renderer cannot draw', () => {
    expect(paletteEntries({ id: 'decor', kinds: ['not_a_kind'] })).toEqual([]);
  });

  it('covers every real group', () => {
    expect(PALETTE_GROUPS.flatMap(paletteEntries)).toHaveLength(PALETTE_KINDS.length);
  });
});

describe('palette — defaultItemSize', () => {
  it('derives the footprint from the symbol box, in metres', () => {
    // bar_counter is authored 360 × 70 cm.
    expect(defaultItemSize('bar_counter')).toEqual({ widthMeters: 3.6, heightMeters: 0.7 });
  });

  it('falls back to a grabbable square for a kind with no symbol', () => {
    expect(defaultItemSize('not_a_kind')).toEqual({ widthMeters: 1, heightMeters: 1 });
  });
});
