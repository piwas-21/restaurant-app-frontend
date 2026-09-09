'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import StagedImagePicker from '@/components/admin/product/StagedImagePicker';
import styles from './EditorMedia.module.css';

interface BundleMediaPanelProps {
  // readonly: S6759 — component props are never mutated.
  readonly files: File[];
  readonly onChange: (files: File[]) => void;
}

/**
 * The bundle editor\'s Media section — the ONE surface for a bundle\'s photo.
 *
 * A bundle has no gallery (#524): `MenuBundleDto` carries no image rows, so there is nothing
 * server-side to set primary, reorder or delete. What a bundle DOES have is the staged path the
 * create route always had — files picked here ride the next Save (`productFormUtils` uploads
 * them once the bundle endpoint has answered). That path used to sit at the bottom of the
 * Basics column with no actions and no explanation, while THIS section rendered a placeholder
 * saying photo management did not exist: two surfaces disagreeing about one feature, and the
 * truthful one offering no way to undo a mis-picked file.
 *
 * One surface now: pick (a new choice replaces the selection, the shared picker\'s contract),
 * remove a staged file before saving, and a notice saying WHEN the upload happens — the honest
 * counterpart of the gallery\'s "saved immediately" notice, because nothing here writes until
 * the page\'s Save.
 */
export default function BundleMediaPanel({ files, onChange }: BundleMediaPanelProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.section}>
      <StagedImagePicker inputId="bundle-images" label={t('menu_image')} files={files} onChange={onChange} />
      {files.length > 0 && (
        <ul className={styles.stagedList}>
          {files.map((file) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`} className={styles.stagedRow}>
              <span className={styles.stagedName}>{file.name}</span>
              <button
                type="button"
                className={styles.removeButton}
                title={t('editor_media_remove_staged', { name: file.name })}
                aria-label={t('editor_media_remove_staged', { name: file.name })}
                onClick={() => onChange(files.filter((staged) => staged !== file))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.uploadNotice}>{t('editor_media_bundle_upload_notice')}</p>
    </div>
  );
}
