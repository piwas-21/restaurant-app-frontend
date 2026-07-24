/**
 * An immutable undo/redo stack (FLOOR-PLAN-REVAMP §4.3) — the single thing that
 * makes a spatial editor safe to experiment in. Generic over the edited value
 * (the editor holds a whole `FloorPlanDocument`): each committed change pushes
 * the previous value onto `past` and clears `future`; undo/redo shuttle the
 * present between the two. Pure and structurally shared, so it is trivially
 * unit-tested and never mutates a prior state.
 */

export interface History<T> {
  present: T;
  past: readonly T[];
  future: readonly T[];
}

/** Cap on retained states — deep enough to feel unlimited, bounded for memory. */
export const MAX_HISTORY = 50;

export function initHistory<T>(present: T): History<T> {
  return { present, past: [], future: [] };
}

/**
 * Record a new present. A commit clears the redo stack (the classic branch-on-
 * edit behaviour) and trims the oldest states past {@link MAX_HISTORY}. Committing
 * the identical reference is a no-op, so a drag that ends where it started adds
 * nothing to undo.
 */
export function commit<T>(history: History<T>, next: T): History<T> {
  if (Object.is(history.present, next)) {
    return history;
  }
  const past = [...history.past, history.present];
  return {
    present: next,
    past: past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past,
    future: [],
  };
}

export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) {
    return history;
  }
  const previous = history.past.at(-1) as T;
  return {
    present: previous,
    past: history.past.slice(0, -1),
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) {
    return history;
  }
  const [next, ...rest] = history.future;
  return {
    present: next,
    past: [...history.past, history.present],
    future: rest,
  };
}

export const canUndo = <T>(history: History<T>): boolean => history.past.length > 0;
export const canRedo = <T>(history: History<T>): boolean => history.future.length > 0;
