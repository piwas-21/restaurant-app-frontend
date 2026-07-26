import { fireEvent, render, screen } from '@testing-library/react';
import EditorVertexFields from './EditorVertexFields';
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

const draw = (selectedVertex: number | null = null, wall: FloorPlanWall = planWall()) => {
  const onSelectVertex = jest.fn();
  const onMove = jest.fn();
  const onRemove = jest.fn();
  render(
    <EditorVertexFields
      wall={wall}
      plan={{ widthMeters: 10, heightMeters: 8 }}
      selectedVertex={selectedVertex}
      onSelectVertex={onSelectVertex}
      onMove={onMove}
      onRemove={onRemove}
    />,
  );
  return { onSelectVertex, onMove, onRemove };
};

describe('EditorVertexFields — picking a corner', () => {
  // The picker is the ONLY route to a corner without a pointer, so it carries
  // every corner the wall has, not just the ones near the last click.
  it('offers one option per corner plus an explicit none', () => {
    draw();
    expect(screen.getAllByRole('option')).toHaveLength(5);
    expect(screen.getByRole('option', { name: 'Corner 4' })).toBeInTheDocument();
  });

  it('reports a pick, and reports clearing it as null rather than an empty string', () => {
    const { onSelectVertex } = draw(1);
    fireEvent.change(screen.getByLabelText('Corner'), { target: { value: '2' } });
    expect(onSelectVertex).toHaveBeenCalledWith(2);
    fireEvent.change(screen.getByLabelText('Corner'), { target: { value: '' } });
    expect(onSelectVertex).toHaveBeenCalledWith(null);
  });

  it('explains how to get a corner when none is picked, and shows no fields', () => {
    draw();
    expect(screen.getByText(/Drag a corner dot/)).toBeInTheDocument();
    expect(screen.queryByLabelText('X (m)')).not.toBeInTheDocument();
  });
});

describe('EditorVertexFields — typing a position', () => {
  it('shows the picked corner and commits a typed X, carrying Y unchanged', () => {
    const { onMove } = draw(1); // (5, 1)
    expect(screen.getByLabelText('X (m)')).toHaveValue(5);
    const field = screen.getByLabelText('X (m)');
    fireEvent.change(field, { target: { value: '6.5' } });
    fireEvent.blur(field);
    expect(onMove).toHaveBeenCalledWith(1, 6.5, 1);
  });

  it('clamps to the plan, so a typed corner cannot sit where Save would move it', () => {
    const { onMove } = draw(1);
    const field = screen.getByLabelText('Y (m)');
    fireEvent.change(field, { target: { value: '99' } });
    fireEvent.blur(field);
    expect(onMove).toHaveBeenCalledWith(1, 5, 8);
  });
});

describe('EditorVertexFields — removing', () => {
  it('removes the picked corner', () => {
    const { onRemove } = draw(1);
    fireEvent.click(screen.getByRole('button', { name: /Remove corner/ }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  // Disabled AND explained: a button that silently does nothing is the worse bug.
  it('refuses to take a room below three corners, and says why', () => {
    const triangle = planWall({
      points: [
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 4 },
      ],
    });
    draw(0, triangle);
    expect(screen.getByRole('button', { name: /Remove corner/ })).toBeDisabled();
    expect(screen.getByText(/at least two corners/)).toBeInTheDocument();
  });
});
