'use client';

import { useTranslation } from 'react-i18next';
import StatusBadge, { type StatusBadgeTone } from '@/components/design-system/StatusBadge';
import type { ImageBackfillEntry, ImageBackfillOutcome } from '@/services/imageMaintenanceService';
import { formatBytes } from '@/utils/formatBytes';
import styles from './BackfillEntryCard.module.css';

const OUTCOME_TONE: Record<ImageBackfillOutcome, StatusBadgeTone> = {
  resized: 'success',
  recompressed: 'success',
  'skipped-no-gain': 'neutral',
  'skipped-unprocessable': 'warning',
  // Not a skip and not a failure: the result looked like a failed decode and was deliberately
  // NOT written. It needs a human to open the file, so it must not read as routine.
  'needs-review': 'danger',
  failed: 'danger',
};

interface BackfillEntryCardProps {
  entry: ImageBackfillEntry;
  /**
   * True once the run has overwritten the originals. Load-bearing, not cosmetic: the backend
   * writes `previewUrl` ONLY on a dry run, so after an apply there is no second image to show
   * and a "pair" would be the same URL twice under two different captions.
   */
  applied: boolean;
}

/**
 * One image, before and after.
 *
 * Both sides are plain `<img>` on purpose. `next/image` would re-encode each URL through the
 * optimizer, so the page would be comparing two Next-generated derivatives rather than the
 * bytes actually in storage — a before/after that can only ever look acceptable. Judging the
 * real output is the entire point of this screen, so the lint rule loses here.
 */
export default function BackfillEntryCard({ entry, applied }: BackfillEntryCardProps) {
  const { t } = useTranslation();
  const changed = entry.outcome === 'resized' || entry.outcome === 'recompressed';
  // A pair needs two DIFFERENT images. There is a second image only on a dry run that actually
  // produced a candidate; in every other case one pane is shown and labelled for what it is.
  const comparable = Boolean(entry.previewUrl) && !applied;
  // Cache-bust the applied URL: the same URL served the ORIGINAL bytes moments earlier during
  // the preview step, so without this the browser happily renders the stale image under an
  // "after" caption — a rewrite that looks like it did nothing.
  const storedSrc = applied && changed ? `${entry.originalUrl}?v=${entry.newBytes}` : entry.originalUrl;

  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <h3 className={styles.path}>{entry.relativePath}</h3>
        {/* `?? 'warning'`: Outcome is a plain string server-side, so a value added there lands
            here as undefined -> no tone at all. A new outcome is far likelier to be a problem
            state than a benign one, so the unknown case must not render as the calm one. */}
        <StatusBadge tone={OUTCOME_TONE[entry.outcome] ?? 'warning'}>
          {t(`image_backfill_outcome_${entry.outcome.replace(/-/g, '_')}`, entry.outcome)}
        </StatusBadge>
      </header>

      <div className={comparable ? styles.cols : styles.single}>
        {comparable && (
          <figure className={styles.figure}>
            {/* eslint-disable-next-line @next/next/no-img-element -- real stored bytes, see above */}
            <img
              src={entry.originalUrl}
              alt={`${t('image_backfill_before', 'Before')} — ${entry.relativePath}`}
              className={styles.image}
              loading="lazy"
            />
            <figcaption className={styles.caption}>
              {t('image_backfill_before', 'Before')} — {entry.originalWidth}×{entry.originalHeight},{' '}
              {formatBytes(entry.originalBytes)}
            </figcaption>
          </figure>
        )}

        <figure className={styles.figure}>
          {/* eslint-disable-next-line @next/next/no-img-element -- real stored bytes, see above */}
          <img
            src={comparable ? (entry.previewUrl as string) : storedSrc}
            alt={`${comparable ? t('image_backfill_after', 'After') : t('image_backfill_stored', 'Stored')} — ${entry.relativePath}`}
            className={styles.image}
            loading="lazy"
          />
          <figcaption className={styles.caption}>
            {comparable ? t('image_backfill_after', 'After') : t('image_backfill_stored', 'Stored')} —{' '}
            {changed ? (
              <>
                {entry.newWidth}×{entry.newHeight}, {formatBytes(entry.newBytes)}
                {entry.bytesSaved > 0 && <span className={styles.saved}> −{formatBytes(entry.bytesSaved)}</span>}
              </>
            ) : (
              <>
                {entry.originalWidth}×{entry.originalHeight}, {formatBytes(entry.originalBytes)}
              </>
            )}
          </figcaption>
        </figure>
      </div>

      {!comparable && (
        // Saying WHY there is one image rather than two. Silence reads as a rendering bug, and
        // the two cases mean opposite things: applied = the work is done and this IS the new
        // file; not applied = nothing was produced because there was nothing to gain.
        <p className={styles.note}>
          {applied && changed
            ? t('image_backfill_applied_single', 'Applied — this is the rewritten file.')
            : t('image_backfill_no_candidate', 'No candidate was written — this is the stored file, unchanged.')}
        </p>
      )}
    </article>
  );
}
