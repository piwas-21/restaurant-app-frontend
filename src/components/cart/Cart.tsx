// src/components/cart/Cart.tsx
"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from './CartContext';
import styles from "../../app/styles/Cart.module.css";
import Link from 'next/link';

interface CartProps {
  showProceedButton?: boolean;
}

export default function Cart({ showProceedButton = true }: CartProps) {
  const { t } = useTranslation();
  const { state, dispatch } = useCart();

  const handleRemoveItem = (itemId: string, itemName: string) => {
    console.log(`Removing item: ${itemName}`);
    dispatch({ type: 'REMOVE_ITEM', payload: { id: itemId } });
  };

  const handleUpdateQuantity = (itemId: string, quantity: number, itemName: string) => {
    console.log(`Updating quantity for item: ${itemName} to ${quantity}`);
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: itemId, quantity } });
  };

  const calculateTotal = () => {
    return state.items.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2);
  };

  if (state.items.length === 0) {
    return (
      <div className={styles.cartContainer} role="region" aria-labelledby="cart-heading-empty">
        <h2 id="cart-heading-empty">{t("cart_title", 'Your Cart')}</h2>
        <p>{t('cart_empty_message', 'Your cart is empty.')} <Link href="/menu">{t('browse_our_menu', 'Browse our menu')}</Link> {t('to_add_items', 'to add items')}.</p>
      </div>
    );
  }

  return (
    <div className={styles.cartContainer} role="region" aria-labelledby="cart-heading-full">
      <h2 id="cart-heading-full">{t("cart_title", 'Your Cart')}</h2>
      <ul className={styles.cartItemsList} aria-label="Items in your cart">
        {state.items.map((item) => (
          <li key={item.id} className={styles.cartItem} role="listitem">
            <div className={styles.itemInfo}>
              <span>{item.name} (CHF {item.price.toFixed(2)})</span>
            </div>
            <div className={styles.itemControls}>
              <label htmlFor={`quantity-${item.id}`} className="sr-only">{t('quantity_for', ' Quantity for')} {item.name}</label>
              <input
                type="number"
                id={`quantity-${item.id}`}
                value={item.quantity}
                onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value, 10), item.name)}
                min="1"
                className={styles.quantityInput}
                aria-label={`Quantity for ${item.name}`}
              />
              <button 
                onClick={() => handleRemoveItem(item.id, item.name)} 
                className={styles.removeButton}
                aria-label={`Remove ${item.name} from cart`}
              >
                {t('cart_remove_item_button', 'Remove')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className={styles.cartTotal} role="status" aria-live="polite">
        <h3>{t('total_price_header', 'Total')}: CHF {calculateTotal()}</h3>
      </div>
      {showProceedButton && (
        <Link href="/checkout" className={styles.checkoutButton} role="button">
          {t('cart_proceed_to_checkout_button', 'Proceed to Checkout')}
        </Link>
      )}
    </div>
  );
}
