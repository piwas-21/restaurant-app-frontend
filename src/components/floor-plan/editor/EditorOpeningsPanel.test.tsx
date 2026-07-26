import { fireEvent, render, screen, within } from '@testing-library/react';
import EditorOpeningsPanel from './EditorOpeningsPanel';
import { planWall } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import { DEFAULT_OPENING_WIDTH_M, MAX_WALL_OPENINGS } from '@/lib/floorPlan/wallOpenings';
import type { FloorPlanOpening, FloorPlanWall } from '@/types/floorPlan';

// The stubbed `t` returns each string's fallback, and the kind buttons' fallback
// is the kind token itself (`editor_opening_window` → "window"), matching the
// `editor_shape_*` pattern the table panel already uses. Hence the /i.
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

const opening = (over: Partial<FloorPlanOpening> = {}): FloorPlanOpening => ({
  id: 'o1',
  segmentIndex: 0,
  offsetMeters: 1,
  widthMeters: 1,
  kind: 'door',
  swingDirection: 'in',
  ...over,
});

const draw = (wall: FloorPlanWall = planWall()) => {
  const onAdd = jest.fn();
  const onPatch = jest.fn();
  const onRemove = jest.fn();
  render(<EditorOpeningsPanel wall={wall} onAdd={onAdd} onPatch={onPatch} onRemove={onRemove} />);
  return { onAdd, onPatch, onRemove };
};

describe('EditorOpeningsPanel — adding', () => {
  it('offers one button per kind and lands it on the longest side', () => {
    const { onAdd } = draw();
    fireEvent.click(screen.getByRole('button', { name: /window/i }));
    // The fixture room's sides are 4, 3, 4, 3 m — side 0 is the longest.
    expect(onAdd).toHaveBeenCalledWith(0, 'window');
  });

  it('explains an empty wall instead of showing a bare list', () => {
    draw();
    expect(screen.getByText(/No openings yet/)).toBeInTheDocument();
  });

  it("disables adding at the server's cap, rather than letting the save fail", () => {
    const full = planWall({ openings: Array.from({ length: MAX_WALL_OPENINGS }, (_, i) => opening({ id: `o${i}` })) });
    draw(full);
    expect(screen.getByRole('button', { name: /door/i })).toBeDisabled();
  });
});

describe('EditorOpeningsPanel — editing a row', () => {
  const wallWithDoor = planWall({ openings: [opening()] });

  it('lists each side with its length, so "which side" is answerable', () => {
    draw(wallWithDoor);
    expect(within(screen.getByLabelText('Side')).getByRole('option', { name: 'Side 1 · 4.00 m' })).toBeInTheDocument();
  });

  it('moves an opening to another side', () => {
    const { onPatch } = draw(wallWithDoor);
    fireEvent.change(screen.getByLabelText('Side'), { target: { value: '1' } });
    expect(onPatch).toHaveBeenCalledWith('o1', { segmentIndex: 1 });
  });

  it('changes its kind', () => {
    const { onPatch } = draw(wallWithDoor);
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'window' } });
    expect(onPatch).toHaveBeenCalledWith('o1', { kind: 'window' });
  });

  it('caps the width at the side it sits on, so the field cannot express an overhang', () => {
    draw(wallWithDoor);
    expect(screen.getByLabelText('Width (m)')).toHaveAttribute('max', '4');
  });

  it('caps the offset at what the width leaves', () => {
    draw(wallWithDoor);
    expect(screen.getByLabelText('From corner (m)')).toHaveAttribute('max', '3');
  });

  it('commits a typed offset and width', () => {
    const { onPatch } = draw(wallWithDoor);
    const offset = screen.getByLabelText('From corner (m)');
    fireEvent.change(offset, { target: { value: '2.5' } });
    fireEvent.blur(offset);
    expect(onPatch).toHaveBeenCalledWith('o1', { offsetMeters: 2.5 });

    const width = screen.getByLabelText('Width (m)');
    fireEvent.change(width, { target: { value: '1.4' } });
    fireEvent.blur(width);
    expect(onPatch).toHaveBeenCalledWith('o1', { widthMeters: 1.4 });
  });

  it('changes a door s swing', () => {
    const { onPatch } = draw(wallWithDoor);
    fireEvent.change(screen.getByLabelText('Swing'), { target: { value: 'out' } });
    expect(onPatch).toHaveBeenCalledWith('o1', { swingDirection: 'out' });
  });

  it('removes it', () => {
    const { onRemove } = draw(wallWithDoor);
    fireEvent.click(screen.getByRole('button', { name: /Remove opening/ }));
    expect(onRemove).toHaveBeenCalledWith('o1');
  });
});

describe('EditorOpeningsPanel — an opening on a side that no longer exists', () => {
  // Reachable after a corner removal races an open panel. The row still has to
  // render, with the narrowest sane bound, rather than crashing the inspector.
  it('still renders, falling back to the minimum width bound', () => {
    draw(planWall({ openings: [opening({ segmentIndex: 9 })] }));
    expect(screen.getByLabelText('Width (m)')).toHaveAttribute('max', '0.2');
  });
});

describe('EditorOpeningsPanel — swing is a door-only property', () => {
  it('offers it for a door', () => {
    draw(planWall({ openings: [opening()] }));
    expect(screen.getByLabelText('Swing')).toHaveValue('in');
  });

  it.each(['window', 'opening'] as const)('hides it for a %s, which has no leaf', (kind) => {
    draw(
      planWall({ openings: [opening({ kind, swingDirection: 'none', widthMeters: DEFAULT_OPENING_WIDTH_M[kind] })] }),
    );
    expect(screen.queryByLabelText('Swing')).not.toBeInTheDocument();
  });
});
