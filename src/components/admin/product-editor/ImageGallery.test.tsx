import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FALLBACK_IMAGE } from '@/utils/imageHelpers';
import ImageGallery from './ImageGallery';
import type { ProductImage } from '@/app/admin/menu-management/interfaces';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('@/services/productService', () => ({
  updateProductImageDetails: jest.fn(async () => ({ success: true })),
  deleteProductImage: jest.fn(async () => ({ success: true })),
  uploadBulkProductImages: jest.fn(async () => ({ success: true, data: [] })),
}));

import { updateProductImageDetails, deleteProductImage, uploadBulkProductImages } from '@/services/productService';

const images: ProductImage[] = [
  { id: 'img-1', url: '/a.jpg', altText: 'first', isPrimary: false, sortOrder: 0 },
  { id: 'img-2', url: '/b.jpg', altText: 'second', isPrimary: true, sortOrder: 1 },
];

const renderGallery = (imgs: ProductImage[] = images) =>
  render(<ImageGallery productId="p1" images={imgs} productName="Pizza" />);

beforeEach(() => jest.clearAllMocks());

const pick = (container: HTMLElement, files: File[]) =>
  fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files } });

const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

describe('ImageGallery — immediate, no rival Save (slice 7 PR2e)', () => {
  /*
   * D5 (slice S6). The gallery writes on click while the rest of the page waits for Save, and the
   * API offers no batch image write, so the notice is the only thing that makes the difference
   * visible. It must therefore be PERSISTENT — present before anything is clicked, and present in
   * both states — which is what these two assertions are: no action is taken in either.
   */
  it('always says that photo changes save immediately — with photos and without', () => {
    const { unmount } = renderGallery();
    expect(screen.getByText('editor_media_autosave_notice')).toBeInTheDocument();

    unmount();
    renderGallery([]);
    expect(screen.getByText('editor_media_autosave_notice')).toBeInTheDocument();
  });

  // G16: the section card draws `<h2>Media</h2>`, so the gallery's own `<h3>Image Gallery</h3>` was
  // a second title for one box. It brings no heading of its own any more.
  it('brings no heading of its own', () => {
    const { container } = renderGallery();
    expect(container.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
  });

  it('empty gallery shows a placeholder, no per-image controls, and a way out of it', () => {
    renderGallery([]);
    expect(screen.getByText('no_images_yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'set_as_primary' })).not.toBeInTheDocument();
    // …but NOT a dead end: the empty state is exactly the product that needs an upload most
    // (Track F, F7-A — it used to be a sentence with no control under it).
    expect(screen.getByRole('button', { name: 'upload_images' })).toBeInTheDocument();
  });

  it('set-primary applies immediately via the image endpoint and updates the list in place', async () => {
    const { container } = renderGallery();

    // Select the non-primary image, then promote it — there is no batch Save to click.
    fireEvent.click(container.querySelector('img[alt="first"]') as HTMLImageElement);
    fireEvent.click(screen.getByRole('button', { name: 'set_as_primary' }));

    await waitFor(() => expect(updateProductImageDetails).toHaveBeenCalledTimes(1));
    const [productId, imageId, body] = (updateProductImageDetails as jest.Mock).mock.calls[0];
    expect(productId).toBe('p1');
    expect(imageId).toBe('img-1');
    expect(body).toMatchObject({ id: 'img-1', isPrimary: true });
    // Optimistic local update: the promoted image now reads as primary (no page refetch).
    await waitFor(() => expect(screen.getByRole('button', { name: 'primary' })).toBeDisabled());
  });

  it('commits a changed sort order on blur, not on every keystroke', async () => {
    renderGallery();

    const sortInput = screen.getByLabelText('sort_order') as HTMLInputElement;
    fireEvent.change(sortInput, { target: { value: '5' } });
    // Typing alone must not fire — only the blur commits.
    expect(updateProductImageDetails).not.toHaveBeenCalled();

    fireEvent.blur(sortInput);
    await waitFor(() => expect(updateProductImageDetails).toHaveBeenCalledTimes(1));
    const [, imageId, body] = (updateProductImageDetails as jest.Mock).mock.calls[0];
    expect(imageId).toBe('img-2'); // the primary is the default selection
    expect(body).toMatchObject({ sortOrder: 5 });
  });

  it('surfaces an error and does not mutate the list when an op fails', async () => {
    (deleteProductImage as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const { container } = renderGallery();

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));

    expect(await screen.findByText('image_update_failed')).toBeInTheDocument();
    // The failed delete left the image in place.
    expect(container.querySelector('img[alt="second"]')).not.toBeNull();
  });

  it('delete goes through a confirm, then removes the image from the list in place', async () => {
    const { container } = renderGallery();

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    // Not deleted until confirmed — the confirm modal stands in between.
    expect(deleteProductImage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'yes' }));

    await waitFor(() => expect(deleteProductImage).toHaveBeenCalledTimes(1));
    const [productId, imageId] = (deleteProductImage as jest.Mock).mock.calls[0];
    expect(productId).toBe('p1');
    expect(imageId).toBe('img-2'); // the primary is the default selection
    // Optimistic removal: the deleted image's thumbnail is gone.
    await waitFor(() => expect(container.querySelector('img[alt="second"]')).toBeNull());
  });
});

describe('ImageGallery — upload, restored as an immediate op (Track F, F7-A)', () => {
  // The regression this pins: PR #215 rewrote the gallery and dropped upload, leaving a naked
  // file input at the top of a nine-section page as the only way to add a photo.
  it('offers "upload more" once the product has images, and stages what is picked', () => {
    const { container } = renderGallery();

    expect(screen.getByRole('button', { name: 'upload_more_images' })).toBeInTheDocument();
    pick(container, [photo('pizza.jpg'), photo('pide.jpg')]);

    expect(screen.getByText('pizza.jpg')).toBeInTheDocument();
    expect(screen.getByText('pide.jpg')).toBeInTheDocument();
    // Staging alone must not write — the upload is deliberate, like every other gallery op.
    expect(uploadBulkProductImages).not.toHaveBeenCalled();
  });

  it('uploads immediately and merges the returned images into the list', async () => {
    (uploadBulkProductImages as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: [{ id: 'img-3', url: '/c.jpg', altText: 'third', isPrimary: false, sortOrder: 2 }],
    });
    const { container } = renderGallery();

    pick(container, [photo('pizza.jpg')]);
    fireEvent.click(screen.getByRole('button', { name: 'save_uploads' }));

    await waitFor(() => expect(uploadBulkProductImages).toHaveBeenCalledTimes(1));
    const [productId, files] = (uploadBulkProductImages as jest.Mock).mock.calls[0];
    expect(productId).toBe('p1');
    expect(files.map((f: File) => f.name)).toEqual(['pizza.jpg']);
    // Optimistic merge, no page refetch — a refetch would discard the form's unsaved edits.
    await waitFor(() => expect(container.querySelector('img[alt="third"]')).not.toBeNull());
    expect(screen.queryByText('pizza.jpg')).not.toBeInTheDocument();
  });

  // Track F, F1: a total refusal arrives as HTTP 200 with `data: []` and the reason only on
  // `message`. Silence there is what made "the photo does not upload" invisible for weeks.
  it('surfaces the server reason when the upload is refused inside a 200', async () => {
    (uploadBulkProductImages as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: [],
      message: 'Uploaded 0 images. 1 failed.',
    });
    const { container } = renderGallery();

    pick(container, [photo('pizza.jpg')]);
    fireEvent.click(screen.getByRole('button', { name: 'save_uploads' }));

    expect(await screen.findByText('Uploaded 0 images. 1 failed.')).toBeInTheDocument();
    // The pick survives a failure, so a retry costs no second trip to the file dialog.
    expect(screen.getByText('pizza.jpg')).toBeInTheDocument();
  });

  it('falls back to a translated message when the call throws', async () => {
    (uploadBulkProductImages as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const { container } = renderGallery();

    pick(container, [photo('pizza.jpg')]);
    fireEvent.click(screen.getByRole('button', { name: 'save_uploads' }));

    expect(await screen.findByText('image_update_failed')).toBeInTheDocument();
  });

  it('opens the hidden picker from the visible button — the input is never the control', () => {
    const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    renderGallery([]);

    fireEvent.click(screen.getByRole('button', { name: 'upload_images' }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it('stages nothing when the file dialog is cancelled', () => {
    const { container } = renderGallery();

    pick(container, []);

    expect(screen.queryByRole('button', { name: 'save_uploads' })).not.toBeInTheDocument();
  });

  it('drops one staged file, and cancels the whole selection', () => {
    const { container } = renderGallery();

    pick(container, [photo('pizza.jpg'), photo('pide.jpg')]);
    fireEvent.click(screen.getAllByRole('button', { name: 'remove' })[0]);
    expect(screen.queryByText('pizza.jpg')).not.toBeInTheDocument();
    expect(screen.getByText('pide.jpg')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(screen.queryByText('pide.jpg')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'save_uploads' })).not.toBeInTheDocument();
  });
});

describe('ImageGallery — what the picker may offer (Track F, F1c)', () => {
  it('narrows accept to exactly what the server stores, so an iPhone cannot offer a HEIC', () => {
    const { container } = renderGallery();

    expect(container.querySelector('input[type="file"]')).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
  });

  it('refuses a file over 10 MB before the round trip, and names it', () => {
    const { container } = renderGallery();

    const huge = new File(['x'], 'holiday.jpg', { type: 'image/jpeg' });
    Object.defineProperty(huge, 'size', { value: 11 * 1024 * 1024 });
    pick(container, [huge]);

    expect(screen.getByText('images_too_large')).toBeInTheDocument();
    expect(screen.queryByText('holiday.jpg')).not.toBeInTheDocument();
    expect(uploadBulkProductImages).not.toHaveBeenCalled();
  });

  it('refuses a type the server cannot decode, and keeps the acceptable ones', () => {
    const { container } = renderGallery();

    pick(container, [new File(['x'], 'camera.heic', { type: 'image/heic' }), photo('pizza.jpg')]);

    expect(screen.getByText('images_wrong_type')).toBeInTheDocument();
    // The good file is still staged — a mixed pick is not all-or-nothing.
    expect(screen.getByText('pizza.jpg')).toBeInTheDocument();
    expect(screen.queryByText('camera.heic')).not.toBeInTheDocument();
  });
});

/*
 * D8 (slice S10) — the consequence of an empty gallery.
 *
 * The copy assertion below is the load-bearing one, and it is a TRUTH oracle, not a snapshot. The
 * plan's D8 said an item with no photo "renders as a text-only card"; it does not. `MenuCard.tsx`
 * and `CraftMenuCard.tsx` both fall back to `FALLBACK_IMAGE` (`/branding/placeholder.png`), and
 * that fallback is pinned deliberately by a test named "falls back to the placeholder when the
 * special has no image, rather than omitting the photo". So the notice must describe the
 * placeholder, and must never claim the text-only behaviour the codebase rejected.
 */
describe('ImageGallery — the empty-gallery consequence (D8, slice S10)', () => {
  it('warns only while the gallery is empty', () => {
    const { unmount } = renderGallery([]);
    expect(screen.getByText('editor_no_photo_consequence')).toBeInTheDocument();

    unmount();
    renderGallery();
    // With photos there is no consequence to explain — a permanent warning is just noise.
    expect(screen.queryByText('editor_no_photo_consequence')).not.toBeInTheDocument();
  });

  it('hides its glyph from the accessible name and does not shout as an alert', () => {
    const { container } = renderGallery([]);

    const notice = screen.getByText('editor_no_photo_consequence');
    expect(notice.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // Nothing has gone wrong: the item is valid without a photo.
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('the shipped English copy describes the placeholder the menu actually renders', () => {
    const copy = JSON.parse(readFileSync(join(process.cwd(), 'src/locales/en.json'), 'utf8')) as Record<string, string>;
    const sentence = copy.editor_no_photo_consequence;

    expect(sentence).toMatch(/placeholder/i);
    // The behaviour D8 originally described, and the one the menu templates do NOT have.
    expect(sentence).not.toMatch(/text[- ]only/i);
    // And the fallback the sentence promises is the one the menu really uses.
    expect(FALLBACK_IMAGE).toBe('/branding/placeholder.png');
  });
});
