/**
 * Kitchen receipt template
 * Used for printing order items to kitchen printers
 * Simple list layout - no tables
 * Includes pricing for customer-facing 'All' prints
 */
import { OrderDto, OrderItemDto } from '@/types/order';
import { receiptStyles, receiptDate, receiptDocumentAttributes, type ReceiptOptions } from './receiptOptions';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import { marketplaceReceiptHtml, receiptTaxHtml } from './marketplaceReceipt';
import { selectItemsForKitchen } from '../orderItemTree';
import { buildChildItemsHtml, customizedIngredientRows, ingredientRowHtml, escapeHtml } from './receiptHtml';
import { getOrderTableLabel } from '@/utils/orderTableLabel';
import { displaySpecialInstructions } from '@/utils/orderItemDisplay';
import { receiptItems, receiptOrderTypeLabel } from './receiptPresentation';
import { receiptPaymentHtml } from './receiptPayment';

type TranslationFunction = (key: string, fallback: string) => string;

export type KitchenReceiptType = 'FrontKitchen' | 'BackKitchen' | 'GeneralKitchen' | 'All';

const getKitchenLabel = (kitchenType: KitchenReceiptType, translate: TranslationFunction): string => {
  switch (kitchenType) {
    case 'FrontKitchen':
      return translate('kitchen_type_frontkitchen', 'Front Kitchen');
    case 'BackKitchen':
      return translate('kitchen_type_backkitchen', 'Back Kitchen');
    case 'GeneralKitchen':
      return translate('kitchen_type_generalkitchen', 'Kitchen');
    default:
      return translate('order_details', 'Order Details');
  }
};

// Build kitchen item HTML - with optional pricing
const buildKitchenItemHtml = (
  item: OrderItemDto,
  translate: TranslationFunction,
  showPrices: boolean,
  order: OrderDto,
): string => {
  const itemName = item.productName || item.menuName || translate('item', 'Item');
  const specialInstructions = displaySpecialInstructions(item);

  let html = `
    <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed #ccc;">
      <div class="${showPrices ? 'flex-row' : ''}" style="font-size: 13pt; font-weight: bold;">
        <span dir="auto">${item.quantity}x ${escapeHtml(itemName)}</span>
        ${showPrices ? `<span dir="ltr">${formatOrderCurrency(item.itemTotal, order)}</span>` : ''}
      </div>`;

  // Show unit price breakdown if prices enabled. General/Front/Back tickets do not even format
  // money, keeping the kitchen-purpose branches incapable of leaking a price into their HTML.
  if (showPrices && item.quantity > 0) {
    const unitPriceValue = item.unitPrice || item.itemTotal / item.quantity;
    html += `<div style="font-size: 10pt; color: #555;">${item.quantity} @ ${formatOrderCurrency(unitPriceValue, order)}</div>`;
  }

  // Variation
  if (item.variationName) {
    html += `<div style="margin-left: 16px; font-size: 11pt;">${escapeHtml(translate('variation', 'Size'))}: ${escapeHtml(item.variationName)}</div>`;
  }

  // What the kitchen must ACT on — removals, above-default quantities, and paid extras the guest
  // opted into. The old `isRemoved || quantity > 1` filter dropped every add-on chosen at its
  // default quantity 1, which is exactly what a guest's "extra sauce" looks like on the wire:
  // the chosen sauce never reached the printed ticket. One filter with the child rows below.
  customizedIngredientRows(item).forEach((ing) => {
    html += ingredientRowHtml(ing, 16, translate, item.quantity, itemName);
  });

  // Child items (bundle components + add-on sides), already pruned to this ticket's kitchen.
  // withIngredients: a customization made INSIDE a combo must reach paper too — the ticket used
  // to print the component's name and silently drop its ingredient rows.
  html += buildChildItemsHtml(item.sideItems ?? [], {
    showPrices,
    currencySource: order,
    heading: translate('side_items', 'Additionals') + ':',
    withIngredients: true,
    translate,
    parentQuantity: item.quantity,
    parentLabel: itemName,
  });

  // Special instructions - prominent styling
  if (specialInstructions) {
    html += `
      <div style="margin: 8px 0 0 16px; padding: 6px 8px; background: #f5f5f5; border-left: 4px solid #000; font-size: 11pt;">
        <strong>${escapeHtml(translate('note', 'NOTE'))}:</strong> ${escapeHtml(specialInstructions)}
      </div>`;
  }

  html += `</div>`;
  return html;
};

/**
 * Generate HTML for kitchen receipt - simple list layout
 * Shows prices for 'All' type (customer-facing), hides for specific kitchens
 */
export const generateKitchenReceiptHtml = (
  order: OrderDto,
  kitchenType: KitchenReceiptType,
  t?: TranslationFunction,
  options: ReceiptOptions = {},
): string | null => {
  const translate = t || ((key: string, fallback: string) => fallback);

  // 'All' remains the customer-facing order print. General Kitchen is the explicit kitchen-purpose
  // ticket: it keeps every root and descendant, including unassigned lines, while never carrying
  // the customer money block below. Front/Back continue through the existing recursive routing.
  const receiptTree = receiptItems(order.items);
  const filteredItems =
    kitchenType === 'All' || kitchenType === 'GeneralKitchen'
      ? receiptTree
      : selectItemsForKitchen(receiptTree, kitchenType);

  if (filteredItems.length === 0) {
    return null;
  }

  // Show prices only for 'All' (customer-facing receipt)
  const showPrices = kitchenType === 'All';

  // Kitchen type label
  const kitchenLabel = getKitchenLabel(kitchenType, translate);
  const tableLabel = getOrderTableLabel(order);

  // Build items with or without prices
  const itemsHtml = filteredItems.map((item) => buildKitchenItemHtml(item, translate, showPrices, order)).join('');
  const includeCustomerDetails = kitchenType !== 'GeneralKitchen';

  // Totals section only for customer-facing 'All' type
  const totalsHtml = showPrices
    ? `
    <div class="double-separator"></div>
    <div style="margin: 8px 0;">
      <div style="display: flex; justify-content: space-between; margin: 4px 0;">
        <span>${escapeHtml(translate('subtotal', 'Subtotal'))}:</span>
        <span>${formatOrderCurrency(order.subTotal, order)}</span>
      </div>
      ${receiptTaxHtml(order, translate)}
      ${
        order.deliveryFee && order.deliveryFee > 0
          ? `
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span>${escapeHtml(translate('delivery_fee', 'Delivery'))}:</span>
          <span>${formatOrderCurrency(order.deliveryFee, order)}</span>
        </div>
      `
          : ''
      }
      ${
        order.discount && order.discount > 0
          ? `
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span>${escapeHtml(translate('discount', 'Discount'))}:</span>
          <span>-${formatOrderCurrency(order.discount, order)}</span>
        </div>
      `
          : ''
      }
    </div>
    <div class="separator"></div>
    <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14pt; font-weight: bold;">
      <span>${escapeHtml(translate('total', 'TOTAL'))}:</span>
      <span>${formatOrderCurrency(order.total, order)}</span>
    </div>
    ${receiptPaymentHtml(order, translate)}
  `
    : '';

  return `
    <!DOCTYPE html>
    <html ${receiptDocumentAttributes(options)}>
      <head>
        <meta charset="UTF-8">
        <title>${kitchenLabel} - ${escapeHtml(order.orderNumber)}</title>
        <style>${receiptStyles(options)}</style>
      </head>
      <body>
        <div class="header">
          <h1>${kitchenLabel}</h1>
        </div>

        <div class="separator"></div>

        <div style="margin: 8px 0;">
          <div style="font-size: 11pt; font-weight: bold; margin-bottom: 4px; white-space: normal; overflow-wrap: anywhere;">
            ${escapeHtml(order.orderNumber)} - ${receiptDate(order.orderDate, options)}
          </div>
          <div>
            <strong>${escapeHtml(translate('type', 'Type'))}:</strong> ${escapeHtml(receiptOrderTypeLabel(order.type, t))}${order.type === 'DineIn' && tableLabel ? ` - ${escapeHtml(translate('table', 'Table'))} ${escapeHtml(tableLabel)}` : ''}
          </div>
        </div>

        ${
          includeCustomerDetails && order.customerName
            ? `
          <div style="margin: 8px 0; padding: 6px; background: #f5f5f5;">
            <strong>${escapeHtml(translate('customer', 'Customer'))}:</strong> ${escapeHtml(order.customerName)}
          </div>
        `
            : ''
        }

        <div class="double-separator"></div>

        <div style="margin: 8px 0;">
          ${itemsHtml}
        </div>

        ${marketplaceReceiptHtml(order, translate, showPrices)}
        ${order.notes ? `<div dir="auto"><strong>${escapeHtml(translate('notes', 'Notes'))}:</strong> ${escapeHtml(order.notes)}</div>` : ''}
        ${totalsHtml}

        <div class="separator"></div>

        <div style="text-align: center; font-size: 9pt; color: #666;">
          ${escapeHtml(translate('date', 'Printed'))}: ${receiptDate(new Date(), options)}
        </div>
      </body>
    </html>
  `;
};
