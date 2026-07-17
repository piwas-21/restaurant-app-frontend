import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImageGallery from './ImageGallery';
import type { ProductImage } from '@/app/admin/menu-management/interfaces';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/services/productService', () => ({
  updateProductImageDetails: jest.fn(async () => ({ success: true })),
  deleteProductImage: jest.fn(async () => ({ success: true })),
}));

import { updateProductImageDetails, deleteProductImage } from '@/services/productService';

const images: ProductImage[] = [
  { id: 'img-1', url: '/a.jpg', altText: 'first', isPrimary: false, sortOrder: 0 },
  { id: 'img-2', url: '/b.jpg', altText: 'second', isPrimary: true, sortOrder: 1 },
];

const renderGallery = (imgs: ProductImage[] = images) =>
  render(<ImageGallery productId="p1" images={imgs} productName="Pizza" />);

beforeEach(() => jest.clearAllMocks());

describe('ImageGallery — immediate, no rival Save (slice 7 PR2e)', () => {
  it('empty gallery shows a placeholder and no per-image controls', () => {
    renderGallery([]);
    expect(screen.getByText('no_images_yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'set_as_primary' })).not.toBeInTheDocument();
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
