// src/app/checkout-mobile/page.tsx
"use client";

import React, { useState } from "react";
import styles from "../styles/CheckoutMobile.module.css";
import { useCart } from "@/components/cart/CartContext";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function CheckoutMobilePage() {
  const { t } = useTranslation();
  const { state } = useCart();
  const [orderType, setOrderType] = useState<"pickup" | "dine-in">("pickup");
  const [tableNumber, setTableNumber] = useState("");
  const [tipPercentage, setTipPercentage] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const calculateSubtotal = () => {
    return state.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  };

  const subtotal = calculateSubtotal();
  let tipAmount = 0;
  if (customTip) {
    tipAmount = parseFloat(customTip) || 0;
  } else if (tipPercentage > 0) {
    tipAmount = subtotal * (tipPercentage / 100);
  }

  const total = subtotal + tipAmount;

  const handlePayrexxPayment = async () => {
    if ((orderType === "pickup" || orderType === "dine-in") && (!name || !phone)) { // Name & Phone for both if payment is upfront
      alert(t("checkout_place_order_pickup_validation")); // Generic validation, customize if needed
      return;
    }
    // if (orderType === "dine-in" && !tableNumber) { // Table number if dine-in
    //   alert(t("checkout_place_order_dine_in_validation"));
    //   return;
    // }

    setIsProcessingPayment(true);
    const referenceId = `RUMI-MOBILE-ORDER-${Date.now()}`;
    const paymentData = {
      amount: total,
      currency: 'CHF',
      referenceId: referenceId,
      successRedirectUrl: `${window.location.origin}/payment-success?orderId=${referenceId}`,
      failedRedirectUrl: `${window.location.origin}/payment-failed?orderId=${referenceId}`,
      cancelRedirectUrl: `${window.location.origin}/checkout-mobile`,
      customer: {
        firstName: name.split(' ')[0] || 'Rumi',
        lastName: name.split(' ').slice(1).join(' ') || 'Customer',
        email: 'default-mobile@example.com', // Placeholder
        phone: phone,
      },
      // orderDetails: { items: state.items, orderType, tableNumber, tipAmount } // Optional
    };

    try {
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || 'Payment initiation failed (mobile).');
      }

      const result = await response.json();
      if (result.link) {
        console.log("Order details to be saved (mobile) before redirect:", {
            referenceId,
            items: state.items,
            orderType,
            tableNumber, // if relevant
            customerName: name,
            customerPhone: phone,
            subtotal: subtotal.toFixed(2),
            tipAmount: tipAmount.toFixed(2),
            total: total.toFixed(2),
            paymentStatus: 'pending_payrexx' 
        });
        // dispatch({ type: 'CLEAR_CART' });
        window.location.href = result.link;
      } else {
        throw new Error('No payment link received from Payrexx (mobile).');
      }
    } catch (error) {
      console.error("Payrexx payment error (mobile):", error);
      alert(`Error: ${error instanceof Error ? error.message : 'Could not initiate Payrexx payment.'}`);
      setIsProcessingPayment(false);
    }
  };

  // This function would be for a separate Cash/COD order button if retained
  // const handlePlaceCashOrder = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (orderType === "pickup" && (!name || !phone)) {
  //     alert(t("checkout_place_order_pickup_validation"));
  //     return;
  //   }
  //   if (orderType === "dine-in" && !tableNumber) {
  //     alert(t("checkout_place_order_dine_in_validation"));
  //     return;
  //   }
  //   console.log("Mobile Order Placed (Cash/Card):", {
  //     items: state.items, orderType, tableNumber, name, phone, subtotal, tipAmount, total,
  //     paymentMethod: "Cash/Card"
  //   });
  //   alert(t("checkout_order_placed_success"));
  //   // dispatch({ type: 'CLEAR_CART' });
  // };


  if (state.items.length === 0 && !isProcessingPayment) {
    return (
      <main className={styles.checkoutMobileContainer} aria-labelledby="checkout-heading">
        <header className={styles.checkoutHeader}>
          <Link href="/cart-mobile" className={styles.backButton} aria-label={t("back_to_cart")}>
            &larr;
          </Link>
          <h1 id="checkout-heading">{t("checkout_title")}</h1>
          <span style={{width: "40px"}}></span>
        </header>
        <div className={styles.emptyMessageContainer}>
          <p>{t("checkout_empty_cart_message_1")}</p> {/* Adjusted to use the more descriptive key if available */}
          <Link href="/menu-mobile" className={styles.actionButton}>
            {t("checkout_empty_cart_message_2")} 
          </Link>
           {t("checkout_empty_cart_message_3")}
        </div>
      </main>
    );
  }

  return (
    <main className={styles.checkoutMobileContainer} aria-labelledby="checkout-main-heading">
      {isProcessingPayment && <div className={styles.overlayMobile}><p>{t('checkout_processing_payment')}...</p></div>}
      <header className={styles.checkoutHeader}>
        <Link href="/cart-mobile" className={styles.backButton} aria-label={t("back_to_cart")}>
          &larr;
        </Link>
        <h1 id="checkout-main-heading">{t("checkout_confirm_order")}</h1>
        <span style={{width: "40px"}}></span>
      </header>

      {/* Changed from form to div to avoid default form submission for Payrexx button */}
      <div className={styles.checkoutFormMobile}>
        <section className={styles.orderSummarySectionMobile} aria-labelledby="summary-heading">
          <h2 id="summary-heading" className={styles.srOnly}>{t("checkout_order_summary")}</h2>
          {state.items.map(item => (
            <div key={item.id} className={styles.summaryItemMobile}>
              <span>{item.name} (x{item.quantity})</span>
              <span>CHF {(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className={styles.summaryTotalMobile}>
            <strong>{t("checkout_subtotal_label")} CHF {subtotal.toFixed(2)}</strong>
          </div>
        </section>

        <section className={styles.orderDetailsSectionMobile} aria-labelledby="details-heading">
          <h2 id="details-heading" className={styles.srOnly}>{t("checkout_order_details")}</h2>
          <div className={styles.formGroupMobile}>
            <label htmlFor="customerNameMobile">{t("checkout_customer_name_label")}</label>
            <input
              type="text"
              id="customerNameMobile"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.textInputMobile}
              placeholder={t("checkout_customer_name_placeholder")}
              required
              disabled={isProcessingPayment}
            />
          </div>
          <div className={styles.formGroupMobile}>
            <label htmlFor="customerPhoneMobile">{t("checkout_customer_phone_label")}</label>
            <input
              type="tel"
              id="customerPhoneMobile"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={styles.textInputMobile}
              placeholder={t("checkout_customer_phone_placeholder")}
              required
              disabled={isProcessingPayment}
            />
          </div>
          
          <div className={styles.formGroupMobile}>
            <label htmlFor="orderTypeMobile">{t("checkout_order_type_label")}</label>
            <select
              id="orderTypeMobile"
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as "pickup" | "dine-in")}
              className={styles.selectInputMobile}
              disabled={isProcessingPayment}
            >
              <option value="pickup">{t("checkout_order_type_pickup")}</option>
              {/* <option value="dine-in">{t("checkout_order_type_dine_in")}</option> */}
            </select>
          </div>

          {orderType === "dine-in" && (
            <div className={styles.formGroupMobile}>
              <label htmlFor="tableNumberMobile">{t("checkout_table_number_label")}</label>
              <input
                type="text"
                id="tableNumberMobile"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className={styles.textInputMobile}
                placeholder={t("checkout_table_number_placeholder")}
                required={orderType === 'dine-in'}
                disabled={isProcessingPayment}
              />
            </div>
          )}
        </section>

        <section className={styles.tipSectionMobile} aria-labelledby="tip-heading-mobile">
          <h2 id="tip-heading-mobile" className={styles.srOnly}>{t("checkout_add_tip_label")}</h2>
          <div className={styles.tipOptionsMobile} role="group" aria-label={t("checkout_tip_options_aria_label")}>
            {[10, 15, 20].map(perc => (
                <button 
                    key={perc} 
                    type="button" 
                    onClick={() => { setTipPercentage(perc); setCustomTip(""); }} 
                    className={`${styles.tipButtonMobile} ${tipPercentage === perc && !customTip ? styles.activeTipMobile : ""}`}
                    aria-pressed={tipPercentage === perc && !customTip}
                    disabled={isProcessingPayment}
                >
                    {perc}%
                </button>
            ))}
          </div>
          <div className={styles.formGroupMobile}>
            <label htmlFor="customTipMobile">{t("checkout_custom_tip_label")}</label>
            <input
              type="number"
              id="customTipMobile"
              value={customTip}
              onChange={(e) => { setCustomTip(e.target.value); setTipPercentage(0); }}
              className={styles.textInputMobile}
              placeholder={t("checkout_custom_tip_placeholder")}
              min="0"
              step="0.01"
              disabled={isProcessingPayment}
            />
          </div>
        </section>

        <div className={styles.finalTotalSectionMobile} aria-live="polite">
          <p>{t("checkout_subtotal_label")} <span className={styles.amount}>CHF {subtotal.toFixed(2)}</span></p>
          <p>{t("checkout_tip_label")} <span className={styles.amount}>CHF {tipAmount.toFixed(2)}</span></p>
          <p className={styles.grandTotal}>{t("checkout_total_label")} <span className={styles.amountBold}>CHF {total.toFixed(2)}</span></p>
        </div>

        <section className={styles.paymentOptionsSectionMobile} aria-labelledby="payment-options-heading-mobile">
            <h2 id="payment-options-heading-mobile" className={styles.srOnly}>{t('checkout_payment_options_label')}</h2>
            <button 
              type="button" 
              onClick={handlePayrexxPayment} 
              className={`${styles.paymentButtonMobile} ${styles.payrexxButtonMobile}`}
              aria-label={t('checkout_payrexx_aria_label')}
              disabled={isProcessingPayment || state.items.length === 0}
            >
              {isProcessingPayment ? t('checkout_processing_payment') : t('checkout_pay_with_payrexx')}
            </button>
        </section>

        {/* If you need a separate cash order button, it would go here, outside the Payrexx button, potentially in its own form */}
        {/* Example:
        <form onSubmit={handlePlaceCashOrder} style={{marginTop: '1rem'}}>
            <button type="submit" className={styles.placeOrderButtonMobile} disabled={isProcessingPayment || state.items.length === 0}>
                {t('checkout_place_order_button')} (Cash)
            </button>
        </form>
        */}
      </div>
    </main>
  );
}

