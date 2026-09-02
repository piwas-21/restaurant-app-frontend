'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stepBlocker, type CustomizationStep, type StepBlocker, type StepGateState } from '@/utils/customizationSteps';

/** How long a single-choice step lingers on the tick before it advances (plan §3.2). */
const AUTO_ADVANCE_MS = 260;

interface UseSheetStepsArgs {
  /** The derived flow. A new array identity is fine — only `id`s are compared. */
  steps: readonly CustomizationStep[];
  /** Everything `stepBlocker` reads. */
  gate: StepGateState;
  /** The group's minimum and its member ids — the sauce gate's two inputs. */
  sauceMin?: number;
  sauceIds?: readonly string[];
  /** Resets the flow to step 0. Change it when the sheet opens on a different item. */
  resetKey?: string;
}

/**
 * Drives the guided customization flow (MENU-CUSTOMIZATION-FLOW-PLAN §3.2): which step is on
 * screen, which direction the panel should animate, which steps have been reached, and whether the
 * guest may move on.
 *
 * Holds no selection state of its own — the two sheet controllers still own that, so the flow can
 * be layered over either body without either learning about the other.
 */
export function useSheetSteps({ steps, gate, sauceMin = 0, sauceIds = [], resetKey }: UseSheetStepsArgs) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  // Reached, not completed: a step the guest has SEEN may be jumped back to from the progress bar.
  // Steps ahead of the furthest one reached stay unreachable, so the bar cannot skip a required gate.
  const [furthest, setFurthest] = useState(0);
  // Set only when the guest has actually pressed Continue on an unsatisfied required step. A
  // freshly-arrived step never greets them with red text — the same rule the bundle body's
  // `showValidation` has always followed.
  const [attempted, setAttempted] = useState(false);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clampedIndex = Math.min(index, Math.max(0, steps.length - 1));
  const step = steps[clampedIndex];
  const isLast = clampedIndex >= steps.length - 1;

  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  }, []);

  // A different item ⇒ a different flow. Without this the sheet reopens on whichever step the
  // previous item was left on, which for a one-step item is an index that no longer exists.
  useEffect(() => {
    cancelAutoAdvance();
    setIndex(0);
    setFurthest(0);
    setAttempted(false);
    setDirection('forward');
  }, [resetKey, cancelAutoAdvance]);

  useEffect(() => cancelAutoAdvance, [cancelAutoAdvance]);

  const blocker: StepBlocker | null = useMemo(
    () => (step ? stepBlocker(step, gate, sauceMin, sauceIds) : null),
    [step, gate, sauceMin, sauceIds],
  );

  const goTo = useCallback(
    (next: number) => {
      cancelAutoAdvance();
      setDirection((current) => {
        if (next > clampedIndex) return 'forward';
        // Unchanged on a no-op jump: the panel is not moving, so it must not replay an entry
        // animation from a side it never left.
        return next < clampedIndex ? 'back' : current;
      });
      setIndex(next);
      setFurthest((seen) => Math.max(seen, next));
      setAttempted(false);
    },
    [cancelAutoAdvance, clampedIndex],
  );

  /** Reveal the current step's reason without moving — what a refused commit needs. */
  const revealBlocker = useCallback(() => setAttempted(true), []);

  const goNext = useCallback(() => {
    if (blocker) {
      // Continue is never disabled — a disabled control explains nothing (#208). Pressing it on an
      // unsatisfied step is what asks for the reason, and this is the flag that reveals it.
      setAttempted(true);
      return;
    }
    if (isLast) return;
    goTo(clampedIndex + 1);
  }, [blocker, isLast, goTo, clampedIndex]);

  const goBack = useCallback(() => {
    if (clampedIndex === 0) return;
    goTo(clampedIndex - 1);
  }, [clampedIndex, goTo]);

  /**
   * Called by a single-choice step when the guest CHANGES the answer.
   *
   * Only on a change, never on the seeded default: a variations step opens already answered, and
   * advancing off it on mount would flash a screen the guest never got to read.
   */
  const advanceAfterChoice = useCallback(() => {
    if (!step?.singleChoice || isLast) return;
    cancelAutoAdvance();
    const armedAt = clampedIndex;
    autoAdvanceRef.current = setTimeout(() => {
      autoAdvanceRef.current = null;
      // Computed from the index this timer was ARMED on, not read back through the setter: a state
      // updater has to be pure, and StrictMode double-invokes it. Any navigation in between has
      // already cancelled this timer, so the armed index is still the right one.
      const next = Math.min(armedAt + 1, steps.length - 1);
      setIndex(next);
      setFurthest((seen) => Math.max(seen, next));
      setDirection('forward');
    }, AUTO_ADVANCE_MS);
  }, [step, isLast, cancelAutoAdvance, steps.length, clampedIndex]);

  return {
    /** `undefined` only for an item with no steps at all, which never opens a sheet. */
    step,
    steps,
    index: clampedIndex,
    direction,
    furthest,
    isLast,
    isFirst: clampedIndex === 0,
    blocker,
    /** True only once the guest has pressed Continue on a step that is still unsatisfied. */
    showBlocker: attempted && blocker !== null,
    goTo,
    goNext,
    goBack,
    revealBlocker,
    advanceAfterChoice,
    cancelAutoAdvance,
  };
}

export type SheetStepsController = ReturnType<typeof useSheetSteps>;
