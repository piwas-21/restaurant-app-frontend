import { render, screen } from '@testing-library/react';
import EditorToolbar from './EditorToolbar';
import type { FloorPlanEditorApi } from '@/hooks/floorPlan/useFloorPlanEditor';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f ?? _k, i18n: { language: 'en' } }),
}));

/** Only what the toolbar reads — the editor API is far wider than this surface. */
type ToolbarState = Pick<
  FloorPlanEditorApi,
  'canUndo' | 'canRedo' | 'gridVisible' | 'snapEnabled' | 'overlapCount' | 'dirty' | 'saving' | 'conflicted'
> & { autoSaveStalled: boolean };

const BASE: ToolbarState = {
  canUndo: false,
  canRedo: false,
  gridVisible: true,
  snapEnabled: true,
  overlapCount: 0,
  dirty: false,
  saving: false,
  conflicted: false,
  autoSaveStalled: false,
};

const draw = (over: Partial<ToolbarState> = {}) => {
  const editor = {
    ...BASE,
    ...over,
    undo: jest.fn(),
    redo: jest.fn(),
    setGridVisible: jest.fn(),
    setSnapEnabled: jest.fn(),
    save: jest.fn().mockResolvedValue(true),
    viewport: { zoomIn: jest.fn(), zoomOut: jest.fn(), fit: jest.fn(), isZoomed: false },
  } as unknown as FloorPlanEditorApi;
  render(<EditorToolbar editor={editor} onPreview={jest.fn()} />);
  return editor;
};

/**
 * The save status is the only thing telling the admin whether their layout is on the
 * server. It replaced an unexplained dot, so each state has to read correctly — a
 * wrong "All changes saved" is the worst bug this component can have.
 */
describe('EditorToolbar save status', () => {
  it('reports a clean plan as saved', () => {
    draw();
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
  });

  it('reports a pending autosave', () => {
    draw({ dirty: true });
    expect(screen.getByText('Saving shortly…')).toBeInTheDocument();
  });

  it('reports the request in flight', () => {
    draw({ dirty: true, saving: true });
    // Twice on purpose: the status line and the Save button's own label agree.
    expect(screen.getAllByText('Saving…')).toHaveLength(2);
    expect(screen.queryByText('Saving shortly…')).not.toBeInTheDocument();
  });

  // Autosave has stopped trying: saying "shortly" would leave the admin building on
  // edits that are going nowhere.
  it('reports a stall instead of a pending save', () => {
    draw({ dirty: true, autoSaveStalled: true });
    expect(screen.getByText('Not saved — use Save')).toBeInTheDocument();
    expect(screen.queryByText('Saving shortly…')).not.toBeInTheDocument();
  });

  it('reports a conflict, which only a reload resolves', () => {
    draw({ dirty: true, conflicted: true, autoSaveStalled: true });
    expect(screen.getByText('Reload needed')).toBeInTheDocument();
  });

  it('keeps Save available exactly while something is outstanding', () => {
    draw({ dirty: true });
    expect(screen.getByRole('button', { name: 'Save layout' })).toBeEnabled();
  });

  it('disables Save when there is nothing to send', () => {
    draw();
    expect(screen.getByRole('button', { name: 'Save layout' })).toBeDisabled();
  });
});
