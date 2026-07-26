import { render } from '@testing-library/react';
import WallVertexHandles from './WallVertexHandles';
import { planWall } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import { MIDPOINT_ATTR, VERTEX_ATTR } from '@/hooks/floorPlan/useWallVertexDrag';
import type { FloorPlanWall } from '@/types/floorPlan';

const draw = (selectedVertex: number | null = null, wall: FloorPlanWall = planWall()) => {
  const { container } = render(
    <svg>
      <WallVertexHandles wall={wall} selectedVertex={selectedVertex} pxPerCm={1} />
    </svg>,
  );
  return container;
};

describe('WallVertexHandles', () => {
  it('draws a grip per corner and per side midpoint', () => {
    const c = draw();
    // The fixture room has four corners and, being closed, four sides.
    expect(c.querySelectorAll(`[${VERTEX_ATTR}]`)).toHaveLength(4);
    expect(c.querySelectorAll(`[${MIDPOINT_ATTR}]`)).toHaveLength(4);
  });

  it('tags each grip with the index the drag hook reads back', () => {
    const c = draw();
    const corner = c.querySelectorAll(`[${VERTEX_ATTR}]`)[1];
    // Corner 1 of the fixture is (5, 1) → 500, 100 in the scene's centimetres.
    expect(corner).toHaveAttribute(VERTEX_ATTR, '1');
    expect(corner).toHaveAttribute('cx', '500');
    expect(corner).toHaveAttribute('cy', '100');
  });

  it('puts the midpoint grip halfway along its side', () => {
    const c = draw();
    const mid = c.querySelectorAll(`[${MIDPOINT_ATTR}]`)[0];
    expect(mid).toHaveAttribute('cx', '300');
    expect(mid).toHaveAttribute('cy', '100');
  });

  // The hit areas are far larger than the drawn dots — a dot sized to look right
  // on a fitted plan is a few pixels wide, which no finger can hit.
  it('gives every grip a hit area bigger than the dot it covers', () => {
    const c = draw();
    const hit = Number(c.querySelector(`[${VERTEX_ATTR}]`)?.getAttribute('r'));
    const dots = [...c.querySelectorAll('circle')].filter(
      (el) => !el.hasAttribute(VERTEX_ATTR) && !el.hasAttribute(MIDPOINT_ATTR),
    );
    expect(hit).toBeGreaterThan(Math.max(...dots.map((el) => Number(el.getAttribute('r')))));
  });

  it('marks the picked corner differently from the rest', () => {
    const picked = draw(2);
    const classes = [...picked.querySelectorAll('circle')].map((el) => el.getAttribute('class'));
    expect(classes).toContain('vertexPicked');
    expect(classes.filter((c) => c === 'vertexPicked')).toHaveLength(1);
  });

  it('marks none when nothing is picked', () => {
    const none = draw(null);
    expect([...none.querySelectorAll('circle')].map((el) => el.getAttribute('class'))).not.toContain('vertexPicked');
  });
});
