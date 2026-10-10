/**
 * Simple thermal receipt template (80mm width)
 * Used for cashier receipts - simplified layout without tables
 */
import { OrderDto, OrderItemDto } from '@/types/order';
import { receiptStyles, receiptDate, receiptDocumentAttributes, type ReceiptOptions } from './receiptOptions';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import { marketplaceReceiptHtml, receiptTaxHtml } from './marketplaceReceipt';
import { RESTAURANT_NAME } from '@/lib/config';
import { buildChildItemsHtml, customizedIngredientRows, ingredientRowHtml, escapeHtml } from './receiptHtml';
import { receiptPaymentHtml } from './receiptPayment';
import { receiptOrderTypeLabel } from './receiptPresentation';
import { getOrderTableLabel } from '@/utils/orderTableLabel';
import { displaySpecialInstructions } from '@/utils/orderItemDisplay';

type TranslationFunction = (key: string, fallback: string) => string;

function deliveryAddressHtml(order: OrderDto, translate: TranslationFunction): string {
  if (order.type !== 'Delivery' || !order.deliveryAddress) return '';
  const address = order.deliveryAddress;
  return `
    <div style="margin: 10px 0; padding: 8px; border: 1px dashed #000;">
      <strong>${translate('delivery_to', 'DELIVERY TO')}:</strong><br/>
      ${escapeHtml(address.addressLine1 || '')}
      ${address.addressLine2 ? '<br/>' + escapeHtml(address.addressLine2) : ''}
      <br/>${escapeHtml(address.postalCode || '')} ${escapeHtml(address.city || '')}
      ${address.phone ? '<br/>Tel: ' + escapeHtml(address.phone) : ''}
    </div>`;
}

// Build item HTML - simple format (name, qty, total only - no unit price breakdown)
const buildItemHtml = (item: OrderItemDto, order: OrderDto, translate: TranslationFunction): string => {
  const itemName = item.productName || item.menuName || 'Item';
  const variation = item.variationName ? ` (${item.variationName})` : '';
  const totalPrice = formatOrderCurrency(item.itemTotal, order);
  const specialInstructions = displaySpecialInstructions(item);
  // What is inside a combo, itemised under the line the guest is being charged for. Prices are off:
  // the parent line carries the whole amount, so each component would otherwise print a bare 0.00.
  const childItemsHtml = buildChildItemsHtml(item.sideItems ?? [], {
    showPrices: false,
    withIngredients: true,
    translate,
    parentQuantity: item.quantity,
  });
  const ingredientsHtml = customizedIngredientRows(item)
    .map((ingredient) => ingredientRowHtml(ingredient, 16, translate, item.quantity))
    .join('');

  return `
    <div style="margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #aaa;">
      <div class="flex-row">
        <span dir="auto"><strong>${item.quantity}x</strong> ${escapeHtml(itemName)}${escapeHtml(variation)}</span>
        <span dir="ltr"><strong>${totalPrice}</strong></span>
      </div>
      ${ingredientsHtml}${childItemsHtml}
      ${specialInstructions ? `<div dir="auto">${escapeHtml(specialInstructions)}</div>` : ''}
    </div>`;
};

/**
 * Generate HTML for simple thermal receipt
 */
export const generateSimpleReceiptHtml = (
  order: OrderDto,
  t?: TranslationFunction,
  options: ReceiptOptions = {},
): string => {
  const translate = t || ((key: string, fallback: string) => fallback);

  // Build items HTML
  const itemsHtml = order.items.map((item) => buildItemHtml(item, order, translate)).join('');

  const tableLabel = getOrderTableLabel(order);

  const deliveryAddress = deliveryAddressHtml(order, translate);

  const paymentsHtml = receiptPaymentHtml(order, translate);

  return `
    <!DOCTYPE html>
    <html ${receiptDocumentAttributes(options)}>
      <head>
        <meta charset="UTF-8">
        <title>Receipt - ${escapeHtml(order.orderNumber)}</title>
        <style>${receiptStyles(options)}</style>
      </head>
      <body>
        <div class="header">
          <h1>${escapeHtml(RESTAURANT_NAME)}</h1>
          <div>${translate('receipt.title', 'Receipt')}</div>
        </div>

        <div class="separator"></div>

        <div style="margin: 8px 0;">
          <div style="font-size: 11pt; font-weight: bold; margin-bottom: 4px; white-space: normal; overflow-wrap: anywhere;">
            ${escapeHtml(order.orderNumber)} - ${receiptDate(order.orderDate, options)}
          </div>
          <div>
            <strong>${translate('type', 'Type')}:</strong> ${escapeHtml(receiptOrderTypeLabel(order.type, t))}${order.type === 'DineIn' && tableLabel ? ` - ${escapeHtml(translate('table', 'Table'))} ${escapeHtml(tableLabel)}` : ''}
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
          ${translate('receipt.thanks', 'Thank you for your visit!')}
        </div>
      </body>
    </html>
  `;
};
