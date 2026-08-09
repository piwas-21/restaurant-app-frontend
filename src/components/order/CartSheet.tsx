'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import type { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import { surfaceOr } from '@/templates/resolve-surface';
import DefaultCartContents from './CartContents';
import styles from './CartSheet.module.css';

// The active template's cart-half override (craft = order-pad list) or the shared
// default (classic) — resolved at build time, so classic never bundles craft (T4).
const CartContents = surfaceOr('CartContents', DefaultCartContents);

interface CartSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Wired so the toggle's clicks can trigger the table/address modals. */
  followUp: ReturnType<typeof useOrderTypeFollowUp>;
}

/**
 * The basket, on demand: a bottom sheet on a phone, a right-edge slide-over on a desktop.
 *
 * It was `MobileCartSheet` and it was mobile-only, because desktop had a permanently-pinned 360px
 * rail beside the menu grid. That rail is gone — measured on prod at 1440px it was 393px tall
 * against a 2082px grid, i.e. ~1700px of empty column, and it was the reason the card grid had been
 * cut from the design's three columns to two. The basket is now one click away at every width
 * instead of a third of the page at one of them.
 *
 * The same `CartContents` still renders inside it, so quantity controls, the ORDER-TYPE TOGGLE,
 * totals and Proceed-to-Checkout are identical to what the rail showed — including the toggle,
 * which is why removing the rail does not remove a guest's ability to choose a channel.
 *
 * `onProceed` closes the sheet *before* the smart-skip router pushes to /checkout/review, so the
 * user does not see it still open as the route transitions.
 */
export default function CartSheet({ isOpen, onClose, followUp }: Readonly<CartSheetProps>) {
  const { t } = useTranslation();

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('shopping_basket', 'Shopping Basket')}
      className={styles.sheet}
    >
      <CartContents pickType={followUp.pickType} onProceed={onClose} analyticsSource="cart_sheet" />
    </BaseModal>
  );
}
