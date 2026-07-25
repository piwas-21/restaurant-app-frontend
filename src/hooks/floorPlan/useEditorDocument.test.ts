import { renderHook, act, waitFor } from '@testing-library/react';
import { useEditorDocument } from './useEditorDocument';
import { getFloorPlan, saveFloorPlan } from '@/services/floorPlanService';
import { ApiError } from '@/utils/apiClient';
import { floorPlanFixture } from '@/components/floor-plan/__fixtures__/floorPlanFixture';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, f?: string) => f ?? _k,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/services/floorPlanService', () => ({
  getFloorPlan: jest.fn(),
  saveFloorPlan: jest.fn(),
}));

// The default manual apiClient mock omits ApiError; provide a real constructor so
// the hook's `err instanceof ApiError` 409 branch is exercised against the same
// one. A plain function (not a class) avoids babel class-helper hoisting inside
// the jest.mock factory.
jest.mock('@/utils/apiClient', () => {
  function ApiError(this: { status: number; message: string; name: string }, status: number, message: string) {
    this.status = status;
    this.message = message;
    this.name = 'ApiError';
  }
  ApiError.prototype = Object.create(Error.prototype);
  return { ApiError, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } };
});

const mockGet = getFloorPlan as jest.Mock;
const mockSave = saveFloorPlan as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({ success: true, data: floorPlanFixture() });
});

async function loaded() {
  const hook = renderHook(() => useEditorDocument());
  await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  return hook;
}

describe('useEditorDocument', () => {
  it('loads the plan into a clean history', async () => {
    const { result } = await loaded();
    expect(result.current.document?.id).toBe('plan-1');
    expect(result.current.dirty).toBe(false);
    expect(result.current.canUndo).toBe(false);
  });

  it('becomes dirty and undoable after a table mutation', async () => {
    const { result } = await loaded();
    act(() => result.current.mutateTable('t1', { positionX: 2 }));
    expect(result.current.dirty).toBe(true);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.document?.tables.find((t) => t.id === 't1')?.positionX).toBe(2);
  });

  it('saves the whole document and clears dirty on success', async () => {
    const { result } = await loaded();
    act(() => result.current.mutateTable('t1', { positionX: 2 }));
    mockSave.mockResolvedValue({ success: true, data: { ...floorPlanFixture(), updatedAt: '2026-07-25T00:00:00Z' } });

    await act(async () => {
      await result.current.save();
    });

    expect(mockSave).toHaveBeenCalledWith('plan-1', expect.objectContaining({ id: 'plan-1' }));
    expect(result.current.dirty).toBe(false);
    expect(result.current.message?.type).toBe('success');
  });

  it('reports a conflict message on a 409', async () => {
    const { result } = await loaded();
    act(() => result.current.mutateTable('t1', { positionX: 2 }));
    mockSave.mockRejectedValue(new ApiError(409, 'stale'));

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.message?.type).toBe('error');
    expect(result.current.message?.text).toMatch(/changed the plan/i);
    expect(result.current.dirty).toBe(true); // edits are kept so the user can reload/retry
  });

  // Autosave makes this load-bearing: re-initialising the history from the response
  // (which the save used to do) threw away every undo step, so an autosave a second
  // after a drag would quietly cost the admin their whole undo stack.
  it('keeps the undo stack across a save', async () => {
    const { result } = await loaded();
    act(() => result.current.mutateTable('t1', { positionX: 2 }));
    act(() => result.current.mutateTable('t1', { positionX: 3 }));
    mockSave.mockResolvedValue({ success: true, data: { ...floorPlanFixture(), updatedAt: 'v2' } });

    await act(async () => {
      await result.current.save({ silent: true });
    });

    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.document?.tables.find((t) => t.id === 't1')?.positionX).toBe(2);
  });

  it('does not announce a silent save', async () => {
    const { result } = await loaded();
    act(() => result.current.mutateTable('t1', { positionX: 2 }));
    mockSave.mockResolvedValue({ success: true, data: { ...floorPlanFixture(), updatedAt: 'v2' } });

    await act(async () => {
      await result.current.save({ silent: true });
    });

    expect(result.current.dirty).toBe(false);
    expect(result.current.message).toBeNull();
  });

  // The client echoes the `updatedAt` it holds; a save that kept sending the one it
  // loaded would 409 against its own previous write on the second autosave.
  it('echoes the token the server returned on the next save', async () => {
    const { result } = await loaded();
    mockSave.mockResolvedValue({ success: true, data: { ...floorPlanFixture(), updatedAt: 'v2' } });

    act(() => result.current.mutateTable('t1', { positionX: 2 }));
    await act(async () => {
      await result.current.save({ silent: true });
    });
    act(() => result.current.mutateTable('t1', { positionX: 3 }));
    await act(async () => {
      await result.current.save({ silent: true });
    });

    expect(mockSave).toHaveBeenLastCalledWith('plan-1', expect.objectContaining({ updatedAt: 'v2' }));
  });

  describe('flush', () => {
    it('is a no-op on a clean document', async () => {
      const { result } = await loaded();
      await expect(result.current.flush()).resolves.toBe(true);
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('persists pending edits before the caller proceeds', async () => {
      const { result } = await loaded();
      act(() => result.current.mutateTable('t1', { positionX: 2 }));
      mockSave.mockResolvedValue({ success: true, data: { ...floorPlanFixture(), updatedAt: 'v2' } });

      await act(async () => {
        await expect(result.current.flush()).resolves.toBe(true);
      });
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(result.current.dirty).toBe(false);
    });

    // The op that follows a flush ends in a reload, so a `false` has to mean "your
    // edits are still local" — never "someone else's request covered them".
    it('joins a save already in flight rather than reporting failure', async () => {
      const { result } = await loaded();
      act(() => result.current.mutateTable('t1', { positionX: 2 }));
      let release: (v: unknown) => void = () => {};
      mockSave.mockReturnValue(
        new Promise((resolve) => {
          release = resolve;
        }),
      );

      let autosave: Promise<boolean> | null = null;
      let flushed: Promise<boolean> | null = null;
      await act(async () => {
        autosave = result.current.save({ silent: true });
        flushed = result.current.flush();
        release({ success: true, data: { ...floorPlanFixture(), updatedAt: 'v2' } });
        await Promise.all([autosave, flushed]);
      });

      expect(mockSave).toHaveBeenCalledTimes(1);
      await expect(flushed).resolves.toBe(true);
    });

    it('reports false when the save fails, so the caller does not reload', async () => {
      const { result } = await loaded();
      act(() => result.current.mutateTable('t1', { positionX: 2 }));
      mockSave.mockResolvedValue({ success: false });

      await act(async () => {
        await expect(result.current.flush()).resolves.toBe(false);
      });
      expect(result.current.dirty).toBe(true);
    });
  });

  it('surfaces an error status when the load fails', async () => {
    mockGet.mockResolvedValueOnce({ success: false });
    const { result } = renderHook(() => useEditorDocument());
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('has nothing to save before a document loads', async () => {
    mockGet.mockResolvedValueOnce({ success: false });
    const { result } = renderHook(() => useEditorDocument());
    await waitFor(() => expect(result.current.status).toBe('error'));

    await act(async () => {
      await expect(result.current.save()).resolves.toBe(false);
    });
    expect(mockSave).not.toHaveBeenCalled();
  });

  // A 400 is a contract mismatch (this is how a client-minted id in a `Guid?` field
  // showed up). The banner can only be generic, so the detail has to reach the
  // console or the next such bug is invisible again.
  it('logs the server detail behind a non-conflict rejection', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await loaded();
    act(() => result.current.mutateTable('t1', { positionX: 2 }));
    mockSave.mockRejectedValue(new ApiError(400, 'The Id field is not valid.'));

    await act(async () => {
      await result.current.save();
    });

    expect(logged).toHaveBeenCalledWith('Floor plan save rejected', expect.objectContaining({ status: 400 }));
    expect(result.current.message?.text).toMatch(/could not save/i);
    logged.mockRestore();
  });
});
