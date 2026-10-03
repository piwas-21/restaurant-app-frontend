import type { DeliveryChannelMappingRow } from '@/types/deliveryChannelCatalogue';
import type { DeliveryChannelCategoryItem } from '@/types/deliveryChannelMenuSelection';
import { availabilityIdentity, deliveryChannelAvailabilityLabels } from './deliveryChannelAvailabilityLabels';

const mapping: DeliveryChannelMappingRow = {
  providerItemId: 'provider-wrong-name',
  providerItemName: 'Uber Eats item',
  productId: 'product-soup',
  variationId: 'variation-large',
  productName: 'Soup',
  variationName: 'Large',
  tenantPriceMinor: 850,
  providerPriceMinor: 850,
  providerPriceStatus: 'currentReadback',
  currency: 'EUR',
  available: true,
  mappingStatus: 'mapped',
  blockReason: null,
};

const frozenItem: DeliveryChannelCategoryItem = {
  selectionKey: 'soup-large',
  providerItemId: 'provider-current',
  productId: 'product-soup',
  variationId: 'variation-large',
  categoryId: 'category-main',
  categoryName: 'Main dishes',
  categoryDisplayOrder: 1,
  itemDisplayOrder: 3,
  name: 'Tomato soup — Large',
  variationName: 'Large',
  priceMinor: 850,
  available: true,
  supported: true,
  blockReason: null,
};

describe('deliveryChannelAvailabilityLabels', () => {
  it('resolves labels by exact product and variation identity, never provider name or ID', () => {
    const labels = deliveryChannelAvailabilityLabels([mapping], [frozenItem], []);

    expect(labels.get(availabilityIdentity('product-soup', 'variation-large'))).toBe('Tomato soup — Large');
    expect(labels.has(availabilityIdentity('product-soup', null))).toBe(false);
  });

  it('prefers the latest known tenant candidate for an exact identity', () => {
    const labels = deliveryChannelAvailabilityLabels(
      [mapping],
      [frozenItem],
      [{ ...frozenItem, name: 'Tomato soup current — Large' }],
    );

    expect(labels.get(availabilityIdentity('product-soup', 'variation-large'))).toBe('Tomato soup current — Large');
  });

  it('does not append variation metadata when the canonical display name already contains it', () => {
    const labels = deliveryChannelAvailabilityLabels(
      [{ ...mapping, productName: 'Pizza — Large', variationName: 'Large' }],
      [],
      [],
    );
    expect(labels.get(availabilityIdentity('product-soup', 'variation-large'))).toBe('Pizza — Large');
  });
});
