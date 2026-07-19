'use client';

import { formatPlainCurrency } from '@/utils/currency';
import type { CartItem } from '@/components/cart/cartTypes';
import OrderLineSummary from './OrderLineSummary';
import CartLineControls from './CartLineControls';
import { basketItemToLineSummary } from './lineSummary';

interface CartLineListProps {
  items: CartItem[];
  /** Cart sync in flight — disables each line's controls. */
  disabled: boolean;
  onQty: (itemId: string | undefined, next: number) => void;
  onRemove: (itemId: string | undefined) => void;
  /**
   * Host template's CSS module — must define `itemList`, `item`, `itemName`,
   * `itemPrice` plus the CartLineControls keys. Classic and craft both do, so the
   * line list is shared (Sonar new-code dedup) and differs only in CSS.
   */
  styles: Readonly<Record<string, string>>;
  /** The per-line header wrapper class (classic `itemRow` vs craft `leader`). */
  headerClassName: string;
}

/**
 * The cart's line list — each line a name + price header, the shared
 * customization summary, and the remove/stepper controls — shared by the classic
 * `CartContents` and craft `CraftCartContents`. Only the header wrapper class and
 * the passed-in CSS module differ between templates.
 */
export default function CartLineList({
  items,
  disabled,
  onQty,
  onRemove,
  styles,
  headerClassName,
}: Readonly<CartLineListProps>) {
  return (
    <ul className={styles.itemList}>
      {items.map((item, index) => {
        const itemId = item.basketItemId || item.id || item.productId;
        return (
          // Real cart items always carry basketItemId/id/productId; the index
          // fallback only guards the degenerate all-undefined case (avoids a
          // `key={undefined}` warning). Keys are not rendered, so classic DOM
          // stays byte-identical.
          <li key={itemId ?? index} className={styles.item}>
            <div className={headerClassName}>
              <span className={styles.itemName}>{item.productName}</span>
              <span className={styles.itemPrice}>{formatPlainCurrency(item.itemTotal)}</span>
            </div>
            <OrderLineSummary line={basketItemToLineSummary(item)} />
            <CartLineControls
              quantity={item.quantity}
              disabled={disabled}
              onRemove={() => onRemove(itemId)}
              onDecrement={() => onQty(itemId, item.quantity - 1)}
              onIncrement={() => onQty(itemId, item.quantity + 1)}
              styles={styles}
            />
          </li>
        );
      })}
    </ul>
  );
}
