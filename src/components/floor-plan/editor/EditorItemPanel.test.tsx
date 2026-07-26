import { fireEvent, render, screen } from '@testing-library/react';
import EditorItemPanel from './EditorItemPanel';
import { planDocument, planItem } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import { MAX_ITEM_LABEL } from '@/lib/floorPlan/wayfinding';
import type { FloorPlanItem } from '@/types/floorPlan';

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

const draw = (item: FloorPlanItem = planItem()) => {
  const onPatch = jest.fn();
  const onDuplicate = jest.fn();
  const onDelete = jest.fn();
  render(
    <EditorItemPanel
      item={item}
      plan={planDocument([])}
      onPatch={onPatch}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
    />,
  );
  return { onPatch, onDuplicate, onDelete };
};

describe('EditorItemPanel — an ordinary object', () => {
  it('offers geometry, duplicate and delete, and no text field', () => {
    draw();
    expect(screen.getByLabelText('X (m)')).toHaveValue(3);
    expect(screen.queryByLabelText('Text')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Zone name')).not.toBeInTheDocument();
  });

  it('duplicates and deletes without a confirmation — an item is a local edit', () => {
    const { onDuplicate, onDelete } = draw();
    fireEvent.click(screen.getByRole('button', { name: /Duplicate/ }));
    fireEvent.click(screen.getByRole('button', { name: /Delete object/ }));
    expect(onDuplicate).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });
});

/**
 * The text field is the affordance the wayfinding kinds were waiting on: until
 * S8 gave it to them they were drawn but deliberately not grabbable, because
 * dragging something the inspector cannot edit is worse than not dragging it.
 */
describe('EditorItemPanel — the kinds that carry text', () => {
  it('calls a text label s text "Text"', () => {
    draw(planItem({ kind: 'text_label', label: 'Bar' }));
    expect(screen.getByLabelText('Text')).toHaveValue('Bar');
  });

  it('calls a zone s text "Zone name" — it names a place, it is not a caption', () => {
    draw(planItem({ kind: 'zone', label: 'Lounge' }));
    expect(screen.getByLabelText('Zone name')).toHaveValue('Lounge');
  });

  it('uses the same field for the older `label` spelling', () => {
    draw(planItem({ kind: 'label', label: 'Bar' }));
    expect(screen.getByLabelText('Text')).toHaveValue('Bar');
  });

  it('commits typed text', () => {
    const { onPatch } = draw(planItem({ kind: 'zone', label: 'Lounge' }));
    fireEvent.change(screen.getByLabelText('Zone name'), { target: { value: 'Terrace' } });
    expect(onPatch).toHaveBeenCalledWith({ label: 'Terrace' });
  });

  it('stores emptied text as null, so the renderer draws no empty tag box', () => {
    const { onPatch } = draw(planItem({ kind: 'zone', label: 'Lounge' }));
    fireEvent.change(screen.getByLabelText('Zone name'), { target: { value: '   ' } });
    expect(onPatch).toHaveBeenCalledWith({ label: null });
  });

  it("caps the input at the column's length, so a name cannot outlive the save", () => {
    draw(planItem({ kind: 'zone', label: 'Lounge' }));
    expect(screen.getByLabelText('Zone name')).toHaveAttribute('maxlength', String(MAX_ITEM_LABEL));
  });

  it('gives the entrance no text field — it carries a direction, not a name', () => {
    draw(planItem({ kind: 'entrance' }));
    expect(screen.queryByLabelText('Text')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Rotation (°)')).toBeInTheDocument();
  });
});
