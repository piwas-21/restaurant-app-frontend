import { renderHook, act } from '@testing-library/react';
import { useEditorKeyboard } from './useEditorKeyboard';
import { floorPlanFixture } from '@/components/floor-plan/__fixtures__/floorPlanFixture';
import type { FloorPlanDocument } from '@/types/floorPlan';

const table = (doc: FloorPlanDocument, id: string) => doc.tables.find((t) => t.id === id)!;

function setup(overrides: Partial<Parameters<typeof useEditorKeyboard>[0]> = {}) {
  const apply = jest.fn();
  const undo = jest.fn();
  const redo = jest.fn();
  const onDeleteSelected = jest.fn();
  const props = {
    enabled: true,
    document: floorPlanFixture(),
    selectedId: 't1' as string | null,
    apply,
    undo,
    redo,
    onDeleteSelected,
    ...overrides,
  };
  renderHook(() => useEditorKeyboard(props));
  return { apply, undo, redo, onDeleteSelected, props };
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
    const { apply } = setup({ selectedId: 't2' }); // t2 starts at 30°
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
    const { apply, undo } = setup({ selectedId: null });
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
});
