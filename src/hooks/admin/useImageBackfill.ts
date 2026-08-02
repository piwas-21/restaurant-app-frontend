'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { imageMaintenanceService, type ImageBackfillReport } from '@/services/imageMaintenanceService';
import { getErrorMessage } from '@/utils/apiClient';

/**
 * State for the image-backfill admin page.
 *
 * The shape enforces the one rule that matters: you cannot apply what you have not previewed.
 * `applyEnabled` is derived from a dry-run report that actually found something to change, so
 * the destructive action has no path to being the first thing a page-load can do.
 */
export function useImageBackfill() {
  const { t } = useTranslation();
  const [report, setReport] = useState<ImageBackfillReport | null>(null);
  const [busy, setBusy] = useState<'preview' | 'apply' | 'clear' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(
    async (kind: 'preview' | 'apply' | 'clear', action: () => Promise<void>) => {
      setBusy(kind);
      setError(null);
      setNotice(null);
      try {
        await action();
      } catch (err) {
        setError(getErrorMessage(err) ?? t('unexpected_error', 'An unexpected error occurred.'));
      } finally {
        setBusy(null);
      }
    },
    [t],
  );

  const preview = useCallback(
    () =>
      run('preview', async () => {
        setReport(await imageMaintenanceService.previewBackfill());
      }),
    [run],
  );

  const apply = useCallback(
    () =>
      run('apply', async () => {
        const applied = await imageMaintenanceService.applyBackfill();
        setReport(applied);
        setNotice(
          t('image_backfill_applied_notice', {
            count: applied.filesChanged,
            defaultValue: '{{count}} image(s) rewritten.',
          }),
        );
      }),
    [run, t],
  );

  const clearPreviews = useCallback(
    () =>
      run('clear', async () => {
        const removed = await imageMaintenanceService.clearPreviews();
        // The report's previewUrls now point at files that no longer exist, so it is dropped
        // rather than left on screen: a comparison against a deleted image renders as a broken
        // thumbnail, which reads as "the backfill corrupted my photos".
        setReport(null);
        setNotice(
          t('image_backfill_previews_cleared', {
            count: removed,
            defaultValue: '{{count}} preview file(s) removed.',
          }),
        );
      }),
    [run, t],
  );

  return {
    report,
    busy,
    error,
    notice,
    preview,
    apply,
    clearPreviews,
    /**
     * Apply is offered only after a dry run that found something. `applied` reports are
     * excluded too — re-applying an already-applied report would rescan and overwrite again
     * for no gain.
     */
    applyEnabled: Boolean(report && !report.applied && report.filesChanged > 0),
  };
}
