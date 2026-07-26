import {
  documentMovables,
  findMovable,
  geometrySnapshot,
  itemMovable,
  otherMovableRects,
  sameGeometry,
  selectedMovables,
  tableGeometryPatch,
  tableMovable,
} from './movable';
import { planDocument, planItem, tableGeometry as table } from './__fixtures__/editorFixtures';

describe('movable — normalising tables and items', () => {
  it('reads a table into the item vocabulary', () => {
    expect(
      tableMovable(table({ id: 't1', positionX: 2, positionY: 3, width: 1.2, height: 0.8, rotation: 45 })),
    ).toEqual({ id: 't1', target: 'table', x: 2, y: 3, widthMeters: 1.2, heightMeters: 0.8, rotationDegrees: 45 });
  });

  it('reads an item straight through', () => {
    expect(itemMovable(planItem({ id: 'i9', x: 4, y: 5 }))).toEqual({
      id: 'i9',
      target: 'item',
      x: 4,
      y: 5,
      widthMeters: 1,
      heightMeters: 1,
      rotationDegrees: 0,
    });
  });

  it('treats an item with no id as not movable rather than inventing one', () => {
    expect(itemMovable(planItem({ id: undefined }))).toBeNull();
  });

  // S8 gave the inspector a text field for what these carry, which is the whole
  // reason they were held back from being movable until then.
  it.each(['zone', 'label', 'text_label', 'entrance'])('moves a %s like any other object', (kind) => {
    expect(itemMovable(planItem({ kind }))).toMatchObject({ id: 'i1', target: 'item' });
  });

  it('refuses a kind the renderer has no geometry for', () => {
    expect(itemMovable(planItem({ kind: 'not_a_kind' }))).toBeNull();
  });

  it('lists tables before items and skips the id-less', () => {
    const doc = planDocument([table({ id: 't1' })], {
      items: [planItem({ id: 'i1' }), planItem({ id: undefined }), planItem({ id: 'i2' })],
    });
    expect(documentMovables(doc).map((m) => m.id)).toEqual(['t1', 'i1', 'i2']);
  });

  it('finds either kind by id, and nothing for an unknown one', () => {
    const doc = planDocument([table({ id: 't1' })], { items: [planItem({ id: 'i1' })] });
    expect(findMovable(doc, 't1')?.target).toBe('table');
    expect(findMovable(doc, 'i1')?.target).toBe('item');
    expect(findMovable(doc, 'nope')).toBeNull();
  });

  it('selects in document order, ignoring ids that have gone', () => {
    const doc = planDocument([table({ id: 't1' })], { items: [planItem({ id: 'i1' })] });
    expect(selectedMovables(doc, ['i1', 'ghost', 't1']).map((m) => m.id)).toEqual(['t1', 'i1']);
  });

  it('offers every OTHER footprint as an alignment target — items included', () => {
    const doc = planDocument([table({ id: 't1', positionX: 1 }), table({ id: 't2', positionX: 5 })], {
      items: [planItem({ id: 'i1', x: 9 })],
    });
    expect(otherMovableRects(doc, 't2').map((m) => m.x)).toEqual([1, 9]);
  });
});

describe('movable — geometry snapshots', () => {
  it('keeps only the geometry a gesture can change', () => {
    expect(geometrySnapshot(tableMovable(table({ id: 'a', tableNumber: '9', maxGuests: 8, rotation: 45 })))).toEqual({
      x: 1,
      y: 1,
      widthMeters: 1,
      heightMeters: 1,
      rotationDegrees: 45,
    });
  });

  it('treats a table whose metadata changed as geometrically unchanged', () => {
    const before = geometrySnapshot(tableMovable(table({ tableNumber: '1' })));
    const after = geometrySnapshot(tableMovable(table({ tableNumber: '2', maxGuests: 12 })));
    expect(sameGeometry(before, after)).toBe(true);
  });

  it.each(['x', 'y', 'widthMeters', 'heightMeters', 'rotationDegrees'] as const)('notices a changed %s', (field) => {
    const before = geometrySnapshot(itemMovable(planItem())!);
    const after = geometrySnapshot({ ...itemMovable(planItem())!, [field]: 4 });
    expect(sameGeometry(before, after)).toBe(false);
  });
});

describe('movable — tableGeometryPatch', () => {
  it('translates every normalised key into the table column names', () => {
    expect(tableGeometryPatch({ x: 1, y: 2, widthMeters: 3, heightMeters: 4, rotationDegrees: 5 })).toEqual({
      positionX: 1,
      positionY: 2,
      width: 3,
      height: 4,
      rotation: 5,
    });
  });

  it('translates a partial patch without inventing the keys it was not given', () => {
    // A move must not write width/height: the drag hook compares the whole
    // snapshot afterwards, and an undefined size would read as a real change.
    expect(tableGeometryPatch({ x: 1 })).toEqual({ positionX: 1 });
  });

  it('keeps an explicit zero rather than dropping it as falsy', () => {
    expect(tableGeometryPatch({ rotationDegrees: 0 })).toEqual({ rotation: 0 });
  });
});
