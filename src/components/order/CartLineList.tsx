'use client';

import { useTranslation } from 'react-i18next';
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
  const { i18n } = useTranslation();
  const language = i18n.language?.split('-')[0] || 'en';

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
              {/* product-authored text: dir="auto" so an English name inside an Arabic page keeps its own punctuation (DESIGN-SYSTEM.md §8.2) */}
              <span dir="auto" className={styles.itemName}>
                {item.productName}
              </span>
              <span className={styles.itemPrice}>{formatPlainCurrency(item.itemTotal)}</span>
            </div>
            {/* `showVariation`: the chosen size, which the /cart card and the checkout list have
                always drawn and this list did not — so the basket flyout, the only cart surface on
                /menu since the rail left it, was the one place a guest could not check WHICH
                variation they had added. It rides in the summary rather than beside the name so
                both templates get it from one stylesheet. */}
            <OrderLineSummary line={basketItemToLineSummary(item, language)} showVariation />
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
