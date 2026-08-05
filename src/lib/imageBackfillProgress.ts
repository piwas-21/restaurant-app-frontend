import type { ImageBackfillReport } from '@/services/imageMaintenanceService';

/**
 * Running totals for an image-backfill *pass* — the sequence of capped windows it takes to walk a
 * library end to end (backend #280 gave the walk a cursor; before that a pass was always one
 * window).
 *
 * A pass is held as a map keyed by window rather than a sum, and that is the whole point of the
 * file: every window is run at least TWICE, once as a dry run and once to apply, and a naive
 * accumulator would report a 500-image library as 1000 scanned. Keying makes the second run of a
 * window REPLACE the first instead of adding to it.
 */

/** The countable part of one window's report — everything a pass total is made of. */
export interface BackfillWindowTally {
  filesScanned: number;
  filesChanged: number;
  filesSkipped: number;
  filesFailed: number;
  totalBytesSaved: number;
}

/** A tally plus how it was produced, which decides whether a later run may replace it. */
export interface BackfillWindowRecord extends BackfillWindowTally {
  applied: boolean;
}

/** Window start (`continueFrom`) → what that window reported. */
export type BackfillPass = Readonly<Record<string, BackfillWindowRecord>>;

/**
 * Stands in for the first window, which has no `continueFrom`. Safe as a key because the backend
 * identifies a window by a relative path, and a relative path is never the empty string.
 */
export const FIRST_WINDOW_KEY = '';

const EMPTY_TALLY: BackfillWindowTally = {
  filesScanned: 0,
  filesChanged: 0,
  filesSkipped: 0,
  filesFailed: 0,
  totalBytesSaved: 0,
};

/**
 * Fold one report into the pass, under the window it describes.
 *
 * Later runs of a window replace earlier ones — EXCEPT a dry run over a window that was already
 * applied, which is dropped. Re-previewing finished work reports `filesChanged: 0` and
 * `totalBytesSaved: 0` precisely BECAUSE the work is done, so letting it win would delete 500
 * rewritten images from the totals. That is the same lie as double-counting, pointed the other
 * way, and it is reachable with one click: Preview is never disabled. (The cost is a pass total
 * that keeps describing work already done if the resize settings later change — the on-screen
 * window summary is what reports the current truth there.)
 */
export function recordWindow(
  pass: BackfillPass,
  continueFrom: string | null,
  report: ImageBackfillReport,
): BackfillPass {
  const key = continueFrom ?? FIRST_WINDOW_KEY;
  if (pass[key]?.applied && !report.applied) return pass;

  return {
    ...pass,
    [key]: {
      applied: report.applied,
      filesScanned: report.filesScanned,
      filesChanged: report.filesChanged,
      filesSkipped: report.filesSkipped,
      filesFailed: report.filesFailed,
      totalBytesSaved: report.totalBytesSaved,
    },
  };
}

/** How far the pass has got: how many windows it covers, and their totals. */
export function summarizePass(pass: BackfillPass): { windows: number; totals: BackfillWindowTally } {
  const records = Object.values(pass);
  return {
    windows: records.length,
    // Seeded from a COPY: an empty pass would otherwise hand every caller the shared constant.
    totals: records.reduce<BackfillWindowTally>(
      (sum, record) => ({
        filesScanned: sum.filesScanned + record.filesScanned,
        filesChanged: sum.filesChanged + record.filesChanged,
        filesSkipped: sum.filesSkipped + record.filesSkipped,
        filesFailed: sum.filesFailed + record.filesFailed,
        totalBytesSaved: sum.totalBytesSaved + record.totalBytesSaved,
      }),
      { ...EMPTY_TALLY },
    ),
  };
}
