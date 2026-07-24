import { render } from '@testing-library/react';
import FloorPlanScene from './FloorPlanScene';
import { floorPlanFixture } from './__fixtures__/floorPlanFixture';

/**
 * The mirroring guarantee (FLOOR-PLAN-REVAMP §4.0, acceptance criterion 1): a
 * table renders at the *identical* position, size and angle on the guest map and
 * in the admin editor, because both are the one `FloorPlanScene`. This is a
 * test, not a convention — it renders the same document the way each consumer
 * does and asserts the emitted geometry is byte-identical. Geometry must depend
 * only on the document: never on the skin, the render state, or interactivity.
 */

// Attributes that carry position / size / angle — never styling or state.
const GEOMETRY_ATTRS = [
  'viewBox',
  'transform',
  'd',
  'x',
  'y',
  'width',
  'height',
  'rx',
  'ry',
  'cx',
  'cy',
  'r',
  'x1',
  'y1',
  'x2',
  'y2',
  'points',
  'font-size',
];

/** Every element's tag + geometry attributes, in document order. */
function geometrySignature(root: SVGSVGElement): string[] {
  return Array.from(root.querySelectorAll('*')).map((el) => {
    const attrs = GEOMETRY_ATTRS.map((name) => `${name}=${el.getAttribute(name) ?? ''}`).join('|');
    return `${el.tagName}#${attrs}`;
  });
}

const sceneSvg = (container: HTMLElement): SVGSVGElement => {
  const svg = container.querySelector('svg');
  if (!svg) {
    throw new Error('no scene svg rendered');
  }
  return svg as unknown as SVGSVGElement;
};

describe('FloorPlanScene — admin ↔ guest mirroring', () => {
  const plan = floorPlanFixture();

  it('emits identical geometry for the guest map and the admin preview', () => {
    // Guest: interactive, a booked table, craft skin.
    const guest = render(
      <FloorPlanScene
        document={plan}
        skinClassName="craft-skin"
        tableStates={{ t2: 'booked' }}
        onSelectTable={jest.fn()}
        role="group"
      />,
    );
    // Admin preview: non-interactive, all available, classic skin.
    const admin = render(<FloorPlanScene document={plan} skinClassName="classic-skin" role="application" />);

    expect(geometrySignature(sceneSvg(guest.container))).toEqual(geometrySignature(sceneSvg(admin.container)));
  });

  it('is invariant to render state — state changes fills, not geometry', () => {
    const a = render(<FloorPlanScene document={plan} tableStates={{ t1: 'selected', t2: 'small' }} />);
    const b = render(<FloorPlanScene document={plan} tableStates={{ t1: 'dim', t2: 'available' }} />);
    expect(geometrySignature(sceneSvg(a.container))).toEqual(geometrySignature(sceneSvg(b.container)));
  });

  it('is invariant to the skin — the theme never moves a table', () => {
    const craft = render(<FloorPlanScene document={plan} skinClassName="craft-skin" />);
    const classic = render(<FloorPlanScene document={plan} skinClassName="classic-skin" />);
    expect(geometrySignature(sceneSvg(craft.container))).toEqual(geometrySignature(sceneSvg(classic.container)));
  });

  it('positions a rotated table by a centre translate plus a rotate about that centre', () => {
    const { container } = render(<FloorPlanScene document={plan} />);
    const rotated = container.querySelector('[data-table-id="t2"]');
    // Centre at (3.5m, 2.5m) → (350, 250) cm; the body rotates 30° about it.
    expect(rotated).toHaveAttribute('transform', 'translate(350.0 250.0)');
    expect(rotated?.querySelector('g')).toHaveAttribute('transform', 'rotate(30)');
  });
});
