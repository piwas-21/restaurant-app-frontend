'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import BaseModal from '@/components/design-system/BaseModal';
import { getFullImageUrl } from '@/utils/image';
import type { MenuItemImage } from '@/types/menu';
import styles from './ImageGalleryModal.module.css';

interface ImageGalleryModalProps {
  isOpen: boolean;
  images: MenuItemImage[];
  currentIndex: number;
  /** Dish name — labels the dialog (BaseModal header) + captions each photo. */
  title: string;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onImageError?: () => void;
}

/**
 * Enlarge-on-click image lightbox for the menu cards — restores the gallery
 * removed in f3f1269 (which had rewired the image to open the details modal).
 * Built on `BaseModal` (ESC + backdrop close, portal, scroll-lock, a11y);
 * left/right arrows navigate multi-image items. Template-agnostic — the classic
 * and craft cards share it via `MenuCardImage`.
 */
export default function ImageGalleryModal({
  isOpen,
  images,
  currentIndex,
  title,
  onClose,
  onNext,
  onPrev,
  onImageError,
}: Readonly<ImageGalleryModalProps>) {
  const { t } = useTranslation();
  const hasMultiple = images.length > 1;

  // BaseModal handles ESC; this adds arrow-key navigation for multi-image items.
  //
  // The mapping is by READING ORDER, not by physical key (E8 slice 3). A gallery advances the way
  // its language reads, so in `ar` the next image is to the LEFT — pressing ArrowRight there used
  // to advance while the chevron beside it pointed back, and the two buttons had swapped sides
  // under `inset-inline-*` without the keys following. Direction comes from the document rather
  // than from `i18n.language` so any future RTL locale is covered without touching this file.
  useEffect(() => {
    if (!isOpen || !hasMultiple) return;
    const handler = (e: KeyboardEvent) => {
      const rtl = document.documentElement.dir === 'rtl';
      if (e.key === 'ArrowRight') (rtl ? onPrev : onNext)();
      if (e.key === 'ArrowLeft') (rtl ? onNext : onPrev)();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, hasMultiple, onNext, onPrev]);

  if (!isOpen || images.length === 0) return null;
  const active = images[currentIndex] ?? images[0];

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={title} size="lg" className={styles.galleryDialog}>
      <div className={styles.viewer}>
        {hasMultiple && (
          <button
            type="button"
            className={`${styles.navButton} ${styles.prev}`}
            onClick={onPrev}
            aria-label={t('previous_image_button_label', 'Previous Image')}
          >
            <ChevronLeft size={28} />
          </button>
        )}
        <div className={styles.imageWrapper}>
          <Image
            src={getFullImageUrl(active.url)}
            alt={active.alt || title}
            fill
            quality={100}
            sizes="100vw"
            className={styles.image}
            onError={onImageError}
          />
        </div>
        {hasMultiple && (
          <button
            type="button"
            className={`${styles.navButton} ${styles.next}`}
            onClick={onNext}
            aria-label={t('next_image_button_label', 'Next Image')}
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>
      {hasMultiple && (
        <output className={styles.counter}>
          {currentIndex + 1} / {images.length}
        </output>
      )}
    </BaseModal>
  );
}
