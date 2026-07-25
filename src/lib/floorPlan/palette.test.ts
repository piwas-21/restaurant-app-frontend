import {
  MAX_PLAN_ITEMS,
  PALETTE_GROUPS,
  PALETTE_KINDS,
  canPlaceItem,
  defaultItemSize,
  duplicateItem,
  duplicateItems,
  isLocalItemId,
  newItem,
  nextLocalItemId,
  placeItem,
  paletteEntries,
} from './palette';
import { getSymbol } from './symbols';
import { planDocument, planItem, tableGeometry as table } from './__fixtures__/editorFixtures';

const plan = () => planDocument([table({ id: 't1' })]);

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

describe('palette — local ids', () => {
  it('starts at one on an empty plan', () => {
    expect(nextLocalItemId(plan())).toBe('local-item-1');
  });

  it('never reuses an id already in the document', () => {
    const doc = planDocument([], { items: [planItem({ id: 'local-item-1' }), planItem({ id: 'local-item-4' })] });
    expect(nextLocalItemId(doc)).toBe('local-item-5');
  });

  it('ignores server ids when picking the next local one', () => {
    const doc = planDocument([], { items: [planItem({ id: 'e3f1c2d4-0000-4000-8000-000000000001' })] });
    expect(nextLocalItemId(doc)).toBe('local-item-1');
  });

  it('recognises its own ids and no others', () => {
    expect(isLocalItemId('local-item-2')).toBe(true);
    expect(isLocalItemId('e3f1c2d4-0000-4000-8000-000000000001')).toBe(false);
  });
});

describe('palette — newItem', () => {
  it('centres the item on the click, snapped to the grid', () => {
    const item = newItem('column', { x: 4.06, y: 2.94 }, plan());
    expect([item.x, item.y]).toEqual([4, 3]);
  });

  it('honours a click exactly when snapping is off', () => {
    const item = newItem('column', { x: 4.06, y: 2.94 }, plan(), { snapEnabled: false });
    expect([item.x, item.y]).toEqual([4.06, 2.94]);
  });

  it('clamps a click outside the plan, like every other edit path', () => {
    const item = newItem('column', { x: -2, y: 99 }, plan());
    expect([item.x, item.y]).toEqual([0, 8]);
  });

  it('sizes from the symbol and stacks on top of what is already there', () => {
    const doc = planDocument([], { items: [planItem({ zIndex: 7 })] });
    const item = newItem('rug', { x: 5, y: 5 }, doc);
    expect(item.widthMeters).toBe(2.4);
    expect(item.zIndex).toBe(8);
  });

  it('never places a footprint bigger than the room', () => {
    const narrow = planDocument([], { widthMeters: 2, heightMeters: 2 });
    // A 3.6 m bar counter cannot fit a 2 m room; the server would clamp it anyway.
    expect(newItem('bar_counter', { x: 1, y: 1 }, narrow).widthMeters).toBe(2);
  });
});

describe('palette — placeItem', () => {
  it('adds the item and reports the id to select', () => {
    const placed = placeItem(plan(), 'column', { x: 4, y: 3 });
    expect(placed?.document.items).toHaveLength(1);
    expect(placed?.id).toBe('local-item-1');
  });

  it('refuses at the server item cap rather than letting Save fail', () => {
    const full = planDocument([], { items: Array.from({ length: MAX_PLAN_ITEMS }, () => planItem({ id: undefined })) });
    expect(canPlaceItem(full)).toBe(false);
    expect(placeItem(full, 'column', { x: 1, y: 1 })).toBeNull();
  });
});

describe('palette — duplicating', () => {
  it('offsets a copy by one grid unit so it is not hidden under the original', () => {
    const doc = planDocument([], { items: [planItem({ id: 'i1', x: 3, y: 3 })] });
    const copy = duplicateItem(doc.items[0], doc);
    expect([copy.x, copy.y]).toEqual([3.25, 3.25]);
    expect(copy.id).not.toBe('i1');
  });

  it('clamps a copy of something already against the plan edge', () => {
    const doc = planDocument([], { items: [planItem({ id: 'i1', x: 10, y: 8 })] });
    const copy = duplicateItem(doc.items[0], doc);
    expect([copy.x, copy.y]).toEqual([10, 8]);
  });

  it('gives every copy of a multi-selection its own id', () => {
    const doc = planDocument([], { items: [planItem({ id: 'i1' }), planItem({ id: 'i2', x: 5 })] });
    const result = duplicateItems(doc, ['i1', 'i2']);
    expect(result.document.items).toHaveLength(4);
    expect(new Set(result.ids).size).toBe(2);
  });

  it('duplicates only items — a table id in the selection is not copyable', () => {
    const doc = planDocument([table({ id: 't1' })], { items: [planItem({ id: 'i1' })] });
    const result = duplicateItems(doc, ['t1', 'i1']);
    expect(result.document.tables).toHaveLength(1);
    expect(result.ids).toHaveLength(1);
  });

  it('stops at the item cap part-way through a multi-selection', () => {
    const nearlyFull = planDocument([], {
      items: [
        planItem({ id: 'i1' }),
        planItem({ id: 'i2', x: 5 }),
        ...Array.from({ length: MAX_PLAN_ITEMS - 3 }, (_, n) => planItem({ id: `pad${n}` })),
      ],
    });
    const result = duplicateItems(nearlyFull, ['i1', 'i2']);
    expect(result.ids).toHaveLength(1);
    expect(result.document.items).toHaveLength(MAX_PLAN_ITEMS);
  });

  it('is a no-op for a selection with nothing duplicable in it', () => {
    const doc = plan();
    const result = duplicateItems(doc, ['t1']);
    expect(result.document).toBe(doc);
    expect(result.ids).toEqual([]);
  });
});
