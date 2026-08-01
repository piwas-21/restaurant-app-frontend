'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import AlertDialog from '@/components/design-system/AlertDialog';
import BackfillEntryCard from '@/components/admin/image-backfill/BackfillEntryCard';
import BackfillSummary from '@/components/admin/image-backfill/BackfillSummary';
import { useImageBackfill } from '@/hooks/admin/useImageBackfill';
import styles from './styles.module.css';

/**
 * Bring images uploaded before resize-on-upload into line with the same pipeline.
 *
 * Every tenant arriving with an existing photo library needs this once (RUMI's own was 195 MB).
 * The flow is deliberately two-step: preview, look at the pairs, then apply — because applying
 * overwrites the originals and the only way back is the nightly backup.
 */
function ImageBackfillPage() {
  const { t } = useTranslation();
  const { report, busy, error, notice, preview, apply, clearPreviews, applyEnabled } = useImageBackfill();
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
          <button type="button" className={styles.secondary} onClick={clearPreviews} disabled={busy !== null}>
            {t('image_backfill_clear_previews', 'Clear previews')}
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {notice && <p className={styles.notice}>{notice}</p>}

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
