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
}

/**
 * One image, before and after.
 *
 * Both sides are plain `<img>` on purpose. `next/image` would re-encode each URL through the
 * optimizer, so the page would be comparing two Next-generated derivatives rather than the
 * bytes actually in storage — a before/after that can only ever look acceptable. Judging the
 * real output is the entire point of this screen, so the lint rule loses here.
 */
export default function BackfillEntryCard({ entry }: BackfillEntryCardProps) {
  const { t } = useTranslation();
  const after = entry.previewUrl ?? entry.originalUrl;
  const changed = entry.outcome === 'resized' || entry.outcome === 'recompressed';

  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <h3 className={styles.path}>{entry.relativePath}</h3>
        <StatusBadge tone={OUTCOME_TONE[entry.outcome]}>
          {t(`image_backfill_outcome_${entry.outcome.replace(/-/g, '_')}`, entry.outcome)}
        </StatusBadge>
      </header>

      <div className={styles.cols}>
        <figure className={styles.figure}>
          {/* eslint-disable-next-line @next/next/no-img-element -- real stored bytes, see above */}
          <img src={entry.originalUrl} alt="" className={styles.image} loading="lazy" />
          <figcaption className={styles.caption}>
            {t('image_backfill_before', 'Before')} — {entry.originalWidth}×{entry.originalHeight},{' '}
            {formatBytes(entry.originalBytes)}
          </figcaption>
        </figure>

        <figure className={styles.figure}>
          {/* eslint-disable-next-line @next/next/no-img-element -- real stored bytes, see above */}
          <img src={after} alt="" className={styles.image} loading="lazy" />
          <figcaption className={styles.caption}>
            {t('image_backfill_after', 'After')} — {entry.newWidth}×{entry.newHeight}, {formatBytes(entry.newBytes)}
            {changed && entry.bytesSaved > 0 && <span className={styles.saved}> −{formatBytes(entry.bytesSaved)}</span>}
          </figcaption>
        </figure>
      </div>

      {!entry.previewUrl && !changed && (
        // Without this the two panes show the same file twice with no explanation, which reads
        // as a rendering bug rather than as "there was nothing to do".
        <p className={styles.note}>
          {t('image_backfill_no_candidate', 'No candidate was written — both panes show the stored file.')}
        </p>
      )}
    </article>
  );
}
