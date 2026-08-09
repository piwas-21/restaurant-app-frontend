/**
 * Floating Cart Button Component
 *
 * Always-visible cart button that floats at the bottom of the screen.
 * Shows item count, total price, and provides quick access to cart.
 *
 * It renders at EVERY count, including zero. It used to return null on an empty cart, which was
 * harmless while /menu also had a pinned basket rail — and became a dead end when the rail was
 * replaced by a slide-over: the order-type toggle lives inside that sheet, so a guest with nothing
 * in their basket had no control on screen that could open it, and therefore no way to choose
 * Dine-in / Takeaway / Delivery at all. This is /menu's only cart entry point now.
 */

'use client';

import { formatCurrency } from '@/utils/currency';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ShoppingCart } from 'lucide-react';
import styles from './FloatingCartButton.module.css';

interface FloatingCartButtonProps {
  itemCount: number;
  totalPrice: number;
  onAnimate?: boolean;
  /**
   * Override the default "navigate to /cart" click action. Used by /menu
   * to open the mobile bottom-sheet (§C1.5.f) instead of routing to the
   * standalone cart page.
   */
  onClick?: () => void;
}

export default function FloatingCartButton({
  itemCount,
  totalPrice,
  onAnimate = false,
  onClick,
}: FloatingCartButtonProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Show button with slight delay for smooth entrance
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Trigger animation when cart updates
  useEffect(() => {
    if (onAnimate && itemCount > 0) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
  }, [onAnimate, itemCount]);

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    router.push('/cart');
  };

  const formatPrice = (price: number) => formatCurrency(price);

  return (
    <button
      onClick={handleClick}
      className={`${styles.floatingButton} ${isVisible ? styles.visible : ''} ${isAnimating ? styles.pulse : ''}`}
      aria-label={t('floating_cart_button_label', `View cart, ${itemCount} items, ${formatPrice(totalPrice)}`)}
      title={t('view_cart_checkout_button', 'View Cart')}
    >
      <div className={styles.iconContainer}>
        <ShoppingCart size={24} />
        {itemCount > 0 && (
          <span className={styles.badge} aria-label={t('cart_items_count', `${itemCount} items`)}>
            {itemCount}
          </span>
        )}
      </div>

      <div className={styles.priceContainer}>
        <span className={styles.totalLabel}>{t('cart_total_label', 'Total')}</span>
        <span className={styles.totalPrice}>{formatPrice(totalPrice)}</span>
      </div>
    </button>
  );
}
