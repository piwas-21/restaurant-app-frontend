import { canRedo, canUndo, commit, initHistory, MAX_HISTORY, redo, undo } from './history';

describe('floorPlan/history', () => {
  it('starts empty', () => {
    const h = initHistory('a');
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('commits, undoes and redoes', () => {
    let h = initHistory('a');
    h = commit(h, 'b');
    h = commit(h, 'c');
    expect(h.present).toBe('c');
    expect(canUndo(h)).toBe(true);

    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);

    h = redo(h);
    expect(h.present).toBe('b');
    expect(canRedo(h)).toBe(true);
  });

  it('clears the redo stack on a fresh commit (branch on edit)', () => {
    let h = commit(commit(initHistory('a'), 'b'), 'c');
    h = undo(h); // present b, future [c]
    h = commit(h, 'd'); // branches
    expect(h.present).toBe('d');
    expect(canRedo(h)).toBe(false);
  });

  it('ignores a commit of the identical reference', () => {
    const h = commit(initHistory('a'), 'a');
    expect(canUndo(h)).toBe(false);
  });

  it('does nothing when there is nothing to undo/redo', () => {
    const h = initHistory('a');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('never mutates a prior state', () => {
    const a = { v: 1 };
    const b = { v: 2 };
    const h = commit(initHistory(a), b);
    expect(undo(h).present).toBe(a);
    expect(a.v).toBe(1);
  });

  it('caps the retained history', () => {
    let h = initHistory(0);
    for (let i = 1; i <= MAX_HISTORY + 10; i++) {
      h = commit(h, i);
    }
    expect(h.past).toHaveLength(MAX_HISTORY);
    expect(h.present).toBe(MAX_HISTORY + 10);
  });
});
