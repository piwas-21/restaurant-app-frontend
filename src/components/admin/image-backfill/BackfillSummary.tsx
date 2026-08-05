'use client';

import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { ImageBackfillReport } from '@/services/imageMaintenanceService';
import { formatBytes } from '@/utils/formatBytes';
import styles from './BackfillSummary.module.css';

interface BackfillSummaryProps {
  report: ImageBackfillReport;
}

/** Headline numbers for a run, plus the two states that change what the admin should do next. */
export default function BackfillSummary({ report }: Readonly<BackfillSummaryProps>) {
  const { t } = useTranslation();
  // Derived here because the backend has nowhere to put it: Tally's `default:` arm counts
  // needs-review into FilesSkipped, so the report's own numbers describe the one outcome that
  // requires a human as a routine skip. Without this it is findable only by scrolling up to
  // 500 cards.
  const needsReview = report.entries.filter((entry) => entry.outcome === 'needs-review').length;

  const stats: Array<{ key: string; label: string; value: string }> = [
    {
      key: 'scanned',
      label: t('image_backfill_scanned', 'Scanned'),
      value: String(report.filesScanned),
    },
    {
      key: 'changed',
      label: report.applied
        ? t('image_backfill_rewritten', 'Rewritten')
        : t('image_backfill_would_change', 'Would change'),
      value: String(report.filesChanged),
    },
    {
      key: 'skipped',
      label: t('image_backfill_skipped', 'Skipped'),
      value: String(report.filesSkipped),
    },
    {
      key: 'failed',
      label: t('image_backfill_failed', 'Failed'),
      value: String(report.filesFailed),
    },
    ...(needsReview > 0
      ? [
          {
            key: 'needs-review',
            label: t('image_backfill_outcome_needs_review', 'Needs review'),
            value: String(needsReview),
          },
        ]
      : []),
    {
      key: 'saved',
      label: report.applied ? t('image_backfill_saved', 'Saved') : t('image_backfill_would_save', 'Would save'),
      value: formatBytes(report.totalBytesSaved),
    },
  ];

  return (
    <section className={styles.summary}>
      <div className={styles.badges}>
        <StatusBadge tone={report.applied ? 'success' : 'info'}>
          {report.applied
            ? t('image_backfill_state_applied', 'Applied')
            : t('image_backfill_state_dry_run', 'Dry run — nothing overwritten')}
        </StatusBadge>
        {/* A truncated run looks identical to a complete one in the numbers above, and the
            difference is "you are done" vs "half your library is untouched".

            Which of the two messages applies is a statement about the SERVER, not the run. Backend
            #280 gave the walk a cursor, and the controller clamps maxFiles to at least 1, so on a
            build that has it `truncated` always comes with a `nextCursor`. A truncated run with no
            cursor therefore means exactly one thing: this backend predates #280, re-enumerates from
            the first file with no offset, and counts skips toward the cap — so a second run stops
            at the same file and everything past it really is unreachable. Saying "continue" there
            would be the same false promise this badge used to make unconditionally. */}
        {report.truncated && (
          <StatusBadge tone="warning">
            {report.nextCursor
              ? t('image_backfill_truncated_continue', 'Stopped at the per-run limit — Continue scans the next batch')
              : t(
                  'image_backfill_truncated_no_cursor',
                  'Stopped at the per-run limit — this server build cannot continue past it',
                )}
          </StatusBadge>
        )}
        {needsReview > 0 && (
          <StatusBadge tone="danger">
            {t('image_backfill_needs_review_badge', 'Some files need a human eye before you apply')}
          </StatusBadge>
        )}
        {report.filesFailed > 0 && (
          <StatusBadge tone="danger">
            {t('image_backfill_has_failures', 'Some files could not be processed')}
          </StatusBadge>
        )}
      </div>

      <dl className={styles.stats}>
        {stats.map((stat) => (
          <div key={stat.key} className={styles.stat}>
            <dt className={styles.statLabel}>{stat.label}</dt>
            <dd className={styles.statValue}>{stat.value}</dd>
          </div>
        ))}
      </dl>

      <p className={styles.settings}>
        {t('image_backfill_settings', {
          edge: report.maxImageEdgePixels,
          quality: report.imageQuality,
          defaultValue: 'Longest edge {{edge}} px, quality {{quality}} — the same settings new uploads use.',
        })}
      </p>
    </section>
  );
}
