// src/app/cart-mobile/page.tsx
"use client";

import React from "react";
// import type { Metadata } from "next"; // Static metadata
import styles from "../styles/CartMobile.module.css";
import { useCart } from "@/components/cart/CartContext";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "react-i18next"; // Import useTranslation

// export const metadata: Metadata = {
//   title: "Your Cart - RUMI Restaurant Mobile", // Will be translated by t function if needed in document head
//   description: "Review your order and proceed to checkout at RUMI Restaurant.",
// };

export default function CartMobilePage() {
  const { t } = useTranslation(); // Initialize useTranslation
  const { state, dispatch } = useCart();

  const handleRemoveItem = (itemId: string) => {
    dispatch({ type: "REMOVE_ITEM", payload: { id: itemId } });
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    if (quantity < 1) {
      dispatch({ type: "REMOVE_ITEM", payload: { id: itemId } });
      return;
    }
    dispatch({ type: "UPDATE_QUANTITY", payload: { id: itemId, quantity } });
  };

  const calculateTotal = () => {
    return state.items.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2);
  };

  const totalCartItems = state.items.reduce((sum, item) => sum + item.quantity, 0);

  if (state.items.length === 0) {
    return (
      <main className={styles.cartMobileContainer} aria-labelledby="cart-heading">
        <header className={styles.cartHeader}>
          <Link href="/menu-mobile" className={styles.backButton} aria-label={t("back_to_menu")}>
            &larr;
          </Link>
          <h1 id="cart-heading">{t("cart_title")}</h1>
          <span style={{width: "40px"}}></span> {/* Spacer */}
        </header>
        <div className={styles.emptyCartMessage}>
          <p>{t("cart_empty_message")}</p>
          <Link href="/menu-mobile" className={styles.browseMenuButton}>
            {t("browse_menu_button")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.cartMobileContainer} aria-labelledby="cart-main-heading">
      <header className={styles.cartHeader}>
        <Link href="/menu-mobile" className={styles.backButton} aria-label={t("back_to_menu")}>
          &larr;
        </Link>
        <h1 id="cart-main-heading">{t("cart_title")}</h1>
        <span style={{width: "40px"}}></span> {/* Spacer */}
      </header>

      <ul className={styles.cartItemsListMobile} aria-label={t("items_in_your_cart")}>
        {state.items.map((item) => (
          <li key={item.id} className={styles.cartItemMobile} role="listitem">
            <div className={styles.itemImageContainerCartMobile}>
              <Image src={item.image_url || "/placeholder-sarma.jpg"} alt={item.name} width={60} height={60} className={styles.itemImageCartMobile} />
            </div>
            <div className={styles.itemDetailsCartMobile}>
              <span className={styles.itemNameCartMobile}>{item.name}</span> {/* Item name comes from cart context, already translated when added */}
              <span className={styles.itemPriceCartMobile}>CHF {item.price.toFixed(2)}</span>
            </div>
            <div className={styles.itemControlsCartMobile}>
              <button 
                onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} 
                className={styles.quantityButtonCartMobile}
                aria-label={t("decrease_quantity_of_item", { itemName: item.name })}
              >
                -
              </button>
              <span className={styles.quantityDisplayCartMobile} aria-live="polite" aria-atomic="true">
                {item.quantity}
              </span>
              <button 
                onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} 
                className={styles.quantityButtonCartMobile}
                aria-label={t("increase_quantity_of_item", { itemName: item.name })}
              >
                +
              </button>
              <button 
                onClick={() => handleRemoveItem(item.id)} 
                className={styles.removeButtonCartMobile}
                aria-label={t("remove_item_from_cart", { itemName: item.name })}
              >
                &times;
              </button>
            </div>
          </li>
        ))}
      </ul>

      <footer className={styles.cartFooterMobile}>
        <div className={styles.cartTotalMobile} role="status">
          <span>{t("total_cart_items_price", { count: totalCartItems })}</span>
          <span className={styles.totalAmountMobile}>CHF {calculateTotal()}</span>
        </div>
        <Link href="/checkout-mobile" className={styles.checkoutButtonMobile} role="button">
          {t("proceed_to_checkout")}
        </Link>
      </footer>
    </main>
  );
}

