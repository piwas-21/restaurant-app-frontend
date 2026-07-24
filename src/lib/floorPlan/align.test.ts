import { alignTables, distributeTables, type AlignEdge } from './align';
import { planDocument, tableGeometry } from './__fixtures__/editorFixtures';
import type { FloorPlanDocument } from '@/types/floorPlan';

const at = (id: string, x: number, y: number, over = {}) => tableGeometry({ id, positionX: x, positionY: y, ...over });

/** Centres on one axis, in the document's own order. */
const xs = (doc: FloorPlanDocument) => doc.tables.map((t) => Number(t.positionX.toFixed(6)));
const ys = (doc: FloorPlanDocument) => doc.tables.map((t) => Number(t.positionY.toFixed(6)));

describe('align — alignTables', () => {
  // Three 1m tables plus one 2m-wide one, so half-widths actually matter.
  const plan = planDocument([at('a', 1, 1), at('b', 4, 3), at('c', 7, 6, { width: 2 })]);
  const all = ['a', 'b', 'c'];

  it('lines the left edges up on the leftmost edge', () => {
    // Edges are 0.5, 3.5 and 6 → target 0.5, so each centre is 0.5 + its half.
    expect(xs(alignTables(plan, all, 'left'))).toEqual([1, 1, 1.5]);
  });

  it('lines the right edges up on the rightmost edge', () => {
    // Edges are 1.5, 4.5 and 8 → target 8.
    expect(xs(alignTables(plan, all, 'right'))).toEqual([7.5, 7.5, 7]);
  });

  it('centres everything on the middle of the group bounding box', () => {
    // Box spans 0.5 … 8, so every centre lands on 4.25 regardless of width.
    expect(xs(alignTables(plan, all, 'centerX'))).toEqual([4.25, 4.25, 4.25]);
  });

  it('aligns on the other axis without touching the first', () => {
    const next = alignTables(plan, all, 'top');
    expect(ys(next)).toEqual([1, 1, 1]);
    expect(xs(next)).toEqual([1, 4, 7]);
  });

  it.each(['left', 'centerX', 'right', 'top', 'middleY', 'bottom'] as AlignEdge[])(
    'leaves unselected tables alone when aligning %s',
    (edge) => {
      const next = alignTables(plan, ['a', 'b'], edge);
      expect(next.tables[2]).toEqual(plan.tables[2]);
    },
  );

  it('is a no-op for fewer than two tables', () => {
    expect(alignTables(plan, ['a'], 'left')).toBe(plan);
    expect(alignTables(plan, [], 'left')).toBe(plan);
  });

  it('ignores ids the document no longer holds', () => {
    expect(xs(alignTables(plan, ['a', 'b', 'ghost'], 'left'))).toEqual([1, 1, 7]);
  });
});

describe('align — distributeTables', () => {
  it('spaces the middles evenly, holding the outermost tables', () => {
    const plan = planDocument([at('a', 1, 2), at('b', 2, 2), at('c', 9, 2)]);
    expect(xs(distributeTables(plan, ['a', 'b', 'c'], 'x'))).toEqual([1, 5, 9]);
  });

  it('works from any pick order, because it sorts by position first', () => {
    const plan = planDocument([at('a', 1, 2), at('b', 2, 2), at('c', 9, 2)]);
    expect(xs(distributeTables(plan, ['c', 'a', 'b'], 'x'))).toEqual([1, 5, 9]);
  });

  it('spaces down the other axis too', () => {
    const plan = planDocument([at('a', 2, 1), at('b', 2, 2), at('c', 2, 7)]);
    expect(ys(distributeTables(plan, ['a', 'b', 'c'], 'y'))).toEqual([1, 4, 7]);
  });

  it('is a no-op below three tables — two have nothing between them', () => {
    const plan = planDocument([at('a', 1, 2), at('b', 9, 2)]);
    expect(distributeTables(plan, ['a', 'b'], 'x')).toBe(plan);
  });

  it('leaves unselected tables where they are', () => {
    const plan = planDocument([at('a', 1, 2), at('b', 2, 2), at('c', 9, 2), at('d', 4, 6)]);
    expect(distributeTables(plan, ['a', 'b', 'c'], 'x').tables[3]).toEqual(plan.tables[3]);
  });
});
