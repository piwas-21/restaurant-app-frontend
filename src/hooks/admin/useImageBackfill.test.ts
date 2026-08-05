import { act, renderHook, waitFor } from '@testing-library/react';
import { useImageBackfill } from './useImageBackfill';
import { imageMaintenanceService, type ImageBackfillReport } from '@/services/imageMaintenanceService';

jest.mock('@/services/imageMaintenanceService', () => ({
  MAX_FILES_PER_RUN: 500,
  imageMaintenanceService: {
    previewBackfill: jest.fn(),
    applyBackfill: jest.fn(),
    clearPreviews: jest.fn(),
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, opts?: { defaultValue?: string; count?: number }) =>
      (opts?.defaultValue ?? _k).replace('{{count}}', String(opts?.count ?? '')),
  }),
}));

const mockPreview = imageMaintenanceService.previewBackfill as jest.MockedFunction<
  typeof imageMaintenanceService.previewBackfill
>;
const mockApply = imageMaintenanceService.applyBackfill as jest.MockedFunction<
  typeof imageMaintenanceService.applyBackfill
>;
const mockClear = imageMaintenanceService.clearPreviews as jest.MockedFunction<
  typeof imageMaintenanceService.clearPreviews
>;

function report(over: Partial<ImageBackfillReport> = {}): ImageBackfillReport {
  return {
    applied: false,
    maxImageEdgePixels: 1600,
    imageQuality: 80,
    filesScanned: 3,
    filesChanged: 2,
    filesSkipped: 1,
    filesFailed: 0,
    totalOriginalBytes: 3000,
    totalNewBytes: 1000,
    totalBytesSaved: 2000,
    truncated: false,
    nextCursor: null,
    entries: [],
    ...over,
  };
}

/** A window that stopped at the cap, with somewhere to resume from. */
function truncatedAt(cursor: string, over: Partial<ImageBackfillReport> = {}): ImageBackfillReport {
  return report({ truncated: true, nextCursor: cursor, ...over });
}

beforeEach(() => jest.clearAllMocks());

describe('useImageBackfill', () => {
  it('offers no apply until a dry run has found something to change', async () => {
    mockPreview.mockResolvedValue(report());
    const { result } = renderHook(() => useImageBackfill());

    // The guard that matters: apply overwrites originals irreversibly, so it must not be
    // reachable from a page that has never looked at anything.
    expect(result.current.applyEnabled).toBe(false);

    await act(async () => {
      await result.current.preview();
    });
    expect(result.current.applyEnabled).toBe(true);
  });

  it('keeps apply disabled when the dry run found nothing to change', async () => {
    mockPreview.mockResolvedValue(report({ filesChanged: 0 }));
    const { result } = renderHook(() => useImageBackfill());

    await act(async () => {
      await result.current.preview();
    });
    expect(result.current.applyEnabled).toBe(false);
  });

  it('keeps apply disabled once a report has been applied, so it cannot be re-run blindly', async () => {
    mockApply.mockResolvedValue(report({ applied: true, filesChanged: 2 }));
    mockPreview.mockResolvedValue(report());
    const { result } = renderHook(() => useImageBackfill());

    await act(async () => {
      await result.current.preview();
    });
    await act(async () => {
      await result.current.apply();
    });

    expect(result.current.applyEnabled).toBe(false);
    expect(result.current.notice).toBe('2 image(s) rewritten.');
  });

  it('surfaces a failure instead of leaving the page looking idle', async () => {
    mockPreview.mockRejectedValue(new Error('storage unreachable'));
    const { result } = renderHook(() => useImageBackfill());

    await act(async () => {
      await result.current.preview();
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.busy).toBeNull();
    expect(result.current.report).toBeNull();
  });

  it('drops the report when previews are cleared', async () => {
    mockPreview.mockResolvedValue(report());
    mockClear.mockResolvedValue(7);
    const { result } = renderHook(() => useImageBackfill());

    await act(async () => {
      await result.current.preview();
    });
    expect(result.current.report).not.toBeNull();

    await act(async () => {
      await result.current.clearPreviews();
    });

    // Otherwise every previewUrl on screen now points at a deleted file, and a wall of broken
    // thumbnails reads as "the backfill destroyed my photos".
    expect(result.current.report).toBeNull();
    expect(result.current.notice).toBe('7 preview file(s) removed.');
  });
});

describe('useImageBackfill paging (backend #280)', () => {
  it('starts at the first file, with no cursor to send', async () => {
    mockPreview.mockResolvedValue(report());
    const { result } = renderHook(() => useImageBackfill());

    await act(async () => {
      await result.current.preview();
    });

    expect(mockPreview).toHaveBeenCalledWith(null);
    expect(result.current.canContinue).toBe(false);
    expect(result.current.resumed).toBe(false);
  });

  // The asymmetry that makes paging safe: `apply` sends the START of the window on screen, never
  // the cursor that window handed back. Sending `nextCursor` would rewrite the NEXT 500 images —
  // the ones nobody has previewed — behind a confirm dialog that just described a different set.
  it('applies the window that was previewed, not the one it points at', async () => {
    mockPreview.mockResolvedValue(truncatedAt('products/m.jpg'));
    mockApply.mockResolvedValue(truncatedAt('products/m.jpg', { applied: true }));
    const { result } = renderHook(() => useImageBackfill());

    await act(async () => {
      await result.current.preview();
    });
    await act(async () => {
      await result.current.apply();
    });

    expect(mockApply).toHaveBeenCalledWith(null);
  });

  it('continues from the cursor, then applies THAT window from the same point', async () => {
    mockPreview.mockResolvedValueOnce(truncatedAt('products/m.jpg'));
    mockPreview.mockResolvedValueOnce(truncatedAt('products/z.jpg'));
    mockApply.mockResolvedValue(truncatedAt('products/z.jpg', { applied: true }));
    const { result } = renderHook(() => useImageBackfill());

    await act(async () => {
      await result.current.preview();
    });
    expect(result.current.canContinue).toBe(true);

    await act(async () => {
      await result.current.continueScan();
    });
    expect(mockPreview).toHaveBeenLastCalledWith('products/m.jpg');
    expect(result.current.resumed).toBe(true);
    // Still truncated, so there is more library behind it — the pass is not finished.
    expect(result.current.passFinished).toBe(false);

    await act(async () => {
      await result.current.apply();
    });
    expect(mockApply).toHaveBeenLastCalledWith('products/m.jpg');
  });

  // The cursor moves before the request goes out, so if the scan fails the page must not be left
  // holding the PREVIOUS window's report: apply would still be armed, and it would now rewrite a
  // window that was never previewed.
  it('leaves nothing to apply when a continue fails', async () => {
    mockPreview.mockResolvedValueOnce(truncatedAt('products/m.jpg', { filesChanged: 2 }));
    const { result } = renderHook(() => useImageBackfill());

    await act(async () => {
      await result.current.preview();
    });
    expect(result.current.applyEnabled).toBe(true);

    mockPreview.mockRejectedValueOnce(new Error('storage unreachable'));
    await act(async () => {
      await result.current.continueScan();
    });

    expect(result.current.applyEnabled).toBe(false);
    expect(result.current.report).toBeNull();
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  // The release shape this has to survive: the backend half of #280 is merged but unreleased, so
  // prod answers a truncated run with NO nextCursor field at all. That must read as "cannot
  // continue" — the old one-window behaviour — not as a cursor of `undefined`.
  it('offers no continue when the backend is too old to send a cursor', async () => {
    mockPreview.mockResolvedValue(report({ truncated: true, nextCursor: undefined }));
    const { result } = renderHook(() => useImageBackfill());

    await act(async () => {
      await result.current.preview();
    });
    expect(result.current.canContinue).toBe(false);

    await act(async () => {
      await result.current.continueScan();
    });
    expect(mockPreview).toHaveBeenCalledTimes(1);
    expect(result.current.resumed).toBe(false);
  });

  it('accumulates the pass across windows so the totals are the whole library, not the last batch', async () => {
    mockPreview.mockResolvedValueOnce(
      truncatedAt('products/m.jpg', { filesScanned: 500, filesChanged: 300, totalBytesSaved: 5000 }),
    );
    mockPreview.mockResolvedValueOnce(report({ filesScanned: 120, filesChanged: 40, totalBytesSaved: 900 }));
    const { result } = renderHook(() => useImageBackfill());

    await act(async () => {
      await result.current.preview();
    });
    await act(async () => {
      await result.current.continueScan();
    });

    expect(result.current.passWindows).toBe(2);
    expect(result.current.passTotals.filesScanned).toBe(620);
    expect(result.current.passTotals.filesChanged).toBe(340);
    expect(result.current.passTotals.totalBytesSaved).toBe(5900);
    // The second window stopped for want of files rather than at the cap: the walk is done.
    expect(result.current.passFinished).toBe(true);
    expect(result.current.canContinue).toBe(false);
  });

  it('counts a window once when it is previewed and then applied', async () => {
    mockPreview.mockResolvedValue(truncatedAt('products/m.jpg', { filesScanned: 500, filesChanged: 300 }));
    mockApply.mockResolvedValue(truncatedAt('products/m.jpg', { applied: true, filesScanned: 500, filesChanged: 300 }));
    const { result } = renderHook(() => useImageBackfill());

    await act(async () => {
      await result.current.preview();
    });
    await act(async () => {
      await result.current.apply();
    });

    expect(result.current.passWindows).toBe(1);
    expect(result.current.passTotals.filesScanned).toBe(500);
  });

  // Previews are disk, and a big library's are a lot of it. Freeing them mid-pass must not cost
  // the operator their place — only the report, whose thumbnails are now dead links.
  it('keeps the resume point when the previews are cleared', async () => {
    mockPreview.mockResolvedValueOnce(truncatedAt('products/m.jpg'));
    mockPreview.mockResolvedValueOnce(truncatedAt('products/z.jpg'));
    mockClear.mockResolvedValue(500);
    const { result } = renderHook(() => useImageBackfill());

    await act(async () => {
      await result.current.preview();
    });
    await act(async () => {
      await result.current.continueScan();
    });
    await act(async () => {
      await result.current.clearPreviews();
    });

    expect(result.current.report).toBeNull();
    expect(result.current.resumed).toBe(true);
    expect(result.current.passWindows).toBe(2);

    mockPreview.mockResolvedValueOnce(truncatedAt('products/z.jpg'));
    await act(async () => {
      await result.current.preview();
    });
    expect(mockPreview).toHaveBeenLastCalledWith('products/m.jpg');
  });

  it('start over goes back to the first file and forgets the totals', async () => {
    mockPreview.mockResolvedValue(truncatedAt('products/m.jpg'));
    const { result } = renderHook(() => useImageBackfill());

    await act(async () => {
      await result.current.preview();
    });
    await act(async () => {
      await result.current.continueScan();
    });
    expect(result.current.resumed).toBe(true);

    act(() => {
      result.current.startOver();
    });

    expect(result.current.resumed).toBe(false);
    expect(result.current.report).toBeNull();
    expect(result.current.passWindows).toBe(0);

    await act(async () => {
      await result.current.preview();
    });
    expect(mockPreview).toHaveBeenLastCalledWith(null);
  });

  // `startOver` is the one mutator `run` does not serialise, so it checks `busy` itself instead of
  // trusting its button's `disabled`. Reset mid-flight, the in-air scan's report would land against
  // `cursor: null` — a window on screen that Apply believes starts at the first file, which is
  // precisely the unpreviewed-rewrite this design exists to make impossible.
  it('refuses to reset out from under a request already in the air', async () => {
    mockPreview.mockResolvedValueOnce(truncatedAt('products/m.jpg'));
    let settle: (value: ImageBackfillReport) => void = () => {};
    mockPreview.mockReturnValueOnce(
      new Promise<ImageBackfillReport>((resolve) => {
        settle = resolve;
      }),
    );
    const { result } = renderHook(() => useImageBackfill());

    await act(async () => {
      await result.current.preview();
    });

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.continueScan();
    });
    expect(result.current.busy).toBe('continue');

    act(() => {
      result.current.startOver();
    });
    expect(result.current.resumed).toBe(true);

    await act(async () => {
      settle(truncatedAt('products/z.jpg'));
      await pending;
    });
    // The landing report belongs to the window the cursor still points at.
    expect(result.current.resumed).toBe(true);
    await act(async () => {
      await result.current.apply();
    });
    expect(mockApply).toHaveBeenLastCalledWith('products/m.jpg');
  });
});
