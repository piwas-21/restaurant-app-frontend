import { act, renderHook } from '@testing-library/react';
import { useSheetSteps } from './useSheetSteps';
import type { CustomizationStep } from '@/utils/customizationSteps';

const step = (id: string, overrides: Partial<CustomizationStep> = {}): CustomizationStep => ({
  id,
  kind: 'ingredients',
  titleKey: id,
  singleChoice: false,
  isRequired: false,
  ...overrides,
});

const EMPTY_GATE = { selectedVariationId: null, selectedIngredients: [] };

const OPTIONAL_FLOW = [step('a'), step('b'), step('review', { kind: 'review' })];

describe('useSheetSteps — moving through the flow', () => {
  it('starts on the first step and reports where it is', () => {
    const { result } = renderHook(() => useSheetSteps({ steps: OPTIONAL_FLOW, gate: EMPTY_GATE }));

    expect(result.current.index).toBe(0);
    expect(result.current.isFirst).toBe(true);
    expect(result.current.isLast).toBe(false);
  });

  it('advances, remembers the direction, and goes back', () => {
    const { result } = renderHook(() => useSheetSteps({ steps: OPTIONAL_FLOW, gate: EMPTY_GATE }));

    act(() => result.current.goNext());
    expect(result.current.index).toBe(1);
    expect(result.current.direction).toBe('forward');

    act(() => result.current.goBack());
    expect(result.current.index).toBe(0);
    expect(result.current.direction).toBe('back');
  });

  it('does not run off the end', () => {
    const { result } = renderHook(() => useSheetSteps({ steps: OPTIONAL_FLOW, gate: EMPTY_GATE }));

    act(() => result.current.goNext());
    act(() => result.current.goNext());
    expect(result.current.isLast).toBe(true);

    act(() => result.current.goNext());
    expect(result.current.index).toBe(2);
  });

  /**
   * The progress bar is a jump target, and a jump that skipped a required step would route straight
   * around the gate below. `furthest` is what the bar disables against.
   */
  it('only records a step as reached once it has actually been reached', () => {
    const { result } = renderHook(() => useSheetSteps({ steps: OPTIONAL_FLOW, gate: EMPTY_GATE }));

    expect(result.current.furthest).toBe(0);
    act(() => result.current.goNext());
    expect(result.current.furthest).toBe(1);

    act(() => result.current.goBack());
    expect(result.current.index).toBe(0);
    expect(result.current.furthest).toBe(1);
  });

  it('restarts at step one when the sheet reopens on a different item', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => useSheetSteps({ steps: OPTIONAL_FLOW, gate: EMPTY_GATE, resetKey }),
      { initialProps: { resetKey: 'p1' } },
    );

    act(() => result.current.goNext());
    expect(result.current.index).toBe(1);

    rerender({ resetKey: 'p2' });
    expect(result.current.index).toBe(0);
    expect(result.current.furthest).toBe(0);
  });
});

describe('useSheetSteps — the required-step gate', () => {
  const REQUIRED_FLOW = [
    step('variations', { kind: 'variations', isRequired: true, singleChoice: true }),
    step('b'),
    step('review', { kind: 'review' }),
  ];

  it('refuses to advance while the step is unsatisfied', () => {
    const { result } = renderHook(() => useSheetSteps({ steps: REQUIRED_FLOW, gate: EMPTY_GATE }));

    expect(result.current.blocker).toBe('variation');
    act(() => result.current.goNext());
    expect(result.current.index).toBe(0);
  });

  /**
   * Continue is never disabled — a disabled control explains nothing (#208). The reason appears
   * only once the guest has pressed it, so a freshly-arrived step is not greeted with red text.
   */
  it('says nothing on arrival and states the reason once Continue is pressed', () => {
    const { result } = renderHook(() => useSheetSteps({ steps: REQUIRED_FLOW, gate: EMPTY_GATE }));

    expect(result.current.showBlocker).toBe(false);
    act(() => result.current.goNext());
    expect(result.current.showBlocker).toBe(true);
  });

  it('advances as soon as the gate is satisfied', () => {
    const { result, rerender } = renderHook(({ gate }) => useSheetSteps({ steps: REQUIRED_FLOW, gate }), {
      initialProps: { gate: EMPTY_GATE as { selectedVariationId: string | null; selectedIngredients: string[] } },
    });

    act(() => result.current.goNext());
    expect(result.current.index).toBe(0);

    rerender({ gate: { selectedVariationId: 'v1', selectedIngredients: [] } });
    expect(result.current.blocker).toBeNull();
    expect(result.current.showBlocker).toBe(false);

    act(() => result.current.goNext());
    expect(result.current.index).toBe(1);
  });
});

describe('useSheetSteps — auto-advance', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('advances a single-choice step shortly after the guest answers it', () => {
    const gate = { selectedVariationId: 'v1', selectedIngredients: [] };
    const steps = [step('variations', { kind: 'variations', singleChoice: true }), step('b'), step('c')];
    const { result } = renderHook(() => useSheetSteps({ steps, gate }));

    act(() => result.current.advanceAfterChoice());
    expect(result.current.index).toBe(0); // still on it — the tick has to be readable first

    act(() => jest.advanceTimersByTime(300));
    expect(result.current.index).toBe(1);
  });

  it('leaves a MULTI-choice step alone — ticking one box is not an answer', () => {
    const { result } = renderHook(() => useSheetSteps({ steps: OPTIONAL_FLOW, gate: EMPTY_GATE }));

    act(() => result.current.advanceAfterChoice());
    act(() => jest.advanceTimersByTime(300));
    expect(result.current.index).toBe(0);
  });

  it('cancels a pending advance when the guest goes back first', () => {
    const gate = { selectedVariationId: 'v1', selectedIngredients: [] };
    const steps = [step('a'), step('variations', { kind: 'variations', singleChoice: true }), step('c')];
    const { result } = renderHook(() => useSheetSteps({ steps, gate }));

    act(() => result.current.goNext());
    act(() => result.current.advanceAfterChoice());
    act(() => result.current.goBack());
    act(() => jest.advanceTimersByTime(300));

    // Without the cancel the queued timer would fire against the NEW index and march the guest
    // forward out of the step they had just chosen to return to.
    expect(result.current.index).toBe(0);
  });
});
