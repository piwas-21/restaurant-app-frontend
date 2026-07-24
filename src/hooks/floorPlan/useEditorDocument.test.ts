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

  it('surfaces an error status when the load fails', async () => {
    mockGet.mockResolvedValueOnce({ success: false });
    const { result } = renderHook(() => useEditorDocument());
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});
