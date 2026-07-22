'use client';

// craft CheckoutReviewPage (ADR-006 — Prompt 6). A two-column hand-written-bill
// re-skin of the checkout review/confirm step: warm-cream canvas, masking-tape
// section labels, and a kraft-paper receipt summary with a terracotta letterpress
// "Place order" pill. Same behaviour as classic (shared `CheckoutReviewLayout` +
// `useCheckoutReview`); the look comes entirely from this craft CSS bundle.
//
// The interactive payment / tip / points selectors keep their shared styling for
// now — their craft paper-tab redesign is the next checkout PR.
import React from 'react';
import CheckoutReviewLayout from '@/components/checkout/CheckoutReviewLayout';
import page from './checkout/CheckoutReviewPage.module.css';
import sections from './checkout/sections.module.css';
import orderItems from './checkout/OrderItemsList.module.css';
import payment from './checkout/PaymentMethodSelector.module.css';
import tip from './checkout/TipSelector.module.css';
import summary from './checkout/OrderSummaryCard.module.css';

export default function CheckoutReviewPage() {
  return (
    <CheckoutReviewLayout
      styles={{ page, orderType: sections, customerInfo: sections, orderItems, payment, tip, summary }}
    />
  );
}
