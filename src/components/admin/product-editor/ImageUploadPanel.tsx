import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import adminStyles from '@/app/styles/AdminPage.module.css';
import { ACCEPTED_IMAGE_TYPES_ATTR } from '@/utils/imageUploadRules';
import styles from './ImageUploadPanel.module.css';

interface ImageUploadPanelProps {
  // readonly: S6759 — component props are never mutated.
  readonly stagedFiles: readonly File[];
  /** Drives the label only: "Upload images" on an empty gallery, "Upload more" once it has some. */
  readonly hasImages: boolean;
  readonly isUploading: boolean;
  readonly onStage: (files: File[]) => void;
  readonly onUnstage: (index: number) => void;
  readonly onUpload: () => void;
  readonly onCancel: () => void;
}

/**
 * The gallery's upload affordance (Track F, F7-A): a visible button, a hidden multi-file
 * input, the staged-file chips and the commit/cancel pair.
 *
 * Split out of `ImageGallery` up front rather than after the file-length gate complained —
 * the gallery was 174 of its 250 LOC before this and would not have fitted.
 *
 * Every button is `type="button"`: the gallery renders OUTSIDE the editor's `<form>` today,
 * but a bare `<button>` defaults to `type="submit"` and would submit the product form the day
 * someone nests it.
 */
export default function ImageUploadPanel({
  stagedFiles,
  hasImages,
  isUploading,
  onStage,
  onUnstage,
  onUpload,
  onCancel,
}: ImageUploadPanelProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onStage(Array.from(e.target.files ?? []));
    // Clear the control so re-picking the SAME file still fires a change event (a removed
    // chip is otherwise unrecoverable without picking something else first).
    e.target.value = '';
  };

  return (
    <div className={styles.uploadSection}>
      {stagedFiles.length > 0 && (
        <>
          <ul className={styles.stagedFilesList}>
            {stagedFiles.map((file, index) => (
              <li key={`${file.name}-${file.size}-${file.lastModified}`} className={styles.stagedFileItem}>
                <span>{file.name}</span>
                <button
                  type="button"
                  className={styles.removeStagedFileBtn}
                  aria-label={t('remove')}
                  disabled={isUploading}
                  onClick={() => onUnstage(index)}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.stagedActions}>
            <button
              type="button"
              className={`${adminStyles.adminButton} ${adminStyles.add}`}
              disabled={isUploading}
              onClick={onUpload}
            >
              {isUploading ? t('uploading...') : t('save_uploads')}
            </button>
            <button
              type="button"
              className={`${adminStyles.adminButton} ${adminStyles.delete}`}
              disabled={isUploading}
              onClick={onCancel}
            >
              {t('cancel')}
            </button>
          </div>
        </>
      )}
      <button
        type="button"
        className={`${adminStyles.adminButton} ${adminStyles.add}`}
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {hasImages ? t('upload_more_images') : t('upload_images')}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        // NOT image/*: that is what makes an iPhone offer the .HEIC the server cannot decode.
        accept={ACCEPTED_IMAGE_TYPES_ATTR}
        data-testid="gallery-image-input"
        className={styles.hiddenInput}
        onChange={handleChange}
      />
    </div>
  );
}
