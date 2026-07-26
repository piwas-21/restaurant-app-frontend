import { renderHook, act } from '@testing-library/react';
import { useEditorKeyboard } from './useEditorKeyboard';
import { floorPlanFixture } from '@/components/floor-plan/__fixtures__/floorPlanFixture';
import type { FloorPlanDocument } from '@/types/floorPlan';

const table = (doc: FloorPlanDocument, id: string) => doc.tables.find((t) => t.id === id)!;
const item = (doc: FloorPlanDocument, id: string) => doc.items.find((i) => i.id === id)!;

function setup(overrides: Partial<Parameters<typeof useEditorKeyboard>[0]> = {}) {
  const apply = jest.fn();
  const undo = jest.fn();
  const redo = jest.fn();
  const onDeleteSelected = jest.fn();
  const onDeleteItems = jest.fn();
  const onDuplicate = jest.fn();
  const clearSelection = jest.fn();
  const onSelectTool = jest.fn();
  const props = {
    enabled: true,
    document: floorPlanFixture(),
    selectedIds: ['t1'],
    apply,
    undo,
    redo,
    clearSelection,
    onDeleteSelected,
    onDeleteItems,
    onDuplicate,
    onSelectTool,
    ...overrides,
  };
  renderHook(() => useEditorKeyboard(props));
  return { apply, undo, redo, clearSelection, onDeleteSelected, onDeleteItems, onDuplicate, onSelectTool, props };
}

const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ...init }));
  });

describe('useEditorKeyboard', () => {
  it('nudges the selected table one grid unit with an arrow key', () => {
    const { apply } = setup(); // gridSizeCm 25 → 0.25m
    press('ArrowRight');
    expect(table(apply.mock.calls[0][0], 't1').positionX).toBeCloseTo(1.75, 5);
  });

  it('nudges ten grid units with Shift held', () => {
    const { apply } = setup();
    press('ArrowDown', { shiftKey: true });
    expect(table(apply.mock.calls[0][0], 't1').positionY).toBeCloseTo(5, 5);
  });

  it('clamps a nudge at the plan edge', () => {
    const doc = floorPlanFixture();
    doc.tables[0].positionX = 5.9; // plan is 6m wide → +0.25 overshoots
    const { apply } = setup({ document: doc });
    press('ArrowRight');
    expect(table(apply.mock.calls[0][0], 't1').positionX).toBe(6);
  });

  it('rotates by ±15° with the bracket keys and normalises', () => {
    const { apply } = setup();
    press(']');
    expect(table(apply.mock.calls[0][0], 't1').rotation).toBe(15);
    press('[', { shiftKey: true }); // -90 from 0 → 270
    expect(table(apply.mock.calls[1][0], 't1').rotation).toBe(270);
  });

  it('resets rotation with 0', () => {
    const { apply } = setup({ selectedIds: ['t2'] }); // t2 starts at 30°
    press('0');
    expect(table(apply.mock.calls[0][0], 't2').rotation).toBe(0);
  });

  it('asks to delete the selection with Delete', () => {
    const { onDeleteSelected, apply } = setup();
    press('Delete');
    expect(onDeleteSelected).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();
  });

  it('undoes and redoes with the platform shortcut', () => {
    const { undo, redo } = setup();
    press('z', { metaKey: true });
    press('z', { metaKey: true, shiftKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).toHaveBeenCalledTimes(1);
  });

  it('ignores editing keys while a form field is focused', () => {
    const { apply } = setup();
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(apply).not.toHaveBeenCalled();
    input.remove();
  });

  it('does nothing on arrows when no table is selected but still undoes', () => {
    const { apply, undo } = setup({ selectedIds: [] });
    press('ArrowRight');
    expect(apply).not.toHaveBeenCalled();
    press('z', { ctrlKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('binds nothing when disabled', () => {
    const { apply } = setup({ enabled: false });
    press('ArrowRight');
    expect(apply).not.toHaveBeenCalled();
  });

  it('nudges every selected table, so a group moves from the keyboard too', () => {
    const doc = floorPlanFixture();
    const { apply } = setup({ document: doc, selectedIds: doc.tables.map((t) => t.id) });
    press('ArrowRight');
    const next = apply.mock.calls[0][0];
    doc.tables.forEach((before, i) => expect(next.tables[i].positionX).toBeCloseTo(before.positionX + 0.25, 5));
  });

  it('leaves unselected tables where they are', () => {
    const doc = floorPlanFixture();
    const { apply } = setup({ document: doc, selectedIds: ['t1'] });
    press('ArrowRight');
    expect(apply.mock.calls[0][0].tables[1]).toEqual(doc.tables[1]);
  });

  it('nudges nothing when the selection is empty', () => {
    const { apply } = setup({ selectedIds: [] });
    press('ArrowRight');
    expect(apply).not.toHaveBeenCalled();
  });

  it('clears the selection on Escape', () => {
    const { clearSelection } = setup();
    press('Escape');
    expect(clearSelection).toHaveBeenCalledTimes(1);
  });

  it('rotates only a single selection — a group turn is a different operation', () => {
    const doc = floorPlanFixture();
    const { apply } = setup({ document: doc, selectedIds: doc.tables.map((t) => t.id) });
    press(']');
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('useEditorKeyboard — placed items', () => {
  it('nudges a selected item, writing its own field names', () => {
    const { apply } = setup({ selectedIds: ['i2'] }); // plant at (5, 4)
    press('ArrowRight');
    expect(item(apply.mock.calls[0][0], 'i2').x).toBeCloseTo(5.25, 5);
  });

  it('nudges a table and an item together', () => {
    const { apply } = setup({ selectedIds: ['t1', 'i2'] });
    press('ArrowDown');
    const next = apply.mock.calls[0][0];
    expect(table(next, 't1').positionY).toBeCloseTo(2.75, 5);
    expect(item(next, 'i2').y).toBeCloseTo(4.25, 5);
  });

  it('rotates an item with the bracket keys', () => {
    const { apply } = setup({ selectedIds: ['i2'] });
    press(']');
    expect(item(apply.mock.calls[0][0], 'i2').rotationDegrees).toBe(15);
  });

  it('deletes items outright — no modal, because it is a local edit', () => {
    const { onDeleteItems, onDeleteSelected } = setup({ selectedIds: ['i1', 'i2'] });
    press('Delete');
    expect(onDeleteItems).toHaveBeenCalledTimes(1);
    expect(onDeleteSelected).not.toHaveBeenCalled();
  });

  it('deletes the items of a MIXED selection and leaves the table to its dialog', () => {
    const { onDeleteItems, onDeleteSelected } = setup({ selectedIds: ['t1', 'i2'] });
    press('Backspace');
    expect(onDeleteItems).toHaveBeenCalledTimes(1);
    expect(onDeleteSelected).not.toHaveBeenCalled();
  });

  it('asks nothing when several TABLES are selected — one dialog cannot cover both', () => {
    const { onDeleteItems, onDeleteSelected } = setup({ selectedIds: ['t1', 't2'] });
    press('Delete');
    expect(onDeleteItems).not.toHaveBeenCalled();
    expect(onDeleteSelected).not.toHaveBeenCalled();
  });

  it('duplicates on ⌘D, and swallows the browser bookmark shortcut regardless', () => {
    const { onDuplicate } = setup({ selectedIds: ['i2'] });
    press('d', { metaKey: true });
    press('D', { ctrlKey: true, shiftKey: true });
    expect(onDuplicate).toHaveBeenCalledTimes(2);
  });

  it('leaves a bare d alone, so it stays free for a future tool shortcut', () => {
    const { onDuplicate } = setup({ selectedIds: ['i2'] });
    press('d');
    expect(onDuplicate).not.toHaveBeenCalled();
  });
});
