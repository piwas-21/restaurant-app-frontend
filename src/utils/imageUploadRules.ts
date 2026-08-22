import type { TFunction } from 'i18next';
import { formatBytes } from '@/utils/formatBytes';

/**
 * What the picker may offer, and what the server will actually take.
 *
 * Both values mirror the backend's own configuration verbatim
 * (`appsettings.json` `FileStorage:AllowedExtensions` / `AllowedMimeTypes` / `MaxFileSizeBytes`,
 * enforced in `UploadMultipleProductImagesCommand`). They are duplicated here on purpose: the
 * point of the client-side check is to stop a file BEFORE a round trip that answers HTTP 200 and
 * says "Uploaded 0 images. 1 failed." (Track F, F1).
 *
 * **`accept` is not `image/*`, and that is the whole trick.** `image/*` makes an iPhone offer the
 * `.HEIC` its camera actually writes — a format ImageSharp 3.1.12 cannot decode, so the server
 * refuses it whatever the client does. Narrowing `accept` is what stops the file being offered at
 * all; the camera then hands over a JPEG. Adding HEIC support is a backend decision, not this one.
 */
export const ACCEPTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** The `accept` attribute for every product-image picker. */
export const ACCEPTED_IMAGE_TYPES_ATTR = ACCEPTED_IMAGE_MIME_TYPES.join(',');

/** `FileStorage:MaxFileSizeBytes` — 10 MB. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface ImageSelection {
  /** The files worth sending. */
  readonly accepted: File[];
  /** Rejected client-side, with a translated reason — never silently dropped. */
  readonly oversized: File[];
  readonly wrongType: File[];
}

/**
 * Split a picked batch into what the server would take and what it would refuse.
 *
 * `accept` is a filter on the file dialog, not a guarantee: every desktop dialog offers an "All
 * files" escape, and a drag-and-drop bypasses it entirely. So the type is re-checked here.
 *
 * The size is checked on the ORIGINAL file, before `compressImageForUpload` has run. Compression
 * is best-effort and FAILS OPEN (a failed dynamic import or an unsupported codec returns the
 * original untouched), so the original is the only size that is certain to be sendable.
 */
export function partitionAcceptableImages(files: File[]): ImageSelection {
  const accepted: File[] = [];
  const oversized: File[] = [];
  const wrongType: File[] = [];

  for (const file of files) {
    if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number])) {
      wrongType.push(file);
    } else if (file.size > MAX_IMAGE_BYTES) {
      oversized.push(file);
    } else {
      accepted.push(file);
    }
  }

  return { accepted, oversized, wrongType };
}

/** The name list a rejection message quotes back, so the admin knows WHICH file was dropped. */
export const fileNames = (files: File[]): string => files.map((f) => f.name).join(', ');

/** The limit as the reader's locale writes it (`formatBytes` is locale-aware). */
export const maxImageSizeLabel = (locale?: string): string => formatBytes(MAX_IMAGE_BYTES, locale);

/**
 * The translated sentence for what was refused before it was ever sent, or `null` when nothing
 * was. Both halves are named separately because the remedy differs: one is "shrink it", the
 * other is "export it as JPEG".
 */
export function imageRejectionMessage(t: TFunction, selection: ImageSelection, locale?: string): string | null {
  const parts: string[] = [];
  if (selection.oversized.length > 0) {
    parts.push(t('images_too_large', { limit: maxImageSizeLabel(locale), files: fileNames(selection.oversized) }));
  }
  if (selection.wrongType.length > 0) {
    parts.push(t('images_wrong_type', { files: fileNames(selection.wrongType) }));
  }
  return parts.length > 0 ? parts.join(' ') : null;
}
