import { render, screen, fireEvent } from '@testing-library/react';
import FloorPlanScene from './FloorPlanScene';
import { floorPlanFixture } from './__fixtures__/floorPlanFixture';

describe('FloorPlanScene', () => {
  it('renders one SVG in a centimetre viewBox that fits the room', () => {
    const { container } = render(<FloorPlanScene document={floorPlanFixture()} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(1);
    // 6m × 5m → 600 × 500 cm, ringed by the 20cm padding → -20 -20 640 540.
    expect(svgs[0]).toHaveAttribute('viewBox', '-20 -20 640 540');
    expect(svgs[0]).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
  });

  it('draws every table with its number and a default available state', () => {
    const { container } = render(<FloorPlanScene document={floorPlanFixture()} />);
    const tables = container.querySelectorAll('[data-table-id]');
    expect(tables).toHaveLength(2);
    tables.forEach((t) => expect(t).toHaveAttribute('data-state', 'available'));
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders the room name and the tape label text', () => {
    render(<FloorPlanScene document={floorPlanFixture()} />);
    expect(screen.getByText('Dining')).toBeInTheDocument();
    expect(screen.getByText('Bar')).toBeInTheDocument();
  });

  it('reflects per-table render state', () => {
    const { container } = render(
      <FloorPlanScene document={floorPlanFixture()} tableStates={{ t1: 'selected', t2: 'booked' }} />,
    );
    expect(container.querySelector('[data-table-id="t1"]')).toHaveAttribute('data-state', 'selected');
    expect(container.querySelector('[data-table-id="t2"]')).toHaveAttribute('data-state', 'booked');
  });

  it('makes available tables clickable buttons and fires selection', () => {
    const onSelectTable = jest.fn();
    render(<FloorPlanScene document={floorPlanFixture()} onSelectTable={onSelectTable} />);
    const button = screen.getByRole('button', { name: /Table 1/ });
    fireEvent.click(button);
    expect(onSelectTable).toHaveBeenCalledWith('t1');
  });

  it('selects a focused table with Enter or Space', () => {
    const onSelectTable = jest.fn();
    render(<FloorPlanScene document={floorPlanFixture()} onSelectTable={onSelectTable} />);
    const button = screen.getByRole('button', { name: /Table 1/ });
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyDown(button, { key: 'Escape' }); // ignored
    expect(onSelectTable).toHaveBeenCalledTimes(2);
  });

  it('renders a zone region with its name', () => {
    render(<FloorPlanScene document={floorPlanFixture()} />);
    expect(screen.getByText('Lounge')).toBeInTheDocument();
  });

  it('renders a room with no name and an unknown item kind without crashing', () => {
    const doc = floorPlanFixture();
    doc.walls.push({
      id: 'w2',
      points: [
        { x: 0.2, y: 0.2 },
        { x: 2, y: 0.2 },
        { x: 2, y: 2 },
        { x: 0.2, y: 2 },
      ],
      thicknessMeters: 0.1,
      isClosed: true, // a closed room with no name → floor fill, no label
      roomName: null,
      floorStyle: 'stone', // maps to the tile pattern
      zIndex: 1,
      openings: [],
    });
    doc.items.push({
      id: 'i9',
      kind: 'not_a_real_symbol',
      x: 3,
      y: 3,
      widthMeters: 1,
      heightMeters: 1,
      rotationDegrees: 0,
      zIndex: 9,
    });
    const { container } = render(<FloorPlanScene document={doc} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-table-id]')).toHaveLength(2);
  });

  it('does not make a booked or too-small table interactive', () => {
    const onSelectTable = jest.fn();
    const { container } = render(
      <FloorPlanScene
        document={floorPlanFixture()}
        onSelectTable={onSelectTable}
        tableStates={{ t1: 'booked', t2: 'small' }}
      />,
    );
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
  });

  it('draws the grid only when asked', () => {
    const withGrid = render(<FloorPlanScene document={floorPlanFixture()} showGrid />);
    const gridLines = withGrid.container.querySelectorAll('line[class*="grid"]');
    expect(gridLines.length).toBeGreaterThan(0);

    const noGrid = render(<FloorPlanScene document={floorPlanFixture()} />);
    expect(noGrid.container.querySelectorAll('line[class*="grid"]')).toHaveLength(0);
  });

  it('uses a custom i18n table label when supplied', () => {
    render(
      <FloorPlanScene
        document={floorPlanFixture()}
        formatTableLabel={(t) => `Tafel ${t.tableNumber}`}
        onSelectTable={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Tafel 1' })).toBeInTheDocument();
  });
});
