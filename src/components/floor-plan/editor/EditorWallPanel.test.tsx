import { fireEvent, render, screen } from '@testing-library/react';
import EditorWallPanel from './EditorWallPanel';
import { planWall } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import type { FloorPlanWall } from '@/types/floorPlan';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, f?: string | Record<string, unknown>, v?: Record<string, unknown>) => {
      const fallback = typeof f === 'string' ? f : _k;
      const values = (typeof f === 'string' ? v : f) ?? {};
      return fallback.replace(/{{(\w+)}}/g, (_m, key: string) => String(values[key] ?? ''));
    },
    i18n: { language: 'en' },
  }),
}));

const draw = (wall: FloorPlanWall = planWall(), selectedVertex: number | null = null) => {
  const handlers = {
    onPatch: jest.fn(),
    onDelete: jest.fn(),
    onSelectVertex: jest.fn(),
    onMoveVertex: jest.fn(),
    onRemoveVertex: jest.fn(),
    onAddOpening: jest.fn(),
    onPatchOpening: jest.fn(),
    onRemoveOpening: jest.fn(),
  };
  render(
    <EditorWallPanel
      wall={wall}
      plan={{ widthMeters: 10, heightMeters: 8 }}
      selectedVertex={selectedVertex}
      {...handlers}
    />,
  );
  return handlers;
};

describe('EditorWallPanel — a closed chain is a room', () => {
  it('titles it a room and offers the room fields', () => {
    draw();
    expect(screen.getByRole('heading', { name: 'Room' })).toBeInTheDocument();
    expect(screen.getByLabelText('Room name')).toHaveValue('Dining');
    expect(screen.getByLabelText('Floor')).toHaveValue('wood');
  });

  it('reports its corners, its running length and its enclosed area', () => {
    draw(); // 4 m × 3 m closed room
    expect(screen.getByText(/4 corners · 14.00 m/)).toBeInTheDocument();
    expect(screen.getByText(/12.0 m²/)).toBeInTheDocument();
  });

  it('stores an emptied room name as null, so the renderer draws no label box', () => {
    const { onPatch } = draw();
    fireEvent.change(screen.getByLabelText('Room name'), { target: { value: '  ' } });
    expect(onPatch).toHaveBeenCalledWith({ roomName: null });
  });

  it('changes the floor finish', () => {
    const { onPatch } = draw();
    fireEvent.change(screen.getByLabelText('Floor'), { target: { value: 'tile' } });
    expect(onPatch).toHaveBeenCalledWith({ floorStyle: 'tile' });
  });

  it('shows a stored finish the picker does not know as the default, without rewriting it', () => {
    const { onPatch } = draw(planWall({ floorStyle: 'terrazzo' }));
    expect(screen.getByLabelText('Floor')).toHaveValue('wood');
    expect(onPatch).not.toHaveBeenCalled();
  });
});

describe('EditorWallPanel — an open run is a wall', () => {
  const openRun = planWall({
    isClosed: false,
    roomName: null,
    floorStyle: null,
    points: [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
    ],
  });

  it('titles it a wall and hides the room fields — closing the chain is what makes a room', () => {
    draw(openRun);
    expect(screen.getByRole('heading', { name: 'Wall' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Room name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Floor')).not.toBeInTheDocument();
  });

  it('reports no area for something that encloses none', () => {
    draw(openRun);
    expect(screen.queryByText(/m²/)).not.toBeInTheDocument();
  });

  it('names its delete button for what it deletes', () => {
    const { onDelete } = draw(openRun);
    fireEvent.click(screen.getByRole('button', { name: /Delete wall/ }));
    expect(onDelete).toHaveBeenCalled();
  });
});

describe('EditorWallPanel — thickness', () => {
  it('commits a typed thickness', () => {
    const { onPatch } = draw();
    const field = screen.getByLabelText('Thickness (m)');
    fireEvent.change(field, { target: { value: '0.25' } });
    fireEvent.blur(field);
    expect(onPatch).toHaveBeenCalledWith({ thicknessMeters: 0.25 });
  });

  it("clamps to the server's range rather than saving a value it would move", () => {
    const { onPatch } = draw();
    const field = screen.getByLabelText('Thickness (m)');
    fireEvent.change(field, { target: { value: '5' } });
    fireEvent.blur(field);
    expect(onPatch).toHaveBeenCalledWith({ thicknessMeters: 1 });
  });
});
