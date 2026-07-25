import { fireEvent, render, screen } from '@testing-library/react';
import EditorPalette from './EditorPalette';
import { PALETTE_KINDS } from '@/lib/floorPlan/palette';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, vars?: Record<string, unknown>) =>
      Object.entries(vars ?? {}).reduce(
        (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
        fallback ?? key,
      ),
    i18n: { language: 'en' },
  }),
}));

const draw = (over: Partial<Parameters<typeof EditorPalette>[0]> = {}) => {
  const onArm = jest.fn();
  const onAddTable = jest.fn();
  const view = render(
    <EditorPalette
      armedKind={null}
      onArm={onArm}
      onAddTable={onAddTable}
      addTableDisabled={false}
      canPlace
      {...over}
    />,
  );
  return { ...view, onArm, onAddTable };
};

describe('EditorPalette', () => {
  it('offers every placeable kind, each previewing its own symbol', () => {
    const { container } = draw();
    // One button per kind plus the Add-table entry.
    expect(container.querySelectorAll('button')).toHaveLength(PALETTE_KINDS.length + 1);
    expect(container.querySelectorAll('[class*="preview"] svg').length).toBe(PALETTE_KINDS.length);
  });

  it('shows the footprint a kind will be placed at', () => {
    draw();
    // The bar counter's symbol is authored 360 × 70 cm.
    expect(screen.getByRole('button', { name: /Bar counter/ })).toHaveTextContent('3.60 × 0.70 m');
  });

  it('arms the kind that was clicked, reporting a real pointer behind it', () => {
    const { onArm } = draw();
    fireEvent.click(screen.getByRole('button', { name: /Tree/ }), { detail: 1 });
    expect(onArm).toHaveBeenCalledWith('tree', true);
  });

  it('reports a pointer-LESS activation, which the editor places without a click', () => {
    // A keyboard Enter/Space, voice control or assistive tech: `detail === 0`.
    const { onArm } = draw();
    fireEvent.click(screen.getByRole('button', { name: /Tree/ }), { detail: 0 });
    expect(onArm).toHaveBeenCalledWith('tree', false);
  });

  it('marks the armed entry pressed, and only that one', () => {
    const { container } = draw({ armedKind: 'tree' });
    const pressed = [...container.querySelectorAll('[aria-pressed="true"]')];
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent('Tree');
  });

  it('tells the user what the armed entry is waiting for', () => {
    draw({ armedKind: 'tree' });
    expect(screen.getByText('Click the plan to place Tree. Esc cancels.')).toBeInTheDocument();
  });

  it('disables every entry and says why when the plan is full', () => {
    const { container } = draw({ canPlace: false });
    container.querySelectorAll('[aria-pressed]').forEach((entry) => expect(entry).toBeDisabled());
    expect(screen.getByText(/This plan is full/)).toBeInTheDocument();
  });

  it('opens the create-table modal instead of placing a table', () => {
    const { onAddTable, onArm } = draw();
    fireEvent.click(screen.getByRole('button', { name: 'Add table' }));
    expect(onAddTable).toHaveBeenCalledTimes(1);
    expect(onArm).not.toHaveBeenCalled();
  });

  it('locks Add table while geometry is unsaved, without locking the rest', () => {
    draw({ addTableDisabled: true });
    expect(screen.getByRole('button', { name: 'Add table' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Tree/ })).toBeEnabled();
  });
});
