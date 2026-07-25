import { renderHook, act } from '@testing-library/react';
import { AUTOSAVE_IDLE_MS, AUTOSAVE_MAX_FAILURES, AUTOSAVE_MAX_WAIT_MS, useEditorAutoSave } from './useEditorAutoSave';
import { floorPlanFixture } from '@/components/floor-plan/__fixtures__/floorPlanFixture';
import type { FloorPlanDocument } from '@/types/floorPlan';

/** A distinct document reference — what a new History entry looks like to the hook. */
const edit = (n: number): FloorPlanDocument => ({ ...floorPlanFixture(), widthMeters: n });

type Args = Parameters<typeof useEditorAutoSave>[0];

const setup = (over: Partial<Args> = {}) => {
  const save = jest.fn().mockResolvedValue(true);
  const props: Args = {
    document: edit(1),
    dirty: true,
    saving: false,
    conflicted: false,
    save,
    ...over,
  };
  const hook = renderHook((p: Args) => useEditorAutoSave(p), { initialProps: props });
  return { ...hook, save, props };
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useEditorAutoSave', () => {
  it('saves silently once the admin has stopped editing', () => {
    const { save } = setup();

    act(() => jest.advanceTimersByTime(AUTOSAVE_IDLE_MS - 1));
    expect(save).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    expect(save).toHaveBeenCalledWith({ silent: true });
  });

  it('does not save a clean document', () => {
    const { save } = setup({ dirty: false });
    act(() => jest.advanceTimersByTime(AUTOSAVE_IDLE_MS * 4));
    expect(save).not.toHaveBeenCalled();
  });

  // A 409 means the plan moved under us: retrying on a timer would hammer the API
  // and still never win. Only a reload resolves it.
  it('stops after a conflict', () => {
    const { save } = setup({ conflicted: true });
    act(() => jest.advanceTimersByTime(AUTOSAVE_IDLE_MS * 4));
    expect(save).not.toHaveBeenCalled();
  });

  it('leaves a save already in flight alone', () => {
    const { save } = setup({ saving: true });
    act(() => jest.advanceTimersByTime(AUTOSAVE_IDLE_MS * 4));
    expect(save).not.toHaveBeenCalled();
  });

  it('restarts the idle wait on each further edit', () => {
    const { rerender, save, props } = setup();

    for (let i = 2; i <= 5; i += 1) {
      act(() => jest.advanceTimersByTime(AUTOSAVE_IDLE_MS - 200));
      rerender({ ...props, document: edit(i) });
    }
    // Four edits, each landing before the idle window closed: still nothing sent.
    expect(save).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(AUTOSAVE_IDLE_MS));
    expect(save).toHaveBeenCalledTimes(1);
  });

  // Without the max wait, an admin who never pauses for a full idle window would
  // keep every edit in the browser for as long as they kept working.
  it('saves anyway once the max wait is reached, mid-editing', () => {
    const { rerender, save, props } = setup();
    let doc = 1;

    // Keep editing just often enough that the idle debounce never fires on its own.
    for (let elapsed = 0; elapsed < AUTOSAVE_MAX_WAIT_MS; elapsed += AUTOSAVE_IDLE_MS - 200) {
      act(() => jest.advanceTimersByTime(AUTOSAVE_IDLE_MS - 200));
      doc += 1;
      rerender({ ...props, document: edit(doc) });
    }

    expect(save).toHaveBeenCalledWith({ silent: true });
  });

  // The conflict latch only covers 409. Without a cap on the rest, a backend 500, a
  // dropped connection or an expired admin session put the editor in a PUT-every-1.8s
  // loop with a permanently flashing error banner, for as long as the tab stayed open.
  it('stops retrying after repeated failures and says it has stalled', async () => {
    const save = jest.fn().mockResolvedValue(false);
    const props: Args = { document: edit(1), dirty: true, saving: false, conflicted: false, save };
    const { result, rerender } = renderHook((p: Args) => useEditorAutoSave(p), { initialProps: props });

    // Each failure is one full cycle: the timer fires, the save resolves false, and
    // the still-dirty document schedules the next attempt.
    for (let i = 0; i < AUTOSAVE_MAX_FAILURES + 3; i += 1) {
      // Awaited: the attempt's result lands in a microtask, so a synchronous advance
      // would run the next cycle before the failure had been counted.
      await act(async () => {
        jest.advanceTimersByTime(AUTOSAVE_IDLE_MS);
      });
      rerender({ ...props, document: edit(1) });
    }

    expect(save).toHaveBeenCalledTimes(AUTOSAVE_MAX_FAILURES);
    expect(result.current.stalled).toBe(true);
  });

  it('resumes once something lands, so a manual Save unblocks it', async () => {
    const save = jest.fn().mockResolvedValue(false);
    const props: Args = { document: edit(1), dirty: true, saving: false, conflicted: false, save };
    const { result, rerender } = renderHook((p: Args) => useEditorAutoSave(p), { initialProps: props });

    for (let i = 0; i < AUTOSAVE_MAX_FAILURES; i += 1) {
      await act(async () => {
        jest.advanceTimersByTime(AUTOSAVE_IDLE_MS);
      });
      rerender({ ...props, document: edit(1) });
    }
    expect(result.current.stalled).toBe(true);

    // The admin presses Save and it works: the network is fine again.
    save.mockResolvedValue(true);
    rerender({ ...props, dirty: false });
    expect(result.current.stalled).toBe(false);

    rerender({ ...props, document: edit(2), dirty: true });
    await act(async () => {
      jest.advanceTimersByTime(AUTOSAVE_IDLE_MS);
    });
    expect(save).toHaveBeenCalledTimes(AUTOSAVE_MAX_FAILURES + 1);
  });

  it('schedules a fresh window for edits made after a save', () => {
    const { rerender, save, props } = setup();
    act(() => jest.advanceTimersByTime(AUTOSAVE_IDLE_MS));
    expect(save).toHaveBeenCalledTimes(1);

    // The save landed (clean), then the admin edits again.
    rerender({ ...props, document: edit(2), dirty: false });
    rerender({ ...props, document: edit(3), dirty: true });
    act(() => jest.advanceTimersByTime(AUTOSAVE_IDLE_MS));
    expect(save).toHaveBeenCalledTimes(2);
  });
});
