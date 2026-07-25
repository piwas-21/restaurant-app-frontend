import {
  MAX_PLAN_ITEMS,
  canPlaceItem,
  duplicateItem,
  duplicateItems,
  freeCentre,
  isLocalItemId,
  newItem,
  nextLocalItemId,
  placeItem,
} from './itemPlacement';
import { planDocument, planItem, tableGeometry as table } from './__fixtures__/editorFixtures';

const plan = () => planDocument([table({ id: 't1' })]);

describe('itemPlacement — local ids', () => {
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

describe('itemPlacement — newItem', () => {
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

describe('itemPlacement — placeItem', () => {
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

describe('itemPlacement — freeCentre', () => {
  it('returns the point unchanged when nothing sits there', () => {
    expect(freeCentre(plan(), { x: 5, y: 4 })).toEqual({ x: 5, y: 4 });
  });

  it('steps one grid unit past an occupied centre', () => {
    const doc = planDocument([], { items: [planItem({ x: 5, y: 4 })] });
    expect(freeCentre(doc, { x: 5, y: 4 })).toEqual({ x: 5.25, y: 4.25 });
  });

  it('keeps walking while the steps are also taken', () => {
    const doc = planDocument([], {
      items: [planItem({ id: 'a', x: 5, y: 4 }), planItem({ id: 'b', x: 5.25, y: 4.25 })],
    });
    expect(freeCentre(doc, { x: 5, y: 4 })).toEqual({ x: 5.5, y: 4.5 });
  });

  it('ignores an item that shares only one coordinate', () => {
    const doc = planDocument([], { items: [planItem({ x: 5, y: 7 })] });
    expect(freeCentre(doc, { x: 5, y: 4 })).toEqual({ x: 5, y: 4 });
  });

  it('settles at the plan corner rather than walking for ever', () => {
    // Every candidate from the corner onward is occupied, and the clamp pins them
    // all to the same point — the walk has to terminate anyway.
    const doc = planDocument([], { items: [planItem({ x: 10, y: 8 })] });
    expect(freeCentre(doc, { x: 10, y: 8 })).toEqual({ x: 10, y: 8 });
  });
});

describe('itemPlacement — duplicating', () => {
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
