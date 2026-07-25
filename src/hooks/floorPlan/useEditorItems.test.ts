import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEditorItems } from './useEditorItems';
import { MAX_PLAN_ITEMS } from '@/lib/floorPlan/palette';
import { planDocument, planItem, tableGeometry } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import type { ViewBox } from '@/lib/floorPlan/geometry';
import type { StagePointerPhase } from './editorStage';
import type { FloorPlanDocument } from '@/types/floorPlan';

/** Stage and viewBox chosen so one screen pixel is exactly one plan centimetre. */
const VIEW_BOX: ViewBox = { x: 0, y: 0, w: 1000, h: 800 };

const event = (clientX: number, clientY: number, over: Record<string, unknown> = {}) =>
  ({
    target: document.createElement('div'),
    clientX,
    clientY,
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    shiftKey: false,
    ...over,
  }) as unknown as ReactPointerEvent<HTMLDivElement>;

const setup = (
  over: {
    document?: FloorPlanDocument;
    selectedIds?: string[];
    snapEnabled?: boolean;
    /** Simulate a stage that has not been laid out yet. */
    unmeasured?: boolean;
  } = {},
) => {
  const apply = jest.fn();
  const onSelectMany = jest.fn();
  const fallback = {
    onPointerDown: jest.fn(),
    onPointerMove: jest.fn(),
    onPointerUp: jest.fn(),
    onPointerCancel: jest.fn(),
  };
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 }) as DOMRect;
  const { result } = renderHook(() =>
    useEditorItems({
      stageRef: { current: over.unmeasured ? null : el },
      viewBox: VIEW_BOX,
      document: over.document ?? planDocument([tableGeometry({ id: 't1' })]),
      snapEnabled: over.snapEnabled ?? true,
      selectedIds: over.selectedIds ?? [],
      apply,
      onSelectMany,
      fallback,
    }),
  );
  const fire = (phase: StagePointerPhase, x: number, y: number, extra?: Record<string, unknown>) =>
    act(() => result.current.handlers[phase](event(x, y, extra)));
  const arm = (kind: string, viaPointer = true) => act(() => result.current.arm(kind, viaPointer));
  return { result, fire, arm, apply, onSelectMany, fallback };
};

describe('useEditorItems — arming', () => {
  it('arms a kind and disarms when the same entry is picked again', () => {
    const { result, arm } = setup();
    arm('column');
    expect(result.current.armedKind).toBe('column');
    arm('column');
    expect(result.current.armedKind).toBeNull();
  });

  it('switches straight from one kind to another', () => {
    const { result, arm } = setup();
    arm('column');
    arm('tree');
    expect(result.current.armedKind).toBe('tree');
  });

  it('disarms on demand — the Escape path', () => {
    const { result, arm } = setup();
    arm('column');
    act(() => result.current.disarm());
    expect(result.current.armedKind).toBeNull();
  });
});

describe('useEditorItems — placing without a pointer (SC 2.1.1)', () => {
  it('places at the middle of the plan and never arms, since no click can follow', () => {
    const { result, arm, apply, onSelectMany } = setup(); // 10 × 8 m plan
    arm('column', false);
    expect(apply.mock.calls[0][0].items[0]).toMatchObject({ kind: 'column', x: 5, y: 4 });
    expect(onSelectMany).toHaveBeenCalledWith(['local-item-1']);
    expect(result.current.armedKind).toBeNull();
  });

  it('needs no measured stage, unlike a click', () => {
    const { arm, apply } = setup({ unmeasured: true });
    arm('column', false);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});

describe('useEditorItems — click-to-place', () => {
  it('passes the press down the chain while nothing is armed', () => {
    const { fire, fallback, apply } = setup();
    fire('onPointerDown', 400, 300);
    expect(fallback.onPointerDown).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();
  });

  it('places the armed kind at the clicked point, grid-snapped', () => {
    const { fire, arm, apply, onSelectMany } = setup();
    arm('column');
    fire('onPointerDown', 406, 294); // 4.06 m, 2.94 m → snapped to 4 m, 3 m
    const placed = apply.mock.calls[0][0].items[0];
    expect(placed).toMatchObject({ kind: 'column', x: 4, y: 3 });
    // The new object becomes the selection, so the inspector already points at it.
    expect(onSelectMany).toHaveBeenCalledWith([placed.id]);
  });

  it('honours the snap toggle', () => {
    const { fire, arm, apply } = setup({ snapEnabled: false });
    arm('column');
    fire('onPointerDown', 406, 294);
    expect(apply.mock.calls[0][0].items[0]).toMatchObject({ x: 4.06, y: 2.94 });
  });

  it('is single-shot: one click places one object and returns to selecting', () => {
    const { result, fire, arm } = setup();
    arm('column');
    fire('onPointerDown', 400, 300);
    expect(result.current.armedKind).toBeNull();
  });

  it('does not hand the press on to the gesture layer that never saw it', () => {
    const { fire, arm, fallback } = setup();
    arm('column');
    fire('onPointerDown', 400, 300);
    fire('onPointerMove', 420, 320);
    fire('onPointerUp', 420, 320);
    expect(fallback.onPointerDown).not.toHaveBeenCalled();
    expect(fallback.onPointerMove).not.toHaveBeenCalled();
    expect(fallback.onPointerUp).not.toHaveBeenCalled();
  });

  it('resumes the chain on the NEXT press after a placement', () => {
    const { fire, arm, fallback } = setup();
    arm('column');
    fire('onPointerDown', 400, 300);
    fire('onPointerUp', 400, 300);
    fire('onPointerDown', 500, 300);
    expect(fallback.onPointerDown).toHaveBeenCalledTimes(1);
  });

  it('releases a swallowed sequence on cancel too, so a lost pointer never latches', () => {
    const { fire, arm, fallback } = setup();
    arm('column');
    fire('onPointerDown', 400, 300);
    fire('onPointerCancel', 400, 300);
    fire('onPointerMove', 500, 300);
    expect(fallback.onPointerMove).toHaveBeenCalledTimes(1);
  });

  it('un-latches on the next press when the placing pointer-up never arrived', () => {
    // Released outside the window: no pointerup, and mice never send pointercancel.
    const { fire, arm, fallback } = setup();
    arm('column');
    fire('onPointerDown', 400, 300);
    // A fresh gesture must reach the chain and keep ALL of its own events.
    fire('onPointerDown', 500, 300);
    fire('onPointerMove', 520, 300);
    fire('onPointerUp', 520, 300);
    expect(fallback.onPointerDown).toHaveBeenCalledTimes(1);
    expect(fallback.onPointerMove).toHaveBeenCalledTimes(1);
    expect(fallback.onPointerUp).toHaveBeenCalledTimes(1);
  });

  it('never places with a non-primary button — a right-click must not drop an object', () => {
    const { fire, arm, apply, fallback } = setup();
    arm('column');
    fire('onPointerDown', 400, 300, { button: 2 });
    expect(apply).not.toHaveBeenCalled();
    expect(fallback.onPointerDown).toHaveBeenCalledTimes(1);
  });

  it('reports the plan as full at the server item cap', () => {
    const full = planDocument([], {
      items: Array.from({ length: MAX_PLAN_ITEMS }, (_, i) => planItem({ id: `i${i}` })),
    });
    const { result } = setup({ document: full });
    expect(result.current.canPlace).toBe(false);
  });

  it('places nothing at the cap and stays armed rather than pretending it worked', () => {
    const full = planDocument([], {
      items: Array.from({ length: MAX_PLAN_ITEMS }, (_, i) => planItem({ id: `i${i}` })),
    });
    const { result, fire, arm, apply } = setup({ document: full });
    arm('column');
    fire('onPointerDown', 400, 300);
    expect(apply).not.toHaveBeenCalled();
    expect(result.current.armedKind).toBe('column');
  });

  it('places nothing before the stage has been measured', () => {
    const { result, fire, arm, apply } = setup({ unmeasured: true });
    arm('column');
    fire('onPointerDown', 400, 300);
    expect(apply).not.toHaveBeenCalled();
    expect(result.current.armedKind).toBe('column');
  });
});

describe('useEditorItems — duplicate and delete', () => {
  const doc = planDocument([tableGeometry({ id: 't1' })], {
    items: [planItem({ id: 'i1' }), planItem({ id: 'i2', x: 5 })],
  });

  it('duplicates the selected items and selects the copies', () => {
    const { result, apply, onSelectMany } = setup({ document: doc, selectedIds: ['i1', 'i2'] });
    act(() => result.current.duplicateSelection());
    expect(apply.mock.calls[0][0].items).toHaveLength(4);
    expect(onSelectMany.mock.calls[0][0]).toHaveLength(2);
  });

  it('does nothing when the selection holds no items', () => {
    const { result, apply, onSelectMany } = setup({ document: doc, selectedIds: ['t1'] });
    act(() => result.current.duplicateSelection());
    expect(apply).not.toHaveBeenCalled();
    expect(onSelectMany).not.toHaveBeenCalled();
  });

  it('deletes the selected items', () => {
    const { result, apply } = setup({ document: doc, selectedIds: ['i1'] });
    act(() => result.current.deleteSelectedItems());
    expect(apply.mock.calls[0][0].items.map((i: { id?: string }) => i.id)).toEqual(['i2']);
  });

  it('leaves the selection to the store to prune, so a mixed one keeps its table', () => {
    const { result, apply, onSelectMany } = setup({ document: doc, selectedIds: ['t1', 'i1'] });
    act(() => result.current.deleteSelectedItems());
    expect(apply).toHaveBeenCalledTimes(1);
    expect(onSelectMany).not.toHaveBeenCalled();
  });

  it('does not push a history entry when there is nothing to delete', () => {
    const { result, apply } = setup({ document: doc, selectedIds: ['t1'] });
    act(() => result.current.deleteSelectedItems());
    expect(apply).not.toHaveBeenCalled();
  });
});
