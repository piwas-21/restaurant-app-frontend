/**
 * HTML building blocks shared by the two thermal-receipt templates (kitchen ticket + customer bill).
 *
 * `buildChildItemsHtml` exists because `OrderDto.items` has been ROOT-ONLY since backend #237
 * (issue #234): bundle components and add-on sides hang off their parent's `sideItems` instead of
 * appearing as top-level entries, so a template that prints only the top level silently omits
 * everything inside a combo. It recurses because the backend builds the tree to arbitrary depth.
 */
import { OrderItemDto, OrderItemIngredientDto } from '@/types/order';
import {
  receiptItems,
  receiptItemName,
  quantityScopeSuffix,
  receiptFallback,
  type ReceiptTranslate,
} from './receiptPresentation';
import { formatCurrency } from '../currency';
import { formatOrderCurrency, type CashierCurrencySource } from '@/lib/cashierMoney';

/**
 * The ingredient rows a KITCHEN must act on, and their ticket lines. A row qualifies when it is a
 * removal, an above-default quantity, or a PAID EXTRA the guest opted into (`isAddOn` — a freshly
 * chosen add-on carries quantity 1, which is why quantity alone cannot say it; the old
 * quantity-only filter is what dropped every chosen sauce from the printed ticket). An add-on row
 * at quantity 0 was never picked, so the quantity half of the rule drops it.
 * Shared by the root items and the bundle-component rows — one filter, two depths.
 */
export const customizedIngredientRows = (item: OrderItemDto): OrderItemIngredientDto[] =>
  item.ingredientCustomizations?.filter(
    (ing) => ing.isRemoved || ing.quantity > 1 || (ing.isAddOn === true && ing.quantity > 0),
  ) ?? [];

/** Explicit removal or extra, with frozen count scope when available. */
export const ingredientRowHtml = (
  ing: OrderItemIngredientDto,
  indent: number,
  translate: ReceiptTranslate = receiptFallback,
  parentQuantity = 1,
): string => {
  const base = `margin-inline-start: calc(var(--receipt-indent, 16px) * ${indent / 16}); font-size: var(--receipt-detail-size, 11pt);`;
  if (ing.isRemoved) {
    return `<div dir="auto" style="${base}">${escapeHtml(translate('no', 'NO'))} ${escapeHtml(ing.ingredientName)}</div>`;
  }
  const count = ing.quantity > 1 ? `${ing.quantity}x ` : '';
  const scope = escapeHtml(quantityScopeSuffix(ing, parentQuantity, translate));
  return `<div dir="auto" style="${base}">+ ${count}${escapeHtml(ing.ingredientName)}${scope}</div>`;
};

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
};

export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

export interface ChildItemsOptions {
  /**
   * Print each child's own total WHEN IT HAS ONE. A child row carries `itemTotal = 0` by convention
   * (the parent's total already includes the rolled-up combo price — backend
   * `OrderItemFactory.cs:108-131`), and a zero is suppressed below rather than printed as a bare
   * `CHF 0.00` beside every component.
   *
   * The customer bill turns this off outright. The kitchen ticket turns it ON for `kitchenType`
   * `'All'` — its own comment calls that ticket customer-facing — which is how the 0.00 reached
   * paper: every combo and every add-on side printed one. The screen has always been right about
   * this (`OrderLineSummary.tsx` prints a side's price only when `> 0`); the receipt was the copy
   * that disagreed.
   */
  showPrices: boolean;
  translate?: ReceiptTranslate;
  parentQuantity?: number;
  currencySource?: CashierCurrencySource;
  /** Include frozen ingredient changes; the parent remains the only charge on a customer bill. */
  withIngredients?: boolean;
}

function childPriceHtml(child: OrderItemDto, options: ChildItemsOptions): string {
  if (!options.showPrices || child.itemTotal <= 0) return '';
  const money = options.currencySource
    ? formatOrderCurrency(child.itemTotal, options.currencySource)
    : formatCurrency(child.itemTotal);
  return ` (${money})`;
}
/** Render an item's child rows (bundle components + add-on sides), indented one level per depth. */
export const buildChildItemsHtml = (children: OrderItemDto[], options: ChildItemsOptions, depth = 1): string => {
  if (children.length === 0) return '';

  const indent = 16 * depth;
  let html = '';

  const translate = options.translate ?? receiptFallback;
  receiptItems(children).forEach((child) => {
    const childPrice = childPriceHtml(child, options);
    const scope = escapeHtml(quantityScopeSuffix(child, options.parentQuantity ?? 1, translate));
    const displayName = receiptItemName(child, translate('item', 'Item'));
    const name = escapeHtml(displayName);
    const content =
      child.compositionRole === 'Dish'
        ? `<strong>${child.quantity}x ${name}${scope}</strong>${childPrice}`
        : `${child.compositionRole === 'Extra' ? '+ ' : ''}${child.quantity}x ${name}${scope}${childPrice}`;
    html += `<div class="receipt-child" dir="auto" style="margin-inline-start: calc(var(--receipt-indent, 16px) * ${depth} + var(--receipt-child-offset, 8px)); font-size: var(--receipt-detail-size, 11pt);">${content}</div>`;
    const descendants = child.sideItems ?? [];
    const nextOptions = {
      ...options,
      parentQuantity: child.quantity,
    };
    html += buildChildItemsHtml(
      descendants.filter((row) => row.compositionRole === 'RequiredChoice'),
      nextOptions,
      depth + 1,
    );
    if (options.withIngredients) {
      customizedIngredientRows(child).forEach((ing) => {
        html += ingredientRowHtml(ing, indent + 16, translate, child.quantity);
      });
    }
    html += buildChildItemsHtml(
      descendants.filter((row) => row.compositionRole !== 'RequiredChoice'),
      nextOptions,
      depth + 1,
    );
  });

  return html;
};
