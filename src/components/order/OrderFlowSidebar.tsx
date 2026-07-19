'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import CartContents from './CartContents';
import styles from './OrderFlowSidebar.module.css';

export interface OrderFlowSidebarProps {
  /** Wired so the toggle's clicks can trigger the table/address modals. */
  followUp: ReturnType<typeof useOrderTypeFollowUp>;
}

/**
 * Desktop right-rail (BUGS-IMPROVEMENTS-PLAN §C1.5.c). Replaces the
 * earlier welcome-modal-on-page-load pattern: the user browses freely,
 * adds items, then picks/changes order type via the toggle in this
 * sidebar whenever they're ready.
 *
 * Hidden on small screens (mobile uses `MobileCartSheet` driven by the
 * existing `FloatingCartButton`; see §C1.5.f).
 *
 * Owns the chrome (`<aside>`, sticky positioning, title) and delegates
 * the cart-half rendering to `CartContents`, which is shared with the
 * mobile sheet so quantity controls / toggle / total / proceed button
 * stay in lockstep across both surfaces.
 */
export default function OrderFlowSidebar({ followUp }: OrderFlowSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className={styles.sidebar} aria-label={t('shopping_basket', 'Shopping Basket')}>
      <h2 className={styles.title}>{t('shopping_basket', 'Shopping Basket')}</h2>
      <CartContents pickType={followUp.pickType} />
    </aside>
  );
}
