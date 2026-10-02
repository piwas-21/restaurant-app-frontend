import { deliveryChannelDraftRows } from './deliveryChannelDraftRows';
import { deliveryChannelMappingView } from './deliveryChannelMappingView';
import type { DeliveryChannelCatalogueCandidate, DeliveryChannelMappingRow } from '@/types/deliveryChannelCatalogue';

const saved: DeliveryChannelMappingRow = {
  providerItemId: 'uber-meal',
  providerItemName: 'Meal',
  productId: 'old-meal',
  variationId: null,
  productName: 'Old meal',
  variationName: null,
  tenantPriceMinor: 500,
  providerPriceMinor: 500,
  providerPriceStatus: 'currentReadback',
  currency: 'EUR',
  available: true,
  mappingStatus: 'mapped',
  blockReason: null,
};
const replacement: DeliveryChannelCatalogueCandidate = {
  productId: 'new-meal',
  variationId: 'large',
  name: 'Fresh meal',
  variationName: 'Large',
  priceMinor: 750,
  available: true,
  supported: true,
  blockReason: '',
};

describe('mapping draft review facts', () => {
  it('shows removal immediately and excludes the old name, price and mapped filter', () => {
    const rows = deliveryChannelDraftRows([saved], { 'uber-meal': '' }, []);
    expect(rows[0]).toMatchObject({
      mappingStatus: 'unmapped',
      productName: null,
      tenantPriceMinor: null,
      productId: null,
    });
    expect(deliveryChannelMappingView(rows, { status: 'mapped', search: '', page: 0 }).total).toBe(0);
    expect(deliveryChannelMappingView(rows, { status: 'all', search: 'Old meal', page: 0 }).total).toBe(0);
    expect(saved).toMatchObject({ productId: 'old-meal', tenantPriceMinor: 500 });
  });
  it('reviews the selected identity and price while retaining independent provider readback', () => {
    const rows = deliveryChannelDraftRows([saved], { 'uber-meal': 'new-meal::large' }, [replacement]);
    expect(rows[0]).toMatchObject({
      productId: 'new-meal',
      variationId: 'large',
      productName: 'Fresh meal',
      variationName: 'Large',
      tenantPriceMinor: 750,
      providerPriceMinor: 500,
      providerPriceStatus: 'currentReadback',
      mappingStatus: 'mapped',
    });
    expect(deliveryChannelMappingView(rows, { status: 'mapped', search: 'Fresh meal', page: 0 }).rows).toEqual(rows);
  });
  it('does not invent a selected item name or price from an unrecognized identity', () => {
    const rows = deliveryChannelDraftRows([saved], { 'uber-meal': 'unknown::' }, []);
    expect(rows[0]).toMatchObject({
      mappingStatus: 'blocked',
      blockReason: 'ReviewRequired',
      productName: null,
      tenantPriceMinor: null,
    });
  });
  it('retains unsupported source blockers even if a draft identity is present', () => {
    const rows = deliveryChannelDraftRows(
      [{ ...saved, mappingStatus: 'blocked', blockReason: 'UnsupportedChoices' }],
      { 'uber-meal': 'new-meal::large' },
      [replacement],
    );
    expect(rows[0]).toMatchObject({ mappingStatus: 'blocked', blockReason: 'UnsupportedChoices' });
  });
});
