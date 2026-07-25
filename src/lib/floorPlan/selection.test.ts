import { idsInMarquee, marqueeBetween, pruneSelection, toggleSelection } from './selection';
import { documentMovables } from './movable';
import { planDocument, planItem, tableGeometry } from './__fixtures__/editorFixtures';

const at = (id: string, x: number, y: number, over = {}) => tableGeometry({ id, positionX: x, positionY: y, ...over });
/** The movables of a plan holding just these tables. */
const movablesOf = (tables: ReturnType<typeof at>[]) => documentMovables(planDocument(tables));

describe('selection — toggleSelection', () => {
  it('replaces the selection on a plain click', () => {
    expect(toggleSelection(['a', 'b'], 'c', false)).toEqual(['c']);
  });

  it('adds on a shift-click', () => {
    expect(toggleSelection(['a'], 'b', true)).toEqual(['a', 'b']);
  });

  it('removes an already-picked table on a shift-click', () => {
    expect(toggleSelection(['a', 'b', 'c'], 'b', true)).toEqual(['a', 'c']);
  });

  it('keeps the pick order, which align/distribute read as the group order', () => {
    expect(toggleSelection(toggleSelection(['c'], 'a', true), 'b', true)).toEqual(['c', 'a', 'b']);
  });

  it('re-selecting the only picked table is idempotent', () => {
    expect(toggleSelection(['a'], 'a', false)).toEqual(['a']);
  });
});

describe('selection — pruneSelection', () => {
  it('drops ids the document no longer has', () => {
    expect(pruneSelection(['a', 'gone', 'b'], planDocument([at('a', 1, 1), at('b', 2, 2)]))).toEqual(['a', 'b']);
  });

  it('leaves a fully-live selection alone', () => {
    expect(pruneSelection(['a'], planDocument([at('a', 1, 1)]))).toEqual(['a']);
  });

  it('keeps a selected ITEM alive — a save re-mints item ids, a stale one must go', () => {
    const doc = planDocument([], { items: [planItem({ id: 'i1' })] });
    expect(pruneSelection(['i1', 'local-item-9'], doc)).toEqual(['i1']);
  });
});

describe('selection — marqueeBetween', () => {
  it('normalises a band dragged up and to the left', () => {
    expect(marqueeBetween({ x: 5, y: 4 }, { x: 2, y: 1 })).toEqual({ x: 2, y: 1, width: 3, height: 3 });
  });

  it('is zero-sized for a click that never moved', () => {
    expect(marqueeBetween({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual({ x: 2, y: 2, width: 0, height: 0 });
  });
});

describe('selection — idsInMarquee', () => {
  const tables = movablesOf([at('a', 1, 1), at('b', 3, 1), at('c', 1, 5)]);

  it('picks every table the band touches', () => {
    expect(idsInMarquee(tables, { x: 0, y: 0, width: 4, height: 2 })).toEqual(['a', 'b']);
  });

  it('touches, rather than contains — a sweep across a row picks the row up', () => {
    // A thin band through the middle of both tables, swallowing neither.
    expect(idsInMarquee(tables, { x: 0, y: 0.9, width: 4, height: 0.2 })).toEqual(['a', 'b']);
  });

  it('picks nothing from a zero-area band, so a click never selects', () => {
    expect(idsInMarquee(tables, { x: 1, y: 1, width: 0, height: 0 })).toEqual([]);
  });

  it('accounts for rotation, so a turned table is caught by its real footprint', () => {
    const turned = movablesOf([at('r', 2, 2, { width: 2, height: 0.4, rotation: 90 })]);
    // A band on the rotated table's long axis, which is vertical once turned.
    expect(idsInMarquee(turned, { x: 1.8, y: 2.6, width: 0.4, height: 0.5 })).toEqual(['r']);
    // The same band where its UNROTATED footprint would have been: a miss.
    expect(idsInMarquee(turned, { x: 2.6, y: 1.8, width: 0.4, height: 0.5 })).toEqual([]);
  });

  it('sweeps up placed items as well as tables', () => {
    const mixed = documentMovables(planDocument([at('a', 1, 1)], { items: [planItem({ id: 'i1', x: 2, y: 1 })] }));
    expect(idsInMarquee(mixed, { x: 0, y: 0, width: 4, height: 2 })).toEqual(['a', 'i1']);
  });
});
