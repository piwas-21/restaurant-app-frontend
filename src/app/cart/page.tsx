'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { useCartPage } from '@/hooks/cart/useCartPage';
import CartItemCard from '@/components/cart/cart-page/CartItemCard';
import CartSummary from '@/components/cart/cart-page/CartSummary';
import styles from '../styles/CartPage.module.css';

export default function CartPage() {
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
      <main className={styles.cartContainer} aria-labelledby="cart-heading">
        <h1 id="cart-heading" className={styles.pageTitle}>
          {t('cart_title', 'Your Cart')}
        </h1>
        <div className={styles.emptyCartContainer}>
          <ShoppingCart className={styles.emptyCartIcon} size={64} />
          <p className={styles.emptyCartMessage}>{t('cart_empty_message', 'Your cart is empty')}</p>
          <Link href="/menu" className={styles.emptyCartLink}>
            {t('cart_browse_menu_button', 'Browse Menu')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.cartContainer} aria-labelledby="cart-heading">
      <h1 id="cart-heading" className={styles.pageTitle}>
        {t('cart_title', 'Your Cart')}
      </h1>

      {/* Loading State */}
      {state.isLoading && (
        <div className={styles.loadingContainer}>
          <Loader2 className={styles.spinner} size={32} />
          <p>{t('loading', 'Loading...')}</p>
        </div>
      )}

      {/* Error State */}
      {state.error && (
        <div className={styles.errorContainer}>
          <p className={styles.errorMessage}>{state.error}</p>
        </div>
      )}

      <div className={styles.cartContent}>
        {/* Cart Items */}
        <div className={styles.cartItemsList}>
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
        />
      </div>
    </main>
  );
}
