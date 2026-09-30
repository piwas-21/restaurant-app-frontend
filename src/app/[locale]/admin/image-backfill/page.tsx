'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import AlertDialog from '@/components/design-system/AlertDialog';
import BackfillEntryCard from '@/components/admin/image-backfill/BackfillEntryCard';
import BackfillPassTotals from '@/components/admin/image-backfill/BackfillPassTotals';
import BackfillSummary from '@/components/admin/image-backfill/BackfillSummary';
import { useImageBackfill } from '@/hooks/admin/useImageBackfill';
import styles from './styles.module.css';

/**
 * Bring images uploaded before resize-on-upload into line with the same pipeline.
 *
 * Every tenant arriving with an existing photo library needs this once (RUMI's own was 195 MB).
 * The flow is deliberately two-step: preview, look at the pairs, then apply — because applying
 * overwrites the originals and the only way back is the nightly backup.
 *
 * A library larger than one capped window is walked one batch at a time: Preview and Apply always
 * act on the SAME batch, and Continue is the only thing that moves to the next one — so the
 * two-step flow holds for every batch rather than just the first.
 */
function ImageBackfillPage() {
  const { t } = useTranslation();
  const {
    report,
    busy,
    error,
    notice,
    preview,
    continueScan,
    apply,
    clearPreviews,
    startOver,
    applyEnabled,
    canContinue,
    resumed,
    passWindows,
    passTotals,
    passFinished,
  } = useImageBackfill();
  const [confirming, setConfirming] = useState(false);

  return (
    <AdminAuthGuard requiredRoles={['Admin']}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t('admin_image_backfill_title', 'Image Backfill')}</h1>
          <p className={styles.subtitle}>
            {t(
              'image_backfill_intro',
              'Images uploaded before automatic resizing are still full-size. Preview what the resize would do, compare the pairs, then apply.',
            )}
          </p>
        </header>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={preview} disabled={busy !== null}>
            {busy === 'preview' ? t('image_backfill_scanning', 'Scanning…') : t('image_backfill_preview', 'Preview')}
          </button>
          <button
            type="button"
            className={styles.danger}
            onClick={() => setConfirming(true)}
            disabled={busy !== null || !applyEnabled}
          >
            {busy === 'apply' ? t('image_backfill_applying', 'Applying…') : t('image_backfill_apply', 'Apply')}
          </button>
          {/* Rendered only once the report on screen carries a cursor, so on a backend that
              predates #280 the page is exactly what it was: no dead control offering a
              continuation the server cannot perform.

              …and while its OWN scan is running, because `continueScan` drops the report as it
              advances — so `canContinue` goes false the instant the button is clicked. Without the
              second arm the control vanishes mid-request and the page shows nothing at all for the
              length of a 500-image server-side decode: no label, no spinner, every button greyed.
              That is the "looks finished but is not" failure this whole change exists to remove. */}
          {(canContinue || busy === 'continue') && (
            <button type="button" className={styles.secondary} onClick={continueScan} disabled={busy !== null}>
              {busy === 'continue'
                ? t('image_backfill_scanning', 'Scanning…')
                : t('image_backfill_continue', 'Continue')}
            </button>
          )}
          <button type="button" className={styles.secondary} onClick={clearPreviews} disabled={busy !== null}>
            {t('image_backfill_clear_previews', 'Clear previews')}
          </button>
          {resumed && (
            <button type="button" className={styles.secondary} onClick={startOver} disabled={busy !== null}>
              {t('image_backfill_start_over', 'Start over')}
            </button>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {notice && <p className={styles.notice}>{notice}</p>}

        <BackfillPassTotals windows={passWindows} totals={passTotals} finished={passFinished} />

        {report && (
          <>
            <BackfillSummary report={report} />
            {report.entries.length === 0 ? (
              <p className={styles.empty}>
                {t('image_backfill_nothing_to_do', 'Nothing to do — every stored image is already within the limits.')}
              </p>
            ) : (
              <div className={styles.entries}>
                {report.entries.map((entry) => (
                  <BackfillEntryCard key={entry.relativePath} entry={entry} applied={report.applied} />
                ))}
              </div>
            )}
          </>
        )}

        <AlertDialog
          isOpen={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            await apply();
            setConfirming(false);
          }}
          isConfirming={busy === 'apply'}
          variant="danger"
          title={t('image_backfill_confirm_title', 'Overwrite the original images?')}
          // Type-to-confirm, which this primitive supports and which is proportionate here: the
          // action rewrites a tenant's whole photo library in place and the only way back is the
          // nightly backup. A misclick should not be able to reach that.
          confirmationText={t('image_backfill_confirm_word', 'APPLY')}
          confirmLabel={t('image_backfill_apply', 'Apply')}
        >
          {t('image_backfill_confirm_body', {
            count: report?.filesChanged ?? 0,
            defaultValue:
              'This rewrites {{count}} image(s) in place. It cannot be undone from here — the only way back is the nightly backup.',
          })}
        </AlertDialog>
      </div>
    </AdminAuthGuard>
  );
}

export default ImageBackfillPage;
