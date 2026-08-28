/**
 * HTML building blocks shared by the two thermal-receipt templates (kitchen ticket + customer bill).
 *
 * `buildChildItemsHtml` exists because `OrderDto.items` has been ROOT-ONLY since backend #237
 * (issue #234): bundle components and add-on sides hang off their parent's `sideItems` instead of
 * appearing as top-level entries, so a template that prints only the top level silently omits
 * everything inside a combo. It recurses because the backend builds the tree to arbitrary depth.
 */
import { OrderItemDto } from '@/types/order';
import { formatCurrency } from '../currency';

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
  /** Heading printed above the children, e.g. the kitchen ticket's "Additionals:". Omitted ⇒ none. */
  heading?: string;
}

/** Render an item's child rows (bundle components + add-on sides), indented one level per depth. */
export const buildChildItemsHtml = (children: OrderItemDto[], options: ChildItemsOptions, depth = 1): string => {
  if (children.length === 0) return '';

  const indent = 16 * depth;
  let html = options.heading
    ? `<div style="margin-left: ${indent}px; font-size: 11pt; margin-top: 4px;"><strong>${escapeHtml(options.heading)}</strong></div>`
    : '';

  children.forEach((child) => {
    // `> 0`, not just `showPrices` — see ChildItemsOptions. Same rule as OrderLineSummary.tsx.
    const childPrice = options.showPrices && child.itemTotal > 0 ? ` (${formatCurrency(child.itemTotal)})` : '';
    const childQuantity = child.quantity > 1 ? ` x${child.quantity}` : '';
    html += `<div style="margin-left: ${indent + 8}px; font-size: 11pt;">+ ${escapeHtml(child.productName || 'Item')}${childQuantity}${childPrice}</div>`;
    html += buildChildItemsHtml(child.sideItems ?? [], options, depth + 1);
  });

  return html;
};
