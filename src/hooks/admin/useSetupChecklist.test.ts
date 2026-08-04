import { act, renderHook, waitFor } from '@testing-library/react';
import { useSetupChecklist } from './useSetupChecklist';
import { getSetupChecklist, setSetupStepDone } from '@/services/setupChecklistService';
import { ApiError } from '@/utils/apiClient';

jest.mock('@/services/setupChecklistService', () => ({
  getSetupChecklist: jest.fn(),
  setSetupStepDone: jest.fn(),
  setSetupChecklistDismissed: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

const mockedGet = getSetupChecklist as jest.Mock;
const mockedSetStep = setSetupStepDone as jest.Mock;

const checklist = (menuDone: boolean) => ({
  data: { steps: [{ key: 'menu', isDone: menuDone, isDerived: false }], isDismissed: false },
});

/**
 * Issue #416. `mutate` re-reads after every write, and `load`'s catch is deliberately silent so a
 * rejected write's own sentence — the 400 for a derived step explains the snap-back — survives the
 * re-read. That left a third path uncovered: the write SUCCEEDS and the re-read fails. `saveError`
 * had been cleared on entry, nothing captured the read failure, and `setPending(null)` ran in the
 * `finally` — so the owner ticked a step, the server recorded it, and the checkbox snapped back
 * unchecked with no error at all.
 *
 * The two cases below pull in opposite directions, which is why both are pinned: one demands a
 * message where there was none, the other demands that message NOT appear and overwrite a more
 * specific one.
 */
describe('useSetupChecklist — reporting a failed re-read', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  const mount = async () => {
    const view = renderHook(() => useSetupChecklist());
    await waitFor(() => expect(view.result.current.isLoading).toBe(false));
    return view;
  };

  it('says the change was saved when the write lands and the re-read fails (#416)', async () => {
    mockedGet.mockResolvedValueOnce(checklist(false)); // mount
    mockedSetStep.mockResolvedValue(undefined); // the write SUCCEEDS
    mockedGet.mockRejectedValueOnce(new ApiError(500, 'Server unavailable')); // the re-read fails

    const { result } = await mount();
    await act(async () => {
      await result.current.setStepDone('menu', true);
    });

    // Not "could not save" — it saved. An owner told the save failed ticks it again.
    expect(result.current.saveError).toMatch(/^Saved\./);
    expect(result.current.saveError).not.toMatch(/Could not save/);
    // And the server's own words are deliberately NOT shown: "Server unavailable" is true of the
    // fetch and misleading about the write.
    expect(result.current.saveError).not.toMatch(/Server unavailable/);
    expect(result.current.pending).toBeNull();
  });

  it('keeps the WRITE’s reason when both the write and the re-read fail', async () => {
    mockedGet.mockResolvedValueOnce(checklist(false));
    mockedSetStep.mockRejectedValue(new ApiError(400, 'That step is derived and cannot be set'));
    mockedGet.mockRejectedValueOnce(new ApiError(500, 'Server unavailable'));

    const { result } = await mount();
    await act(async () => {
      await result.current.setStepDone('menu', true);
    });

    // The 400 explains the snap-back; the read failure must not overwrite it with something
    // generic. This is what #388 and E9 step 3 fixed in this file, and #416 must not undo it.
    expect(result.current.saveError).toMatch(/derived/);
    expect(result.current.saveError).not.toMatch(/^Saved\./);
  });

  it('reports nothing when the write and the re-read both succeed', async () => {
    mockedGet.mockResolvedValueOnce(checklist(false));
    mockedSetStep.mockResolvedValue(undefined);
    mockedGet.mockResolvedValueOnce(checklist(true));

    const { result } = await mount();
    await act(async () => {
      await result.current.setStepDone('menu', true);
    });

    expect(result.current.saveError).toBeNull();
    expect(result.current.checklist?.steps[0].isDone).toBe(true);
  });

  it('keeps the last good checklist when a plain refetch fails, and stays quiet', async () => {
    // `load`'s own catch must remain silent — this is the behaviour the third path was hiding
    // behind, and it is still correct on its own.
    mockedGet.mockResolvedValueOnce(checklist(true));
    const { result } = await mount();

    mockedGet.mockRejectedValueOnce(new ApiError(500, 'Server unavailable'));
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.checklist?.steps[0].isDone).toBe(true);
    expect(result.current.saveError).toBeNull();
  });
});
