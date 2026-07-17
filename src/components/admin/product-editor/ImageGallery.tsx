'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { ProductImage } from '@/app/admin/menu-management/interfaces';
import detailsStyles from '@/app/styles/DetailsPage.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import ImageActions from './ImageActions';
import { updateProductImageDetails, deleteProductImage } from '@/services/productService';
import ConfirmationModal from '@/components/common/ConfirmationModal';

interface ImageGalleryProps {
  // readonly: S6759 — component props are never mutated.
  readonly productId: string;
  /** Initial seed; re-seeds when the parent refetches (e.g. after a form Save uploads new ones). */
  readonly images: ProductImage[];
  readonly productName: string;
}

// Pure optimistic-update transforms for the image list, hoisted so the handlers below stay
// flat (nesting them inline trips S2004's 4-deep function limit).
const withPrimary = (list: ProductImage[], id: string): ProductImage[] =>
  list.map((img) => ({ ...img, isPrimary: img.id === id }));

const withSortOrder = (list: ProductImage[], id: string, sortOrder: number): ProductImage[] =>
  list.map((img) => (img.id === id ? { ...img, sortOrder } : img)).sort((a, b) => a.sortOrder - b.sortOrder);

const withoutImage = (list: ProductImage[], id: string): ProductImage[] => list.filter((img) => img.id !== id);

/**
 * Existing-image management on the unified editor (menu-bundles #176, slice 7 PR2e).
 *
 * Re-added after PR2d dropped it, and migrated rather than re-hung: image sub-resources have
 * their own endpoints (`/Products/{id}/images/{imageId}`) that the product-level Save can't
 * carry, so set-primary / reorder / delete apply IMMEDIATELY here (owner call — "immediate,
 * no rival Save") instead of behind a second Save button that would compete with the page's.
 *
 * The gallery is DELIBERATELY decoupled from the page's product/form: it holds its own image
 * list and updates it optimistically after each successful op. It must NOT refetch the page's
 * product, because that route flips a full-page loader and re-runs the form's reset effect —
 * which would silently discard the admin's unsaved form edits. NEW uploads are not here; the
 * form's file input stages them onto the page Save, after which the refetched `images` prop
 * re-seeds this list.
 */
export default function ImageGallery({ productId, images, productName }: ImageGalleryProps) {
  const { t } = useTranslation();
  const [imageList, setImageList] = useState<ProductImage[]>(images ?? []);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [sortValue, setSortValue] = useState(0);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed when the parent hands down a fresh list (a form Save refetch); the immediate ops
  // below keep this list in sync in between, so a gallery op never needs the parent to refetch.
  useEffect(() => {
    setImageList(images ?? []);
  }, [images]);

  const selectedImage = imageList.find((img) => img.id === selectedImageId) ?? null;

  // Keep a valid selection as the list changes: hold the current image if it survives, else
  // fall back to the primary (or the first). Sync the sort buffer to it.
  useEffect(() => {
    const stillPresent = imageList.find((img) => img.id === selectedImageId);
    const next = stillPresent ?? imageList.find((img) => img.isPrimary) ?? imageList[0] ?? null;
    if (next?.id !== selectedImageId) setSelectedImageId(next?.id ?? null);
    setSortValue(next?.sortOrder ?? 0);
  }, [imageList, selectedImageId]);

  const run = async (op: () => Promise<unknown>, onSuccess: () => void) => {
    setIsSaving(true);
    setError(null);
    try {
      await op();
      onSuccess();
    } catch (e) {
      console.error('ImageGallery: image operation failed', e);
      setError(t('image_update_failed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPrimary = () => {
    if (!selectedImage || selectedImage.isPrimary) return;
    const id = selectedImage.id;
    void run(
      () => updateProductImageDetails(productId, id, { ...selectedImage, isPrimary: true }),
      // The backend unsets the previous primary, so mirror that locally.
      () => setImageList((list) => withPrimary(list, id)),
    );
  };

  const handleSortCommit = () => {
    if (!selectedImage || sortValue === selectedImage.sortOrder) return;
    const id = selectedImage.id;
    const sortOrder = sortValue;
    void run(
      () => updateProductImageDetails(productId, id, { ...selectedImage, sortOrder }),
      () => setImageList((list) => withSortOrder(list, id, sortOrder)),
    );
  };

  const handleConfirmDelete = () => {
    if (!selectedImage) return;
    const id = selectedImage.id;
    setIsConfirmationOpen(false);
    void run(
      () => deleteProductImage(productId, id),
      () => setImageList((list) => withoutImage(list, id)),
    );
  };

  if (imageList.length === 0) {
    return (
      <div className={detailsStyles.infoSection}>
        <h3>{t('image_gallery')}</h3>
        <p>{t('no_images_yet')}</p>
      </div>
    );
  }

  return (
    <div className={detailsStyles.infoSection}>
      <h3>{t('image_gallery')}</h3>
      {error && <p className={modalStyles.errorMessage}>{error}</p>}
      <div className={detailsStyles.imageGalleryContainer}>
        <div className={detailsStyles.primaryImageContainer}>
          {selectedImage?.url && (
            <Image
              src={selectedImage.url}
              alt={selectedImage.altText || productName}
              className={detailsStyles.primaryImage}
              width={1200}
              height={800}
            />
          )}
        </div>
        <div className={detailsStyles.thumbnailContainer}>
          {imageList.map((img) => (
            <Image
              key={img.id}
              src={img.url}
              alt={img.altText}
              className={`${detailsStyles.thumbnail} ${selectedImageId === img.id ? detailsStyles.active : ''}`}
              width={160}
              height={80}
              onClick={() => setSelectedImageId(img.id)}
            />
          ))}
        </div>
        {selectedImage && (
          <ImageActions
            isPrimary={selectedImage.isPrimary}
            sortOrder={sortValue}
            disabled={isSaving}
            onSetPrimary={handleSetPrimary}
            onSortOrderChange={(e) => setSortValue(Number.parseInt(e.target.value, 10) || 0)}
            onSortOrderCommit={handleSortCommit}
            onDelete={() => setIsConfirmationOpen(true)}
          />
        )}
      </div>
      <ConfirmationModal
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        onConfirm={handleConfirmDelete}
        message={t('delete_image_confirmation_message')}
      />
    </div>
  );
}
