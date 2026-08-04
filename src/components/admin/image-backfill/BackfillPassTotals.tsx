'use client';

import { useTranslation } from 'react-i18next';
import type { BackfillWindowTally } from '@/lib/imageBackfillProgress';
import { formatBytes } from '@/utils/formatBytes';
import styles from './BackfillPassTotals.module.css';

interface BackfillPassTotalsProps {
  /** How many capped windows this pass has covered so far. */
  windows: number;
  totals: BackfillWindowTally;
  /** The scan has reached the end of the library — there is no further window to continue to. */
  finished: boolean;
}

/**
 * How far a multi-window pass has got, as opposed to what the window on screen did.
 *
 * Without this the summary above answers "what happened in the last 500 files", which on a 3000
 * image library reads as the whole job every time — the operator has no way to tell batch 1 from
 * batch 5. The two mutable figures are deliberately HEDGED rather than picking a tense: a pass
 * mixes dry-run windows with applied ones, so the summary's "Would change" and "Rewritten" are
 * each false of the total. "Changed" alone would be the worse of the two, claiming 1800 images
 * were rewritten directly under a window summary reading "Would change 300".
 */
export default function BackfillPassTotals({ windows, totals, finished }: Readonly<BackfillPassTotalsProps>) {
  const { t } = useTranslation();

  // One window makes this an exact duplicate of the summary above it, in different words — which
  // is worse than absent, because two sets of identical numbers invite the reader to look for the
  // difference. It earns its place only once there is a difference to show.
  if (windows < 2) return null;

  const stats: Array<{ key: string; label: string; value: string }> = [
    { key: 'scanned', label: t('image_backfill_scanned', 'Scanned'), value: String(totals.filesScanned) },
    {
      key: 'changed',
      label: t('image_backfill_pass_changed', 'Changed or would change'),
      value: String(totals.filesChanged),
    },
    { key: 'skipped', label: t('image_backfill_skipped', 'Skipped'), value: String(totals.filesSkipped) },
    { key: 'failed', label: t('image_backfill_failed', 'Failed'), value: String(totals.filesFailed) },
    {
      key: 'saved',
      label: t('image_backfill_pass_saved', 'Saved or would save'),
      value: formatBytes(totals.totalBytesSaved),
    },
  ];

  return (
    <section className={styles.pass}>
      <h2 className={styles.heading}>
        {t('image_backfill_pass_heading', {
          count: windows,
          defaultValue: 'Across {{count}} batches so far',
        })}
      </h2>

      <dl className={styles.stats}>
        {stats.map((stat) => (
          <div key={stat.key} className={styles.stat}>
            <dt className={styles.statLabel}>{stat.label}</dt>
            <dd className={styles.statValue}>{stat.value}</dd>
          </div>
        ))}
      </dl>

      {finished && (
        <p className={styles.finished}>
          {t('image_backfill_pass_finished', 'The scan has reached the end of the library.')}
        </p>
      )}
    </section>
  );
}
