'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { imageMaintenanceService, type ImageBackfillReport } from '@/services/imageMaintenanceService';
import { recordWindow, summarizePass, type BackfillPass } from '@/lib/imageBackfillProgress';
import { getErrorMessage } from '@/utils/apiClient';

/**
 * State for the image-backfill admin page.
 *
 * Two rules shape it. The first: you cannot apply what you have not previewed — `applyEnabled` is
 * derived from a dry-run report that actually found something, so the destructive action has no
 * path to being the first thing a page-load can do.
 *
 * The second arrived with the backend's cursor (#280). `cursor` is the START of the window on
 * screen, NOT the resume point — preview and apply both send it, so an apply always rewrites
 * exactly the window a dry run just showed. Advancing is a separate, explicit act
 * (`continueScan`), and it drops the on-screen report as it goes.
 */
export function useImageBackfill() {
  const { t } = useTranslation();
  const [report, setReport] = useState<ImageBackfillReport | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pass, setPass] = useState<BackfillPass>({});
  const [busy, setBusy] = useState<'preview' | 'continue' | 'apply' | 'clear' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(
    async (kind: 'preview' | 'continue' | 'apply' | 'clear', action: () => Promise<void>) => {
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

  const scan = useCallback(
    (kind: 'preview' | 'continue', from: string | null) =>
      run(kind, async () => {
        const scanned = await imageMaintenanceService.previewBackfill(from);
        setReport(scanned);
        setPass((prev) => recordWindow(prev, from, scanned));
      }),
    [run],
  );

  const preview = useCallback(() => scan('preview', cursor), [scan, cursor]);

  const continueScan = useCallback(() => {
    const next = report?.nextCursor;
    // Absent on a pre-#280 backend, which is what makes this degrade to the old behaviour rather
    // than break: no cursor, no advance, and the page never offers the control in the first place.
    if (!next) return Promise.resolve();
    // Dropped BEFORE the request, not after it succeeds. The cursor has moved; a report from the
    // previous window left on screen through a failed scan would leave Apply armed for a window
    // nobody has previewed.
    setReport(null);
    setCursor(next);
    return scan('continue', next);
  }, [report, scan]);

  const apply = useCallback(
    () =>
      run('apply', async () => {
        const applied = await imageMaintenanceService.applyBackfill(cursor);
        setReport(applied);
        setPass((prev) => recordWindow(prev, cursor, applied));
        setNotice(
          t('image_backfill_applied_notice', {
            count: applied.filesChanged,
            defaultValue: '{{count}} image(s) rewritten.',
          }),
        );
      }),
    [run, cursor, t],
  );

  const clearPreviews = useCallback(
    () =>
      run('clear', async () => {
        const removed = await imageMaintenanceService.clearPreviews();
        // The report's previewUrls now point at files that no longer exist, so it is dropped
        // rather than left on screen: a comparison against a deleted image renders as a broken
        // thumbnail, which reads as "the backfill corrupted my photos". `cursor` and `pass`
        // survive — freeing preview disk space mid-pass must not cost the operator their place.
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

  /**
   * Back to the first file, with the pass totals reset — a new walk, not a continuation.
   *
   * The only mutator that is not already serialised by `run`, so it checks `busy` itself rather
   * than trusting its button's `disabled`. Mid-flight it would move the cursor out from under a
   * request already in the air, and that request's report would then land against `cursor: null`
   * — a window on screen that Apply believes starts at the first file.
   */
  const startOver = useCallback(() => {
    if (busy !== null) return;
    setReport(null);
    setCursor(null);
    setPass({});
    setError(null);
    setNotice(null);
  }, [busy]);

  const { windows, totals } = useMemo(() => summarizePass(pass), [pass]);

  return {
    report,
    busy,
    error,
    notice,
    preview,
    continueScan,
    apply,
    clearPreviews,
    startOver,
    /**
     * Apply is offered only after a dry run that found something. `applied` reports are
     * excluded too — re-applying an already-applied report would rescan and overwrite again
     * for no gain.
     */
    applyEnabled: Boolean(report && !report.applied && report.filesChanged > 0),
    /** Truthiness, not `!= null`: an un-upgraded backend sends no cursor field at all. */
    canContinue: Boolean(report?.nextCursor),
    /** True once the pass is past its first window — the only state "Start over" means anything in. */
    resumed: cursor !== null,
    passWindows: windows,
    passTotals: totals,
    /** The scan reached the end of the library: this window stopped for want of files, not the cap. */
    passFinished: Boolean(report && !report.truncated),
  };
}
