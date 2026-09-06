import { mapBundleDtoToMenuBundleItem, mapProductDtoToMenuItem } from '@/hooks/publicMenu/mappers';
import type { ProductImageDto } from '@/hooks/publicMenu/types';
import { toCatalogItemFromBundle, toCatalogItemFromProduct } from './catalogItem';
import { FALLBACK_IMAGE } from './imageHelpers';

const original = '/uploads/original.jpg';
const derivative = '/uploads/original.card.webp';

function productCard(images: ProductImageDto[], imageUrl?: string) {
  return toCatalogItemFromProduct(mapProductDtoToMenuItem({ id: 'product', imageUrl, images }));
}

function bundleCard(images: ProductImageDto[]) {
  return toCatalogItemFromBundle(mapBundleDtoToMenuBundleItem({ id: 'bundle', images }));
}

describe('public card image delivery', () => {
  it('prefers the product derivative even when the legacy scalar image is present', () => {
    const card = productCard([{ url: original, cardUrl: derivative }], original);
    expect(card.imageUrl).toBe(derivative);
    expect(card.images?.[0].url).toBe(original);
  });

  it('uses bundle derivatives without replacing gallery originals', () => {
    const card = bundleCard([{ url: original, cardUrl: derivative }]);
    expect(card.imageUrl).toBe(derivative);
    expect(card.images?.[0].url).toBe(original);
  });

  it.each([undefined, null, ''])('keeps original product and bundle URLs for cardUrl=%s', (cardUrl) => {
    const images = [{ url: original, cardUrl }];
    expect(productCard(images).imageUrl).toBe(original);
    expect(bundleCard(images).imageUrl).toBe(original);
  });

  it('preserves the legacy product scalar fallback when no derivative exists', () => {
    expect(productCard([{ url: original }], '/uploads/legacy.jpg').imageUrl).toBe('/uploads/legacy.jpg');
  });

  it('keeps the bundle placeholder when no images exist', () => {
    expect(bundleCard([]).imageUrl).toBe(FALLBACK_IMAGE);
  });
});
