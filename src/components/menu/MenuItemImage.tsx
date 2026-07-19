'use client';

import Image from 'next/image';
import styles from './MenuItemImage.module.css';
import { getFullImageUrl } from '@/utils/image';

type Props = {
  imageUrl: string;
  alt: string;
  imageCount?: number;
  countLabel?: string;
  /**
   * Accessible name for the enlarge-on-click button. Deliberately distinct from
   * `alt` (the dish name): the card title is already a button carrying the dish
   * name, so reusing it here would collide for screen-reader/test lookups.
   */
  enlargeLabel: string;
  onClick: () => void;
  onError?: () => void;
};

export default function MenuItemImage({
  imageUrl,
  alt,
  imageCount,
  countLabel,
  enlargeLabel,
  onClick,
  onError,
}: Readonly<Props>) {
  const fullUrl = getFullImageUrl(imageUrl);
  return (
    // A real <button> (not a div+role): natively focusable and Enter/Space
    // activated, so the enlarge affordance is keyboard-accessible with no custom
    // key handling. `enlargeLabel` gives it an accessible name distinct from the
    // dish title. `.itemImageContainer` resets the native button chrome.
    <button
      type="button"
      className={styles.itemImageContainer}
      onClick={onClick}
      aria-label={enlargeLabel}
      data-testid="menu-item-image"
    >
      <Image
        src={fullUrl}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className={styles.itemImage}
        priority={false}
        quality={100}
        loading="eager"
        onError={onError}
      />
      {imageCount && imageCount > 1 && (
        <span className={styles.imageCount}>
          {imageCount} {countLabel}
        </span>
      )}
    </button>
  );
}
