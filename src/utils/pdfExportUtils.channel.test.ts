import { exportOrderToPDF, exportSimpleReceiptToPDF, exportKitchenItemsToPDF } from './pdfExportUtils';
import { marketplaceOrder } from './__fixtures__/marketplaceOrderFixture';

beforeEach(() => jest.restoreAllMocks());
afterEach(() => document.querySelectorAll('iframe').forEach((frame) => frame.remove()));

it('blocks customer print entry points when no provider receipt permission is present', () => {
  const create = jest.spyOn(document, 'createElement');
  const order = marketplaceOrder();
  exportOrderToPDF(order);
  exportSimpleReceiptToPDF(order);
  exportKitchenItemsToPDF(order, 'All');
  expect(create).not.toHaveBeenCalled();
});
it('blocks kitchen output before release, even if permission is inconsistent', () => {
  const create = jest.spyOn(document, 'createElement');
  const order = marketplaceOrder();
  order.permittedActions = [{ action: 'PrintKitchen', allowed: true, requiresReason: false }];
  exportKitchenItemsToPDF(order, 'GeneralKitchen');
  expect(create).not.toHaveBeenCalled();
});
it('creates a print iframe for a released and permitted kitchen ticket', () => {
  const order = marketplaceOrder();
  order.isKitchenReleased = true;
  order.permittedActions = [{ action: 'PrintKitchen', allowed: true, requiresReason: false }];
  exportKitchenItemsToPDF(order, 'GeneralKitchen');
  expect(document.querySelector('iframe')?.contentDocument?.body.textContent).toContain('Uber Eats');
});
it('retains the ordinary customer print entry point', () => {
  exportOrderToPDF({ ...marketplaceOrder(), externalOrder: null });
  expect(document.querySelector('iframe')).not.toBeNull();
});
