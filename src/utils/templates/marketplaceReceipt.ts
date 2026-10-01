import type { OrderDto } from '@/types/order';
import { channelProviderName, reportedOrderTax, type ChannelTranslate } from '@/lib/externalOrder';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import { escapeHtml } from './receiptHtml';

export function marketplaceReceiptHtml(order: OrderDto, t: ChannelTranslate, showPayment: boolean): string {
  const source = order.externalOrder;
  if (!source) return '';
  const provider = channelProviderName(source, t);
  const payment = t('delivery_channels.payment_handled_by', 'Payment handled by {{provider}}').replace(
    '{{provider}}',
    provider,
  );
  return `<div dir="auto"><strong>${escapeHtml(provider)}</strong> ${escapeHtml(source.externalDisplayId)}
    ${source.isSandbox ? `<strong>${escapeHtml(t('delivery_channels.test_order', 'Test order'))}</strong>` : ''}
    ${showPayment ? `<div>${escapeHtml(payment)}</div>` : ''}</div>`;
}

export function receiptTaxHtml(order: OrderDto, t: ChannelTranslate): string {
  const tax = reportedOrderTax(order);
  if (!order.externalOrder && !(tax !== null && tax > 0)) return '';
  const value =
    tax === null
      ? t('delivery_channels.tax_not_reported', 'Not reported by provider')
      : formatOrderCurrency(tax, order);
  return `<div class="flex-row"><span>${escapeHtml(t('tax', 'Tax'))}:</span><span>${escapeHtml(value)}</span></div>`;
}
