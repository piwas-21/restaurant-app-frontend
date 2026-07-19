'use client';

import { formatPlainCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { ShoppingCart } from 'lucide-react';
import { useCartContents, type UseCartContentsArgs } from '@/hooks/order/useCartContents';
import OrderTypeToggle from './OrderTypeToggle';
import CartLineList from './CartLineList';
import CartCheckoutButton from './CartCheckoutButton';
import styles from './CartContents.module.css';

export type CartContentsProps = UseCartContentsArgs;

/**
 * Cart-half rendering shared by the desktop sidebar (`OrderFlowSidebar`) and the
 * mobile bottom-sheet (`MobileCartSheet`). Owns no chrome — the caller wraps it
 * in `<aside>` (sidebar) or `BaseModal` (sheet). Cart state + actions come from
 * `useCartContents`; the line list + CTA are shared with the craft surface
 * (`CraftCartContents`), so the two differ only in CSS + heading/empty/total copy.
 */
export default function CartContents(props: Readonly<CartContentsProps>) {
  const { t } = useTranslation();
  const { items, subtotal, canCheckout, isSyncing, isResolving, handleQty, handleRemove, handleCheckout, handlePick } =
    useCartContents(props);

  return (
    <>
      <OrderTypeToggle onPick={handlePick} />

      {items.length === 0 ? (
        <div className={styles.empty}>
          <ShoppingCart size={36} aria-hidden="true" />
          <p>{t('cart_empty_message', 'Your cart is empty')}</p>
        </div>
      ) : (
        <CartLineList
          items={items}
          disabled={isSyncing}
          onQty={handleQty}
          onRemove={handleRemove}
          styles={styles}
          headerClassName={styles.itemRow}
        />
      )}

      <div className={styles.totalRow}>
        <span>{t('cart_total_label', 'Total')}</span>
        <span className={styles.totalValue}>{formatPlainCurrency(subtotal)}</span>
      </div>

      <CartCheckoutButton
        disabled={!canCheckout || isResolving}
        onClick={handleCheckout}
        className={styles.checkoutButton}
      />
    </>
  );
}
