'use client';

// classic CheckoutReviewPage (ADR-006 — Prompt 6). The original RUMI checkout
// review look, extracted as-is: renders the shared `CheckoutReviewLayout` with
// the classic CSS-module bundle. Each child module is the component's OWN module,
// so the DOM is byte-identical to the pre-override page.
import React from 'react';
import CheckoutReviewLayout from '@/components/checkout/CheckoutReviewLayout';
import page from './CheckoutReviewPage.module.css';
import orderType from '@/components/checkout/OrderTypeSection.module.css';
import customerInfo from '@/components/checkout/CustomerInfoSection.module.css';
import orderItems from '@/components/checkout/OrderItemsList.module.css';
import summary from '@/components/checkout/OrderSummaryCard.module.css';

export default function CheckoutReviewPage() {
  return <CheckoutReviewLayout styles={{ page, orderType, customerInfo, orderItems, summary }} />;
}
