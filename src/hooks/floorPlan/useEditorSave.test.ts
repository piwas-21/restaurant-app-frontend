import { renderHook, act } from '@testing-library/react';
import { useEditorSave } from './useEditorSave';
import { saveFloorPlan } from '@/services/floorPlanService';
import { floorPlanFixture } from '@/components/floor-plan/__fixtures__/floorPlanFixture';
import type { FloorPlanDocument } from '@/types/floorPlan';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f ?? _k, i18n: { language: 'en' } }),
}));

jest.mock('@/services/floorPlanService', () => ({ saveFloorPlan: jest.fn() }));

const mockSave = saveFloorPlan as jest.Mock;

/**
 * `useEditorDocument.test.ts` covers the save as the editor uses it. This file
 * drives `getDocument` directly, which is the only way to script the case the
 * two-pass bound in `flush` exists for: a document that keeps moving while the
 * requests covering it are still in flight.
 */
describe('useEditorSave', () => {
  const edit = (n: number): FloorPlanDocument => ({ ...floorPlanFixture(), widthMeters: n });

  const setup = () => {
    let current = edit(1);
    const hook = renderHook(() => useEditorSave({ getDocument: () => current, onPersisted: () => {} }));
    return { ...hook, setDocument: (doc: FloorPlanDocument) => (current = doc), initial: current };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue({ success: true, data: { ...floorPlanFixture(), updatedAt: 'v2' } });
  });

  it('reports success once the loaded document is the persisted one', async () => {
    const { result, initial } = setup();
    act(() => result.current.adoptToken(initial));

    await expect(result.current.flush()).resolves.toBe(true);
    expect(mockSave).not.toHaveBeenCalled();
  });

  // Two passes, then stop. The caller is holding a modal open on the network, so a
  // "keep trying until clean" loop would hang for as long as the admin kept dragging.
  it('gives up after two passes when edits keep outrunning the network', async () => {
    const { result, initial, setDocument } = setup();
    act(() => result.current.adoptToken(initial));
    setDocument(edit(2));

    let n = 2;
    mockSave.mockImplementation(async () => {
      // Another drag lands while the request is in flight, so what the server is
      // about to accept is already behind the editor.
      n += 1;
      setDocument(edit(n));
      return { success: true, data: { ...floorPlanFixture(), updatedAt: `v${n}` } };
    });

    await act(async () => {
      await expect(result.current.flush()).resolves.toBe(false);
    });
    expect(mockSave).toHaveBeenCalledTimes(2);
  });

  it('reports success when the second pass catches up', async () => {
    const { result, initial, setDocument } = setup();
    act(() => result.current.adoptToken(initial));
    setDocument(edit(2));

    let call = 0;
    mockSave.mockImplementation(async () => {
      call += 1;
      // One more drag during the first request only; the second request covers it.
      if (call === 1) {
        setDocument(edit(3));
      }
      return { success: true, data: { ...floorPlanFixture(), updatedAt: `server-v${call + 1}` } };
    });

    await act(async () => {
      await expect(result.current.flush()).resolves.toBe(true);
    });
    expect(mockSave).toHaveBeenCalledTimes(2);
    // The second pass must echo the token the FIRST pass was handed back. Reading it
    // from render state instead of a ref sends the already-consumed one, and the
    // server rejects that as a conflict — a 409 against the editor's own write, which
    // latches the conflict flag and kills autosave for the rest of the session.
    expect(mockSave).toHaveBeenLastCalledWith('plan-1', expect.objectContaining({ updatedAt: 'server-v2' }));
  });
});
