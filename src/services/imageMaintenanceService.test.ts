import { imageMaintenanceService, MAX_FILES_PER_RUN, type ImageBackfillReport } from './imageMaintenanceService';
import { apiClient } from '@/utils/apiClient';

jest.mock('@/utils/apiClient');

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const report: ImageBackfillReport = {
  applied: false,
  maxImageEdgePixels: 1600,
  imageQuality: 80,
  filesScanned: 500,
  filesChanged: 300,
  filesSkipped: 200,
  filesFailed: 0,
  totalOriginalBytes: 9000,
  totalNewBytes: 4000,
  totalBytesSaved: 5000,
  truncated: true,
  nextCursor: 'products/m.jpg',
  entries: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApiClient.post.mockResolvedValue({ success: true, data: report });
});

describe('imageMaintenanceService', () => {
  it('omits continueFrom entirely when there is no cursor, leaving the request as it always was', async () => {
    const result = await imageMaintenanceService.previewBackfill();

    expect(mockApiClient.post).toHaveBeenCalledWith(
      `/api/maintenance/images/backfill?apply=false&maxFiles=${MAX_FILES_PER_RUN}`,
    );
    expect(result).toEqual(report);
  });

  it('sends apply=true on the destructive call, still with no cursor by default', async () => {
    await imageMaintenanceService.applyBackfill();

    expect(mockApiClient.post).toHaveBeenCalledWith(
      `/api/maintenance/images/backfill?apply=true&maxFiles=${MAX_FILES_PER_RUN}`,
    );
  });

  // The cursor is a RELATIVE PATH, so it always carries at least one '/', and can carry anything
  // else a folder name can. Interpolated raw, the '&' below would end the continueFrom value and
  // the '#' would end the query — the backend would then see no cursor at all and restart the walk
  // from the first file. That silent restart IS #280, so this asserts the encoding, not the shape.
  it('percent-encodes a cursor whose path carries query metacharacters', async () => {
    await imageMaintenanceService.previewBackfill('products/a b&c#1.jpg');

    expect(mockApiClient.post).toHaveBeenCalledWith(
      `/api/maintenance/images/backfill?apply=false&maxFiles=${MAX_FILES_PER_RUN}` +
        '&continueFrom=products%2Fa+b%26c%231.jpg',
    );
  });

  it('carries the cursor on an apply too — a resumed pass must rewrite the window it previewed', async () => {
    await imageMaintenanceService.applyBackfill('products/m.jpg');

    expect(mockApiClient.post).toHaveBeenCalledWith(
      `/api/maintenance/images/backfill?apply=true&maxFiles=${MAX_FILES_PER_RUN}&continueFrom=products%2Fm.jpg`,
    );
  });

  // Both the "no cursor yet" and the "walk finished" states arrive here as null/undefined, and
  // neither may be sent: `continueFrom=null` is a path the backend would resume strictly AFTER,
  // skipping every file that sorts below the literal string "null".
  it.each([[null], [undefined], ['']])('treats %p as no cursor rather than sending it', async (cursor) => {
    await imageMaintenanceService.previewBackfill(cursor);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      `/api/maintenance/images/backfill?apply=false&maxFiles=${MAX_FILES_PER_RUN}`,
    );
  });

  it('lets a smaller window through for a slow box', async () => {
    await imageMaintenanceService.previewBackfill('products/m.jpg', 50);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/maintenance/images/backfill?apply=false&maxFiles=50&continueFrom=products%2Fm.jpg',
    );
  });

  it('clearPreviews unwraps the removed count from the ApiResponse envelope', async () => {
    mockApiClient.delete.mockResolvedValue({ success: true, data: 7 });

    await expect(imageMaintenanceService.clearPreviews()).resolves.toBe(7);
    expect(mockApiClient.delete).toHaveBeenCalledWith('/api/maintenance/images/backfill/previews');
  });

  it('propagates a failure to the caller — the hook owns what the operator is told', async () => {
    mockApiClient.post.mockRejectedValue(new Error('storage unreachable'));
    await expect(imageMaintenanceService.previewBackfill()).rejects.toThrow('storage unreachable');
  });
});
