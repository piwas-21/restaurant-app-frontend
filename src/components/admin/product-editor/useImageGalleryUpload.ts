import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProductImage } from '@/app/admin/menu-management/interfaces';
import { uploadBulkProductImages } from '@/services/productService';
import { serverMessage } from '@/utils/apiFormErrors';
import { imageRejectionMessage, partitionAcceptableImages } from '@/utils/imageUploadRules';

/** What `POST /api/Products/{id}/images/bulk` resolves to (it answers 200 even on refusal). */
interface BulkUploadResponse {
  readonly success?: boolean;
  readonly data?: ProductImage[];
  readonly message?: string;
  readonly errors?: unknown;
}

export interface ImageGalleryUpload {
  readonly stagedFiles: readonly File[];
  readonly isUploading: boolean;
  readonly error: string | null;
  readonly stage: (files: File[]) => void;
  readonly unstage: (index: number) => void;
  readonly cancel: () => void;
  readonly upload: () => void;
}

/** Non-blank text, or null — the server's `message` is often the empty-ish default. */
const presentable = (text: unknown): string | null =>
  typeof text === 'string' && text.trim().length > 0 ? text : null;

/**
 * The gallery's own upload path (Track F, F7-A).
 *
 * Upload was dropped from the gallery by the slice-7 rewrite (#215, `e4e487d`) because its
 * "Save uploads" button read as a rival Save. It comes back the way set-primary and delete
 * came back: as an IMMEDIATE write to the image sub-resource, which is the rule that slice
 * actually established — the staged-then-page-Save path stays on the create route only,
 * where there is no product id to POST against yet.
 *
 * Lives here rather than in `useProductEditorForm` on purpose: that hook owns the product
 * form, and an image upload must never touch its dirty state or reset it.
 */
export function useImageGalleryUpload(
  productId: string,
  onUploaded: (images: ProductImage[]) => void,
): ImageGalleryUpload {
  const { t, i18n } = useTranslation();
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refuse what the server would refuse, before the round trip (Track F, F1c). `accept` narrows
  // the dialog; this catches what it let through anyway — its "All files" escape, a drag-and-drop,
  // and a 12 MB photo, whose type is perfectly fine.
  const stage = (files: File[]) => {
    if (files.length === 0) return;
    const selection = partitionAcceptableImages(files);
    setError(imageRejectionMessage(t, selection, i18n.language));
    if (selection.accepted.length === 0) return;
    setStagedFiles((current) => [...current, ...selection.accepted]);
  };

  const unstage = (index: number) => setStagedFiles((current) => current.filter((_, i) => i !== index));

  const cancel = () => {
    setStagedFiles([]);
    setError(null);
  };

  const runUpload = async (files: File[]) => {
    try {
      const response = (await uploadBulkProductImages(productId, files)) as BulkUploadResponse;
      const uploaded = response.data ?? [];
      if (uploaded.length > 0) {
        setStagedFiles([]);
        onUploaded(uploaded);
      }
      // A total refusal still arrives as HTTP 200 with `data: []` today (Track F, F1) — so an
      // empty list IS the failure, whatever `success` says. Prefer the server's own reason:
      // once F1b lands it names the file it rejected, which the generic never can.
      if (response.success === false || uploaded.length < files.length) {
        setError(serverMessage(response) ?? presentable(response.message) ?? t('image_update_failed'));
      }
    } catch (e) {
      console.error('ImageGallery: image upload failed', e);
      setError(t('image_update_failed'));
    } finally {
      setIsUploading(false);
    }
  };

  const upload = () => {
    if (stagedFiles.length === 0 || isUploading) return;
    setIsUploading(true);
    setError(null);
    void runUpload(stagedFiles);
  };

  return { stagedFiles, isUploading, error, stage, unstage, cancel, upload };
}
