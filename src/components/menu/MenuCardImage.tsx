'use client';

import MenuItemImage from './MenuItemImage';
import ImageGalleryModal from './ImageGalleryModal';
import { useImageGallery } from '@/hooks/menu/useImageGallery';
import type { MenuItemImage as MenuItemImageType } from '@/types/menu';

interface MenuCardImageProps {
  imageUrl: string;
  alt: string;
  /** Full gallery; falls back to the single primary image when absent/empty. */
  images?: MenuItemImageType[];
  imageCount?: number;
  countLabel?: string;
  /** Accessible name for the enlarge-on-click button (distinct from the dish name). */
  enlargeLabel: string;
  onError?: () => void;
}

/**
 * The menu card's thumbnail + its enlarge-on-click gallery lightbox, shared by
 * the classic and craft cards. Clicking the image opens the photos bigger
 * (restored after f3f1269 rewired the image to open the details modal); the
 * card's title/Add/Details still open the customization sheet. When closed the
 * lightbox renders nothing, so the card's DOM is unchanged.
 */
export default function MenuCardImage({
  imageUrl,
  alt,
  images,
  imageCount,
  countLabel,
  enlargeLabel,
  onError,
}: Readonly<MenuCardImageProps>) {
  const gallery = images && images.length > 0 ? images : [{ url: imageUrl, alt }];
  const state = useImageGallery(gallery.length);

  return (
    <>
      <MenuItemImage
        imageUrl={imageUrl}
        alt={alt}
        imageCount={imageCount}
        countLabel={countLabel}
        enlargeLabel={enlargeLabel}
        onClick={() => state.open()}
        onError={onError}
      />
      <ImageGalleryModal
        isOpen={state.isOpen}
        images={gallery}
        currentIndex={state.index}
        title={alt}
        onClose={state.close}
        onNext={state.next}
        onPrev={state.prev}
        onImageError={onError}
      />
    </>
  );
}
