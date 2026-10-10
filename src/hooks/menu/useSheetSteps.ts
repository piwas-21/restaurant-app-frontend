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
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  // Reached, not completed: a step the guest has SEEN may be jumped back to from the progress bar.
  // Steps ahead of the furthest one reached stay unreachable, so the bar cannot skip a required gate.
  const [reachedIds, setReachedIds] = useState<string[]>([]);
  // Set only when the guest has actually pressed Continue on an unsatisfied required step. A
  // freshly-arrived step never greets them with red text — the same rule the bundle body's
  // `showValidation` has always followed.
  const [attempted, setAttempted] = useState(false);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const lastStepRef = useRef<{ step: CustomizationStep; index: number } | null>(null);
  const stepIds = steps.map((candidate) => candidate.id).join('|');
  const requestedIndex = cursorId ? steps.findIndex((candidate) => candidate.id === cursorId) : -1;
  const lastStep = lastStepRef.current;
  const fallbackId = lastStep?.step.returnStepId ?? lastStep?.step.parentStepId;
  const fallbackIndex = fallbackId ? steps.findIndex((candidate) => candidate.id === fallbackId) : -1;
  let clampedIndex = Math.min(lastStep?.index ?? 0, Math.max(0, steps.length - 1));
  if (fallbackIndex >= 0) clampedIndex = fallbackIndex;
  if (requestedIndex >= 0) clampedIndex = requestedIndex;
  const step = steps[clampedIndex];
  if (step) lastStepRef.current = { step, index: clampedIndex };
  const currentReached = reachedIds.filter((id) => steps.some((candidate) => candidate.id === id));
  const reached = new Set(currentReached);
  let furthest = 0;
  while (furthest < steps.length - 1 && reached.has(steps[furthest + 1].id)) furthest++;
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
    const firstId = stepsRef.current[0]?.id ?? null;
    setCursorId(firstId);
    setReachedIds(firstId ? [firstId] : []);
    setAttempted(false);
    setDirection('forward');
  }, [resetKey, cancelAutoAdvance]);

  useEffect(() => {
    const active = stepsRef.current[clampedIndex];
    if (cursorId !== (active?.id ?? null)) setCursorId(active?.id ?? null);
    setReachedIds((current) => {
      const retained = current.filter((id) => stepsRef.current.some((candidate) => candidate.id === id));
      const next = active && !retained.includes(active.id) ? [...retained, active.id] : retained;
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
    });
  }, [stepIds, cursorId, clampedIndex]);

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
      const target = steps[next];
      setCursorId(target?.id ?? null);
      if (target) setReachedIds((seen) => (seen.includes(target.id) ? seen : [...seen, target.id]));
      setAttempted(false);
    },
    [cancelAutoAdvance, clampedIndex, steps],
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
    const armedStepId = step.id;
    autoAdvanceRef.current = setTimeout(() => {
      autoAdvanceRef.current = null;
      // Resolve by stable ID against the latest plan. A selected component can insert prerequisite
      // screens while the single-choice advance is pending; using the old index would skip them.
      const currentSteps = stepsRef.current;
      const armedAt = currentSteps.findIndex((candidate) => candidate.id === armedStepId);
      if (armedAt < 0) return;
      const next = Math.min(armedAt + 1, currentSteps.length - 1);
      const target = currentSteps[next];
      setCursorId(target?.id ?? null);
      if (target) setReachedIds((seen) => (seen.includes(target.id) ? seen : [...seen, target.id]));
      setDirection('forward');
    }, AUTO_ADVANCE_MS);
  }, [step, isLast, cancelAutoAdvance]);

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
