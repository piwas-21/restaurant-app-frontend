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
 * The bundle CREATE route's staged Media section.
 *
 * This panel exists because a bundle being CREATED has no product id yet, so there is nothing to
 * upload against until the bundle endpoint has answered — files picked here ride the next Save
 * (`productFormUtils` uploads them once it has): pick (a new choice replaces the selection, the
 * shared picker's contract), remove a staged file before saving, and a notice saying WHEN the
 * upload happens.
 *
 * A SAVED bundle no longer renders this panel at all: `MenuBundleDto` DOES carry `images` (they
 * are ProductImages on the bundle's product row), so `editorSections` gives it the same managed
 * `ImageGallery` an item gets. Rendering this panel on the edit route instead is what hid five
 * uploaded photos behind an empty Media section with nothing to remove or replace — 2026-09-10
 * partner feedback, and the wrong assumption this file was built on ("carries no image rows") is
 * recorded here so it does not get re-derived.
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
