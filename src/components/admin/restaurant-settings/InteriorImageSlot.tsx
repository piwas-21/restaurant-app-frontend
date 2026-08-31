'use client';

import Image from 'next/image';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './LogoTab.module.css';

export interface InteriorImageSlotProps {
  /** The stored photo, or null when the restaurant has none. */
  currentUrl: string | null;
  restaurantName: string;
  isBusy: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}

/**
 * The restaurant's full-width landing background — preview, file picker and remove control.
 *
 * A sibling of {@link LogoSlot} rather than a reuse of it: the two differ in the one thing
 * that matters. An empty logo slot previews the restaurant's NAME, because that is literally
 * what the header will render. An empty background slot previews the honest fallback state: the platform artwork remains behind
 * the welcome text until the restaurant uploads its own image.
 */
export default function InteriorImageSlot({
  currentUrl,
  restaurantName,
  isBusy,
  onUpload,
  onRemove,
}: Readonly<InteriorImageSlotProps>) {
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
        {t('interior_photo_title', 'Landing background')}
      </h3>
      <p className={styles.slotHint}>
        {t(
          'interior_photo_hint',
          'Shown full-width behind your welcome text on the home page. Without an upload, the platform background is used.',
        )}
      </p>

      <div className={styles.photoPreview}>
        {currentUrl ? (
          <Image
            src={currentUrl}
            alt={t('home_interior_alt', 'Landing background for {{name}}', { name: restaurantName })}
            width={480}
            height={320}
            className={styles.photoImage}
          />
        ) : (
          <span className={styles.photoEmpty}>{t('interior_photo_empty', 'Using the default background')}</span>
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
        {/* The three button words are shared with the logo slots on purpose — they are generic
            verbs, and a second set of identical strings in ten locales is a drift risk. */}
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
