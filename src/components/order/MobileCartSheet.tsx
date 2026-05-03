'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import type { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import CartContents from './CartContents';
import styles from './MobileCartSheet.module.css';

interface MobileCartSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Wired so the toggle's clicks can trigger the table/address modals. */
  followUp: ReturnType<typeof useOrderTypeFollowUp>;
}

/**
 * Mobile bottom-sheet (BUGS-IMPROVEMENTS-PLAN §C1.5.f). The
 * `FloatingCartButton` on /menu now opens this sheet instead of routing
 * to /cart, mirroring the desktop sidebar's UX without forcing an extra
 * navigation hop.
 *
 * Reuses `CartContents` with the desktop sidebar so quantity controls,
 * the order-type toggle, totals, and Proceed-to-Checkout stay
 * pixel-identical across the two surfaces. The sheet-shape (full-width,
 * pinned to bottom, capped at 80vh, slide-up animation) lives in
 * `MobileCartSheet.module.css` and overrides the centered-dialog
 * defaults `BaseModal` ships with.
 *
 * `onProceed` closes the sheet *before* the smart-skip router pushes
 * to /checkout/review, so the user doesn't see the sheet still open as
 * the route transitions.
 */
export default function MobileCartSheet({ isOpen, onClose, followUp }: MobileCartSheetProps) {
  const { t } = useTranslation();

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('shopping_basket', 'Shopping Basket')}
      className={styles.sheet}
    >
      <CartContents pickType={followUp.pickType} onProceed={onClose} />
    </BaseModal>
  );
}
