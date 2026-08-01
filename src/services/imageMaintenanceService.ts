import { apiClient } from '@/utils/apiClient';

/**
 * Admin-only maintenance over images already in storage.
 *
 * Resize-on-upload only ever applied to NEW uploads, so every tenant that arrives with an
 * existing photo library is serving whatever their camera produced. This is the surface for
 * bringing those into line. Backend: `RestaurantSystem.Api/Features/Maintenance/`.
 */

interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

/**
 * What the resize pipeline would do (or did) to one stored image.
 *
 * Mirrors backend `ImageBackfillEntryDto`. `bytesSaved` is computed server-side and is never
 * negative — a file that would grow is skipped instead.
 */
export interface ImageBackfillEntry {
  relativePath: string;
  originalUrl: string;
  /**
   * The resized candidate, written to the preview folder on a dry run. Null once applied (the
   * original URL then serves the new bytes) or when the file was skipped.
   */
  previewUrl: string | null;
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  newWidth: number;
  newHeight: number;
  newBytes: number;
  bytesSaved: number;
  outcome: ImageBackfillOutcome;
}

/**
 * `needs-review` is the one that is not self-explanatory: the result looked like a failed
 * decode (far too few bytes per pixel) and was deliberately NOT written. Those files want a
 * human eye, which is why the UI must not fold them in with the ordinary skips.
 */
export type ImageBackfillOutcome =
  'resized' | 'recompressed' | 'skipped-no-gain' | 'skipped-unprocessable' | 'needs-review' | 'failed';

/** Mirrors backend `ImageBackfillReportDto`. */
export interface ImageBackfillReport {
  /** False = nothing was overwritten; candidates went to the preview folder. */
  applied: boolean;
  /** The same FileStorage settings uploads use — shown so the run is reproducible. */
  maxImageEdgePixels: number;
  imageQuality: number;
  filesScanned: number;
  filesChanged: number;
  filesSkipped: number;
  filesFailed: number;
  totalOriginalBytes: number;
  totalNewBytes: number;
  totalBytesSaved: number;
  /** True when the scan stopped at the cap — re-run to continue. */
  truncated: boolean;
  entries: ImageBackfillEntry[];
}

/** The backend clamps to this; mirrored so the UI cannot offer a value it will silently lower. */
export const MAX_FILES_PER_RUN = 500;

const ENDPOINTS = {
  BACKFILL: (apply: boolean, maxFiles: number) =>
    `/api/maintenance/images/backfill?apply=${apply}&maxFiles=${maxFiles}`,
  PREVIEWS: '/api/maintenance/images/backfill/previews',
} as const;

export const imageMaintenanceService = {
  /**
   * Report what the resize pipeline would do. Nothing is overwritten: each candidate is written
   * to the preview folder so `previewUrl` can be compared against `originalUrl` first.
   */
  async previewBackfill(maxFiles: number = MAX_FILES_PER_RUN): Promise<ImageBackfillReport> {
    const response = await apiClient.post<ApiResponse<ImageBackfillReport>>(ENDPOINTS.BACKFILL(false, maxFiles));
    return response.data;
  },

  /**
   * Overwrite the originals with the resized versions.
   *
   * DESTRUCTIVE AND NOT UNDOABLE from the app — the only way back is the nightly backup. Every
   * caller must confirm first.
   */
  async applyBackfill(maxFiles: number = MAX_FILES_PER_RUN): Promise<ImageBackfillReport> {
    const response = await apiClient.post<ApiResponse<ImageBackfillReport>>(ENDPOINTS.BACKFILL(true, maxFiles));
    return response.data;
  },

  /** Delete the dry-run previews once they have been reviewed. Returns how many were removed. */
  async clearPreviews(): Promise<number> {
    const response = await apiClient.delete<ApiResponse<number>>(ENDPOINTS.PREVIEWS);
    return response.data;
  },
};
