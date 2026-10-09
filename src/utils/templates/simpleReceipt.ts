/**
 * Simple thermal receipt template (80mm width)
 * Used for cashier receipts - simplified layout without tables
 */
import { OrderDto, OrderItemDto } from '@/types/order';
import { THERMAL_BASE_STYLES } from './baseStyles';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import { marketplaceReceiptHtml, receiptTaxHtml } from './marketplaceReceipt';
import { RESTAURANT_NAME } from '@/lib/config';
import { buildChildItemsHtml, escapeHtml } from './receiptHtml';
import { getPaymentMethodLabel } from '@/utils/paymentMethodDisplay';
import { getOrderTableLabel } from '@/utils/orderTableLabel';
import { displaySpecialInstructions } from '@/utils/orderItemDisplay';

type TranslationFunction = (key: string, fallback: string) => string;

// Get order type label
const getOrderTypeLabel = (type: string | undefined, t?: TranslationFunction): string => {
  const translate = t || ((key: string, fallback: string) => fallback);
  switch (type) {
    case 'DineIn':
      return translate('order_type.dinein', 'Dine In');
    case 'Takeaway':
      return translate('order_type.takeaway', 'Takeaway');
    case 'Delivery':
      return translate('order_type.delivery', 'Delivery');
    default:
      return type || 'Unknown';
  }
};

// Build item HTML - simple format (name, qty, total only - no unit price breakdown)
const buildItemHtml = (item: OrderItemDto, order: OrderDto): string => {
  const itemName = item.productName || item.menuName || 'Item';
  const variation = item.variationName ? ` (${item.variationName})` : '';
  const totalPrice = formatOrderCurrency(item.itemTotal, order);
  const specialInstructions = displaySpecialInstructions(item);
  // What is inside a combo, itemised under the line the guest is being charged for. Prices are off:
  // the parent line carries the whole amount, so each component would otherwise print a bare 0.00.
  const childItemsHtml = buildChildItemsHtml(item.sideItems ?? [], { showPrices: false });

  return `
    <div style="margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #aaa;">
      <div style="display: flex; justify-content: space-between;">
        <span><strong>${item.quantity}x</strong> ${escapeHtml(itemName)}${escapeHtml(variation)}</span>
        <span><strong>${totalPrice}</strong></span>
      </div>
      ${childItemsHtml}
      ${specialInstructions ? `<div dir="auto">${escapeHtml(specialInstructions)}</div>` : ''}
    </div>`;
};

/**
 * Generate HTML for simple thermal receipt
 */
export const generateSimpleReceiptHtml = (order: OrderDto, t?: TranslationFunction): string => {
  const translate = t || ((key: string, fallback: string) => fallback);

  // Build items HTML
  const itemsHtml = order.items.map((item) => buildItemHtml(item, order)).join('');

  // Format date
  const orderDate = new Date(order.orderDate);
  const dateStr = orderDate.toLocaleDateString();
  const timeStr = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const tableLabel = getOrderTableLabel(order);

  // Delivery address
  const deliveryAddress =
    order.type === 'Delivery' && order.deliveryAddress
      ? `
      <div style="margin: 10px 0; padding: 8px; border: 1px dashed #000;">
        <strong>${translate('delivery_to', 'DELIVERY TO')}:</strong><br/>
        ${escapeHtml(order.deliveryAddress.addressLine1 || '')}
        ${order.deliveryAddress.addressLine2 ? '<br/>' + escapeHtml(order.deliveryAddress.addressLine2) : ''}
        <br/>${escapeHtml(order.deliveryAddress.postalCode || '')} ${escapeHtml(order.deliveryAddress.city || '')}
        ${order.deliveryAddress.phone ? '<br/>Tel: ' + escapeHtml(order.deliveryAddress.phone) : ''}
      </div>
    `
      : '';

  // Payments
  const capturedTipsMinor =
    order.paymentTipMinor ??
    (order.payments ?? []).reduce(
      (total, payment) =>
        payment.status === 'Completed' || payment.status === 'PartiallyRefunded' || payment.status === 'Refunded'
          ? total + Math.max(0, (payment.tipMinor ?? 0) - (payment.refundedTipMinor ?? 0))
          : total,
      0,
    );
  const paymentTipAmount = capturedTipsMinor / 100;
  const hasTipPayment = (order.payments ?? []).some(
    (payment) =>
      (payment.status === 'Completed' || payment.status === 'PartiallyRefunded' || payment.status === 'Refunded') &&
      ((payment.tipMinor ?? 0) > 0 || (payment.refundedTipMinor ?? 0) > 0),
  );
  const totalCollectedLine = hasTipPayment
    ? `<div><strong>${translate('cashier.collection.total_collected', 'Total collected')}: ${formatOrderCurrency(order.totalPaid + paymentTipAmount, order)}</strong></div>`
    : '';
  const paymentsHtml =
    order.payments && order.payments.length > 0
      ? `
      <div style="margin-top: 8px;">
        <strong>${translate('payment', 'PAYMENT')}:</strong>
        ${order.payments
          .map((p) => {
            const captured = p.status === 'Completed' || p.status === 'PartiallyRefunded' || p.status === 'Refunded';
            const tip = captured ? (p.tipMinor ?? 0) / 100 : 0;
            const refundedTip = captured ? (p.refundedTipMinor ?? 0) / 100 : 0;
            const method = getPaymentMethodLabel(p.paymentMethod, translate);
            const tipLine =
              tip > 0
                ? `<div>${translate('cashier.collection.staff_tip', 'Tip for staff')}: ${formatOrderCurrency(tip, order)}</div>`
                : '';
            const refundLine =
              refundedTip > 0
                ? `<div>${translate('cashier.refund_tip_amount', 'Tip refunded')}: ${formatOrderCurrency(refundedTip, order)}</div>`
                : '';
            return `<div>${method}: ${formatOrderCurrency(p.amount, order)}</div>${tipLine}${refundLine}`;
          })
          .join('')}
        ${totalCollectedLine}
      </div>
    `
      : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt - ${escapeHtml(order.orderNumber)}</title>
        <style>${THERMAL_BASE_STYLES}</style>
      </head>
      <body>
        <div class="header">
          <h1>${escapeHtml(RESTAURANT_NAME)}</h1>
          <div>${translate('online_order', 'ONLINE ORDER')}</div>
        </div>

        <div class="separator"></div>

        <div style="margin: 8px 0;">
          <div style="font-size: 11pt; font-weight: bold; margin-bottom: 4px; white-space: nowrap;">
            ${escapeHtml(order.orderNumber)} - ${dateStr} ${timeStr}
          </div>
          <div>
            <strong>${translate('type', 'Type')}:</strong> ${escapeHtml(getOrderTypeLabel(order.type, t))}${order.type === 'DineIn' && tableLabel ? ` - Table ${escapeHtml(tableLabel)}` : ''}
          </div>
        </div>

        ${
          order.customerName
            ? `
          <div style="margin: 8px 0;">
            <div><strong>${translate('customer', 'Customer')}:</strong> ${escapeHtml(order.customerName)}</div>
          </div>
        `
            : ''
        }

        ${marketplaceReceiptHtml(order, translate, true)}
        ${deliveryAddress}

        <div class="separator"></div>

        <div style="margin: 8px 0;">
          ${itemsHtml}
        </div>

        <div class="double-separator"></div>

        <div style="margin: 8px 0;">
          <div class="flex-row">
            <span>${translate('subtotal', 'Subtotal')}:</span>
            <span>${formatOrderCurrency(order.subTotal, order)}</span>
          </div>
          ${receiptTaxHtml(order, translate)}
          ${
            order.deliveryFee && order.deliveryFee > 0
              ? `
            <div class="flex-row">
              <span>${translate('delivery_fee', 'Delivery')}:</span>
              <span>${formatOrderCurrency(order.deliveryFee, order)}</span>
            </div>
          `
              : ''
          }
          ${
            order.discount && order.discount > 0
              ? `
            <div class="flex-row">
              <span>${translate('discount', 'Discount')}:</span>
              <span>-${formatOrderCurrency(order.discount, order)}</span>
            </div>
          `
              : ''
          }
          ${
            order.tip && order.tip > 0
              ? `
            <div class="flex-row">
              <span>${translate('tip', 'Tip')}:</span>
              <span>${formatOrderCurrency(order.tip, order)}</span>
            </div>
          `
              : ''
          }
        </div>

        <div class="separator"></div>

        <div class="total-line flex-row" style="margin: 8px 0;">
          <span>${translate('total', 'TOTAL')}:</span>
          <span>${formatOrderCurrency(order.total, order)}</span>
        </div>

        ${paymentsHtml}

        ${
          order.notes
            ? `
          <div class="separator"></div>
          <div style="margin: 8px 0;">
            <strong>${translate('notes', 'Notes')}:</strong> ${escapeHtml(order.notes)}
          </div>
        `
            : ''
        }

        <div class="double-separator"></div>

        <div style="text-align: center; margin-top: 10px; font-size: 10pt;">
          ${translate('thank_you', 'Thank you for your visit!')}
        </div>
      </body>
    </html>
  `;
};
