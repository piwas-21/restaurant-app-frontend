'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart } from 'lucide-react';
import { formatPlainCurrency } from '@/utils/currency';
import styles from './MenuBasketButton.module.css';

interface MenuBasketButtonProps {
  itemCount: number;
  totalPrice: number;
  onClick: () => void;
}

/**
 * The menu's basket entry point, pinned to the inline end of the sticky category bar.
 *
 * This is what replaces the 360px right rail. The rail was always visible and therefore always
 * costing a third of the page; this costs 120px of a bar that was already on screen, and it is the
 * only always-reachable control the removal needed — the order-type toggle a guest used to pick
 * from the rail lives inside the sheet it opens (`CartContents`), so nothing was lost, it moved one
 * click away.
 *
 * It renders at EVERY count, including zero. The floating cart button on this page deliberately
 * does not (`itemCount === 0` returns null), and a guest with an empty basket is exactly the guest
 * who still needs to choose Dine-in / Takeaway / Delivery before they start ordering.
 */
export default function MenuBasketButton({ itemCount, totalPrice, onClick }: Readonly<MenuBasketButtonProps>) {
  const { t } = useTranslation();
  const hasItems = itemCount > 0;

  return (
    <button
      type="button"
      className={hasItems ? `${styles.basketButton} ${styles.filled}` : styles.basketButton}
      onClick={onClick}
      aria-label={t('open_basket_aria', {
        count: itemCount,
        total: formatPlainCurrency(totalPrice),
        defaultValue: `Open basket, ${itemCount} items, ${formatPlainCurrency(totalPrice)}`,
      })}
    >
      <span className={styles.iconWrap}>
        <ShoppingCart className={styles.icon} aria-hidden="true" />
        {hasItems && (
          // aria-hidden: the count is already in the button's accessible name above, where it reads
          // as a sentence rather than as a bare number floating off the corner of an icon.
          <span className={styles.badge} aria-hidden="true">
            {itemCount}
          </span>
        )}
      </span>
      {/* The total is the half a guest actually watches while ordering. Below 900px it leaves the
          box and the disc alone carries the button — the bar there is a scrolling row of category
          tabs with no room for a price. */}
      <span className={styles.total}>{formatPlainCurrency(totalPrice)}</span>
    </button>
  );
}
