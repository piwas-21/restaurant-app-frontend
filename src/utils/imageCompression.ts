import type { Options } from 'browser-image-compression';

// Mirrors the backend resize-on-upload target (1600px longest edge). Compressing client-side only
// cuts upload bandwidth; the backend re-encode remains the authoritative guarantee, so this is
// deliberately best-effort and fails open.
//
// useWebWorker is FALSE on purpose: with it on, the library spins a blob: worker that then
// importScripts()es ITSELF from the jsDelivr CDN — both blocked by our CSP (no worker-src; script-src
// excludes blob:/cdn), so it only yields console noise + a latent third-party-CDN vector before
// falling back to the main thread anyway. A one-off 1600px re-encode on the main thread is fine for a
// rare, deliberate admin upload.
const COMPRESSION_OPTIONS: Options = {
  maxWidthOrHeight: 1600,
  maxSizeMB: 2,
  useWebWorker: false,
  initialQuality: 0.82,
};

// Formats we don't re-encode client-side (animated GIF, vector SVG) — pass through untouched.
const SKIP_TYPES = new Set(['image/gif', 'image/svg+xml']);

/**
 * Best-effort client-side downscale/compress of a single image before upload. Returns the original
 * file unchanged for non-images / skipped types, or on any failure (the backend still resizes), and
 * keeps the compressed result only when it is actually smaller.
 *
 * ALWAYS resolves with a real `File` whose `.name` is the original filename — upload call sites
 * append it to a `FormData`, and the browser only sends a filename for a genuine `File`.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || SKIP_TYPES.has(file.type)) {
    return file;
  }
  try {
    // Dynamic import so the ~30 KB library is a lazy chunk (loaded only when an admin actually
    // uploads) and never ships in the customer bundle that pulls in productService.
    const { default: imageCompression } = await import('browser-image-compression');
    const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
    // browser-image-compression returns a BLOB (its `.name` is a plain expando the FormData spec
    // ignores), so appending it sends filename="blob" and the backend's extension allowlist rejects
    // every compressed photo. Re-wrap in a real File carrying the ORIGINAL name before anything else
    // looks at the result — this is the invariant every upload call site rests on.
    const named = new File([compressed], file.name, {
      type: compressed.type || file.type,
      lastModified: file.lastModified,
    });
    // Keep the result only if it actually helped and isn't empty/truncated.
    return named.size > 0 && named.size < file.size ? named : file;
  } catch {
    // IGNORED ON PURPOSE: compression is an optimisation, not a requirement. A failed dynamic
    // import or an unsupported codec must not block the admin's upload — the original file is
    // still valid, and the server accepts it.
    return file;
  }
}

/** Compress a batch of images concurrently; each falls back to its original on failure. */
export function compressImagesForUpload(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImageForUpload));
}
