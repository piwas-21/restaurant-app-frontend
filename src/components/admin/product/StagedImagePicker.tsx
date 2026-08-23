import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import { ACCEPTED_IMAGE_TYPES_ATTR, imageRejectionMessage, partitionAcceptableImages } from '@/utils/imageUploadRules';

interface StagedImagePickerProps {
  // readonly: S6759 — component props are never mutated.
  readonly inputId: string;
  readonly label: string;
  readonly files: File[];
  readonly onChange: (files: File[]) => void;
}

/**
 * The CREATE-route file input, for both a product and a menu bundle (Track F, F1c).
 *
 * Shared because the two call sites had drifted into two copies of the same six lines, and the
 * check they were both missing has to be in both: `accept` is narrowed to exactly what the server
 * stores, and anything the dialog let through anyway (its "All files" escape, or a drag-and-drop)
 * is refused HERE, with the file named, rather than by a round trip that answers HTTP 200 saying
 * "Uploaded 0 images. 1 failed."
 */
export default function StagedImagePicker({ inputId, label, files, onChange }: StagedImagePickerProps) {
  const { t, i18n } = useTranslation();
  const [rejected, setRejected] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selection = partitionAcceptableImages(Array.from(e.target.files ?? []));
    setRejected(imageRejectionMessage(t, selection, i18n.language));
    onChange(selection.accepted);
  };

  return (
    <div className={modalStyles.formGroup}>
      <label htmlFor={inputId}>
        {label} {t('optional')}
      </label>
      <input id={inputId} type="file" multiple accept={ACCEPTED_IMAGE_TYPES_ATTR} onChange={handleChange} />
      {files.length > 0 && <p>{t('files_selected', { count: files.length })}</p>}
      {rejected && <p className={modalStyles.errorMessage}>{rejected}</p>}
    </div>
  );
}
