import { renderHook, act, waitFor } from '@testing-library/react';
import { useFloorPlanEditor } from './useFloorPlanEditor';
import { getFloorPlan, saveFloorPlan } from '@/services/floorPlanService';
import { floorPlanFixture } from '@/components/floor-plan/__fixtures__/floorPlanFixture';
import { AUTOSAVE_IDLE_MS } from './useEditorAutoSave';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f ?? _k, i18n: { language: 'en' } }),
}));

jest.mock('@/services/floorPlanService', () => ({
  getFloorPlan: jest.fn(),
  saveFloorPlan: jest.fn(),
}));

const mockGet = getFloorPlan as jest.Mock;
const mockSave = saveFloorPlan as jest.Mock;

/**
 * The composed editor is covered slice by slice (document, drag, items, marquee,
 * keyboard). What only exists here is the **wiring**: an autosave that is never
 * handed the store's document, dirty flag or save would fail silently — the editor
 * would look identical and simply never persist anything on its own.
 */
describe('useFloorPlanEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ success: true, data: floorPlanFixture() });
    mockSave.mockResolvedValue({ success: true, data: { ...floorPlanFixture(), updatedAt: 'v2' } });
  });

  const loaded = async () => {
    const hook = renderHook(() => useFloorPlanEditor({ onDeleteSelected: () => {} }));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    return hook;
  };

  it('autosaves a geometry edit once the admin stops', async () => {
    jest.useFakeTimers();
    try {
      const { result } = await loaded();
      act(() => result.current.mutateTable('t1', { positionX: 3 }));
      expect(mockSave).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(AUTOSAVE_IDLE_MS);
      });

      expect(mockSave).toHaveBeenCalledWith('plan-1', expect.objectContaining({ id: 'plan-1' }));
      expect(result.current.dirty).toBe(false);
      // Silent: the toolbar's status line reports it, a success banner would not.
      expect(result.current.message).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('leaves a clean plan alone', async () => {
    jest.useFakeTimers();
    try {
      await loaded();
      await act(async () => {
        jest.advanceTimersByTime(AUTOSAVE_IDLE_MS * 3);
      });
      expect(mockSave).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
