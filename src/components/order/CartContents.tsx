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
  const {
    items,
    itemCount,
    subtotal,
    blockerMessage,
    orderTypeAttempts,
    error,
    isSyncing,
    isResolving,
    handleQty,
    handleRemove,
    handleCheckout,
    handlePick,
  } = useCartContents(props);

  return (
    <>
      <OrderTypeToggle onPick={handlePick} focusSignal={orderTypeAttempts} />

      {/* Above the list, because it usually explains why the list just changed — a reaped basket
          resyncs to empty, and without this the cart emptied with no word of why (#415).
          role="alert", not <output>: this is a failure, not a running commentary. */}
      {error && (
        <div className={styles.cartError} role="alert">
          {error}
        </div>
      )}

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

      {/* Only an empty cart truly disables the CTA. A missing order type leaves it
          live so the click can explain itself (and the hint below says so up front)
          — a dead disabled button with no reason was the original complaint. */}
      <CartCheckoutButton
        disabled={itemCount === 0 || isResolving}
        onClick={handleCheckout}
        className={styles.checkoutButton}
      />

      {/* <output>, not role="status" — it carries the same implicit live-region
          semantics as a real element rather than a bolted-on role (Sonar S6819).
          Drawn as a NOTICE rather than a grey footnote: measured on the flyout it read as
          disclaimer text under a live-looking CTA, so a guest pressed Proceed, nothing appeared to
          happen, and the one sentence explaining it was the least prominent thing on the panel.
          The click also sends them to the toggle — see `orderTypeAttempts`. */}
      {blockerMessage && <output className={styles.checkoutHint}>{blockerMessage}</output>}
    </>
  );
}
