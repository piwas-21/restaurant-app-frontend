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
    entries: [],
    ...over,
  };
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

  it('passes the chosen file cap through to the service', async () => {
    mockPreview.mockResolvedValue(report());
    const { result } = renderHook(() => useImageBackfill());

    act(() => result.current.setMaxFiles(25));
    await act(async () => {
      await result.current.preview();
    });

    expect(mockPreview).toHaveBeenCalledWith(25);
  });
});
