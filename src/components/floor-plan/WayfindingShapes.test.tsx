import { render } from '@testing-library/react';
import { EntranceMarker, TapeLabel, ZoneRegion } from './WayfindingShapes';
import { planItem } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import type { FloorPlanItem } from '@/types/floorPlan';

const styles = { zoneRegion: 'zoneRegion', flag: 'flag', tagText: 'tagText' };

const draw = (node: React.ReactNode) => render(<svg>{node}</svg>).container;

const zone = (over: Partial<FloorPlanItem> = {}) =>
  planItem({ kind: 'zone', x: 3, y: 2, widthMeters: 4, heightMeters: 2, ...over });

describe('WayfindingShapes — ZoneRegion', () => {
  it('draws the region at the item s footprint, in centimetres', () => {
    const c = draw(<ZoneRegion item={zone({ label: 'Lounge' })} styles={styles} />);
    const region = c.querySelector('.zoneRegion');
    expect(region).toHaveAttribute('x', '100');
    expect(region).toHaveAttribute('y', '100');
    expect(region).toHaveAttribute('width', '400');
  });

  it('tags it with its name', () => {
    const c = draw(<ZoneRegion item={zone({ label: 'Lounge' })} styles={styles} />);
    expect(c.querySelector('.tagText')?.textContent).toBe('Lounge');
  });

  // An unnamed region is a soft area with nothing to say — a tag box holding an
  // empty string would read as a rendering fault.
  it('draws no tag at all when it has no name', () => {
    const c = draw(<ZoneRegion item={zone({ label: null })} styles={styles} />);
    expect(c.querySelector('.tagText')).toBeNull();
    expect(c.querySelector('.flag')).toBeNull();
    expect(c.querySelector('.zoneRegion')).not.toBeNull();
  });
});

describe('WayfindingShapes — TapeLabel', () => {
  it('rotates with the item, so a label can run along a wall', () => {
    const c = draw(
      <TapeLabel
        item={planItem({
          kind: 'text_label',
          x: 2,
          y: 1,
          widthMeters: 1.2,
          heightMeters: 0.34,
          rotationDegrees: 45,
          label: 'Bar',
        })}
        styles={styles}
      />,
    );
    expect(c.querySelector('g')).toHaveAttribute('transform', 'translate(200 100) rotate(45)');
    expect(c.querySelector('.tagText')?.textContent).toBe('Bar');
  });

  it('renders empty rather than "null" when it has no text yet', () => {
    const c = draw(<TapeLabel item={planItem({ kind: 'text_label', label: null })} styles={styles} />);
    expect(c.querySelector('.tagText')?.textContent).toBe('');
  });
});

describe('WayfindingShapes — EntranceMarker', () => {
  // Only an arrow: the doorway itself is drawn by the wall opening, and letting
  // the marker draw its own leaf produced two doors in different places (§4.4).
  it('scales its authored arrow to the item s footprint and rotates it', () => {
    const c = draw(
      <EntranceMarker
        item={planItem({ kind: 'entrance', x: 3, y: 4, widthMeters: 0.9, heightMeters: 0.6, rotationDegrees: 90 })}
        styles={styles}
      />,
    );
    // The arrow is authored 90 × 60 cm, so a 0.9 × 0.6 m item scales it 1 : 1.
    expect(c.querySelector('g')).toHaveAttribute(
      'transform',
      'translate(300 400) rotate(90) scale(1.0000 1.0000) translate(-45 -30)',
    );
  });
});
