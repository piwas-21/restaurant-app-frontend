import type { TFunction } from 'i18next';
import { enqueueSnackbar } from 'notistack';

/**
 * Tell the admin that the product was written but its staged photos were NOT stored.
 *
 * ## Why this is a snackbar and not the editor's own root error
 *
 * The same reasoning `lib/categoryFormErrors.ts` records for categories, and it applies here for
 * the same reason: an image upload is a SECOND request against an entity the first request already
 * created, so a failure is a PARTIAL success — the run must still finish (refresh, navigate), and
 * a message written into a form that is about to unmount or be `reset()` is a message nobody reads.
 * On the create route that is literal: `onProductCreated` pushes back to the list, so an
 * `errors.root` set a tick earlier paints nowhere.
 *
 * `persist` because it is the only sentence that will ever be said about a photo the tenant thinks
 * they uploaded — the provider renders a close button on every snack (`client-providers.tsx`), so
 * dismissing it is one click, and the 4 s default is not long enough to read a filename plus a
 * server reason in a second language.
 *
 * The reason is the SERVER's (`serverMessage`, which prefers `errors[]` — where the bulk handler
 * puts the per-file cause). `null` means the server authored nothing worth showing, and only then
 * does the translated generic stand in.
 */
export function reportProductImageUploadFailure(t: TFunction, mode: 'create' | 'edit', reason: string | null): void {
  const detail = reason ?? t('product_image_failed_generic', 'the images were rejected');
  const message =
    mode === 'create'
      ? t('product_created_image_failed', 'Product created, but the image upload failed: {{reason}}', {
          reason: detail,
        })
      : t('product_updated_image_failed', 'Product updated, but the image upload failed: {{reason}}', {
          reason: detail,
        });

  enqueueSnackbar(message, { variant: 'error', persist: true });
}
