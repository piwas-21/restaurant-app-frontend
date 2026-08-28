'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { CloudUpload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProductImage } from '@/app/admin/menu-management/interfaces';
import detailsStyles from '@/app/styles/DetailsPage.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import mediaStyles from './EditorMedia.module.css';
import ImageActions from './ImageActions';
import ImageUploadPanel from './ImageUploadPanel';
import { useImageGalleryUpload } from './useImageGalleryUpload';
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

// Freshly uploaded images append: the bulk handler assigns each one `max(sortOrder) + 1` and
// only makes one primary when the product had none, so nothing existing changes underneath us.
const withUploaded = (list: ProductImage[], added: ProductImage[]): ProductImage[] =>
  [...list.filter((img) => !added.some((a) => a.id === img.id)), ...added].sort((a, b) => a.sortOrder - b.sortOrder);

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
 * which would silently discard the admin's unsaved form edits.
 *
 * Upload lives here too since Track F, F7-A. It was dropped by the rewrite this comment used to
 * describe (#215, `e4e487d`) — leaving the only way to add a photo a naked file input at the far
 * top of the page — and comes back as the same kind of IMMEDIATE sub-resource write as the ops
 * above, so it is still not a rival Save. The staged-then-page-Save input survives on the create
 * route only, where there is no product id yet.
 */
export default function ImageGallery({ productId, images, productName }: ImageGalleryProps) {
  const { t } = useTranslation();
  const [imageList, setImageList] = useState<ProductImage[]>(images ?? []);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [sortValue, setSortValue] = useState(0);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploader = useImageGalleryUpload(productId, (added) => setImageList((list) => withUploaded(list, added)));

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

  // One shape for both states rather than an early return: an empty gallery used to be a dead
  // sentence with no way out of it, and it is exactly the product that most needs the upload.
  return (
    <div className={detailsStyles.infoSection}>
      {/*
       * No heading here (conformance gap G16). The section CARD already draws `<h2>Media</h2>`
       * with "Photos and gallery assets" under it, so the old `<h3>Image Gallery</h3>` was a
       * second title for the same box — two headings, one thing. The approved screen shows one.
       */}
      {(error ?? uploader.error) && <p className={modalStyles.errorMessage}>{error ?? uploader.error}</p>}
      {imageList.length === 0 ? (
        <p>{t('no_images_yet')}</p>
      ) : (
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
      )}
      <ImageUploadPanel
        stagedFiles={uploader.stagedFiles}
        hasImages={imageList.length > 0}
        isUploading={uploader.isUploading}
        onStage={uploader.stage}
        onUnstage={uploader.unstage}
        onUpload={uploader.upload}
        onCancel={uploader.cancel}
      />
      <ConfirmationModal
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        onConfirm={handleConfirmDelete}
        message={t('delete_image_confirmation_message')}
      />
      {/*
       * D5's notice, and the point of the whole section: every control above writes to an image
       * sub-resource endpoint the moment it is clicked, while everything else on this page waits
       * for Save. The API gives no choice about that — there is no batch image write — so the
       * only honest thing left is to say it, and to say it ALWAYS rather than as a toast that has
       * already gone by the time the admin wonders.
       *
       * Static text, NOT a live region: its content never changes, so `role="status"` would
       * announce nothing and merely claim otherwise. It is read in place, with the gallery.
       */}
      <p className={mediaStyles.autosaveNotice}>
        <CloudUpload size={16} className={mediaStyles.autosaveIcon} aria-hidden="true" />
        {t('editor_media_autosave_notice')}
      </p>
    </div>
  );
}
