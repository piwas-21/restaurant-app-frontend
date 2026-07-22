'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { useCartPage } from '@/hooks/cart/useCartPage';
import CartItemCard from './CartItemCard';
import CartSummary from './CartSummary';

type CssModule = Readonly<Record<string, string>>;

interface CartPageLayoutProps {
  /**
   * Per-area CSS modules from the host template (the CheckoutReviewLayout
   * pattern): `page` styles this layout's own chrome, `item` is forwarded to
   * every CartItemCard (and its customizations/instructions bodies), `summary`
   * to CartSummary. Classic passes its single CartPage.module.css for all
   * three; craft splits them to stay under the per-module LOC limit.
   */
  styles: {
    page: CssModule;
    item: CssModule;
    summary: CssModule;
  };
}

/**
 * The /cart page orchestration shared by the classic and craft templates —
 * one `useCartPage` wiring, one DOM; the templates differ only in the CSS
 * modules they pass (ADR-006 cart surface; relocated from app/cart/page.tsx).
 */
export default function CartPageLayout({ styles }: Readonly<CartPageLayoutProps>) {
  const { t } = useTranslation();
  const {
    state,
    getTotal,
    getItemCount,
    isResolving,
    customerHasDiscount,
    promoCode,
    setPromoCode,
    isApplyingPromo,
    editingInstructions,
    setEditingInstructions,
    instructionsValue,
    setInstructionsValue,
    handleCheckout,
    handleRemoveItem,
    handleUpdateQuantity,
    handleApplyPromoCode,
    handleRemovePromoCode,
    handleSaveInstructions,
  } = useCartPage();

  if (state.items.length === 0) {
    return (
      <main className={styles.page.cartContainer} aria-labelledby="cart-heading">
        <h1 id="cart-heading" className={styles.page.pageTitle}>
          {t('cart_title', 'Your Cart')}
        </h1>
        <div className={styles.page.emptyCartContainer}>
          <ShoppingCart className={styles.page.emptyCartIcon} size={64} />
          <p className={styles.page.emptyCartMessage}>{t('cart_empty_message', 'Your cart is empty')}</p>
          <Link href="/menu" className={styles.page.emptyCartLink}>
            {t('cart_browse_menu_button', 'Browse Menu')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page.cartContainer} aria-labelledby="cart-heading">
      <h1 id="cart-heading" className={styles.page.pageTitle}>
        {t('cart_title', 'Your Cart')}
      </h1>

      {/* Loading State */}
      {state.isLoading && (
        <div className={styles.page.loadingContainer}>
          <Loader2 className={styles.page.spinner} size={32} />
          <p>{t('loading', 'Loading...')}</p>
        </div>
      )}

      {/* Error State */}
      {state.error && (
        <div className={styles.page.errorContainer}>
          <p className={styles.page.errorMessage}>{state.error}</p>
        </div>
      )}

      <div className={styles.page.cartContent}>
        {/* Cart Items */}
        <div className={styles.page.cartItemsList}>
          {state.items.map((item) => (
            <CartItemCard
              key={item.basketItemId || item.id || item.productId}
              item={item}
              isSyncing={state.isSyncing}
              editingInstructions={editingInstructions}
              setEditingInstructions={setEditingInstructions}
              instructionsValue={instructionsValue}
              setInstructionsValue={setInstructionsValue}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onSaveInstructions={handleSaveInstructions}
              styles={styles.item}
            />
          ))}
        </div>

        <CartSummary
          basket={state.basket}
          isSyncing={state.isSyncing}
          promoCode={promoCode}
          setPromoCode={setPromoCode}
          isApplyingPromo={isApplyingPromo}
          customerHasDiscount={customerHasDiscount}
          getTotal={getTotal}
          getItemCount={getItemCount}
          isResolving={isResolving}
          onApplyPromoCode={handleApplyPromoCode}
          onRemovePromoCode={handleRemovePromoCode}
          onCheckout={handleCheckout}
          styles={styles.summary}
        />
      </div>
    </main>
  );
}
