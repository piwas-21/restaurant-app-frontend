'use client';

import Image from 'next/image';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { LogoVariant } from '@/types/restaurantInfo';
import styles from './LogoTab.module.css';

export interface LogoSlotProps {
  variant: LogoVariant;
  title: string;
  hint: string;
  /** The stored logo, or null when this slot is empty. */
  currentUrl: string | null;
  restaurantName: string;
  isBusy: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}

/**
 * One logo slot — light or dark — with its preview, file picker and remove control.
 *
 * The two slots are identical in everything but their copy and which endpoint they hit, so
 * this exists to keep them from drifting into two different answers to the same question.
 * The empty state deliberately previews the restaurant's NAME rather than a placeholder
 * image: that is literally what the site will show, so the admin sees the real fallback
 * instead of a grey box that appears nowhere.
 */
export default function LogoSlot({
  variant,
  title,
  hint,
  currentUrl,
  restaurantName,
  isBusy,
  onUpload,
  onRemove,
}: LogoSlotProps) {
  const { t } = useTranslation();
  const inputId = useId();

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onUpload(file);
    // Clear the input so re-picking the SAME file fires change again — otherwise a failed
    // upload cannot be retried with the identical file without choosing another one first.
    event.target.value = '';
  };

  return (
    <section className={styles.slot} aria-labelledby={`${inputId}-title`}>
      <h3 id={`${inputId}-title`} className={styles.slotTitle}>
        {title}
      </h3>
      <p className={styles.slotHint}>{hint}</p>

      <div className={`${styles.preview} ${variant === 'dark' ? styles.previewDark : ''}`}>
        {currentUrl ? (
          // alt carries the slot title too: both previews are otherwise "current logo",
          // which leaves a screen-reader user unable to tell light from dark.
          <Image
            src={currentUrl}
            alt={`${t('logo_preview_alt', 'Current logo')}: ${title}`}
            width={180}
            height={90}
            className={styles.previewImage}
          />
        ) : (
          <span className={styles.previewFallback}>{restaurantName}</span>
        )}
      </div>

      <div className={styles.actions}>
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={styles.fileInput}
          onChange={pick}
          disabled={isBusy}
        />
        <label htmlFor={inputId} className={styles.uploadButton} aria-disabled={isBusy}>
          {currentUrl ? t('logo_replace', 'Replace') : t('logo_upload', 'Upload')}
        </label>
        {currentUrl && (
          <button type="button" className={styles.removeButton} onClick={onRemove} disabled={isBusy}>
            {t('logo_remove', 'Remove')}
          </button>
        )}
      </div>
    </section>
  );
}
