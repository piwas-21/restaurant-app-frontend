'use client';

import { formatPlainCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { Tag, Loader2 } from 'lucide-react';
import { BasketDto } from '@/types/basket';
import styles from '@/app/styles/CartPage.module.css';

interface CartSummaryProps {
  basket: BasketDto | null;
  isSyncing: boolean;
  promoCode: string;
  setPromoCode: (value: string) => void;
  isApplyingPromo: boolean;
  customerHasDiscount: boolean;
  getTotal: () => number;
  getItemCount: () => number;
  isResolving: boolean;
  onApplyPromoCode: () => Promise<void>;
  onRemovePromoCode: () => void;
  onCheckout: () => void;
}

/**
 * The cart summary panel: promo-code entry/applied state, price breakdown, and checkout button.
 * Extracted verbatim from app/cart/page.tsx (Sprint 4/6 god-file decomposition).
 */
export default function CartSummary({
  basket,
  isSyncing,
  promoCode,
  setPromoCode,
  isApplyingPromo,
  customerHasDiscount,
  getTotal,
  getItemCount,
  isResolving,
  onApplyPromoCode,
  onRemovePromoCode,
  onCheckout,
}: CartSummaryProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.cartSummary}>
      {/* Promo Code Section */}
      <div className={styles.promoCodeSection}>
        <h3 className={styles.promoCodeTitle}>
          <Tag size={20} />
          {t('promo_code', 'Promo Code')}
        </h3>

        {basket?.promoCode ? (
          <div className={styles.appliedPromoCode}>
            <div className={styles.promoCodeInfo}>
              <span className={styles.promoCodeText}>{basket.promoCode}</span>
              <span className={styles.promoCodeDiscount}>
                -{t('discount', 'Discount')}: {formatPlainCurrency(basket.discount)}
              </span>
            </div>
            <button onClick={onRemovePromoCode} className={styles.removePromoButton} disabled={isSyncing}>
              {t('remove', 'Remove')}
            </button>
          </div>
        ) : (
          <div className={styles.promoCodeInput}>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder={t('enter_promo_code', 'Enter promo code')}
              className={styles.promoCodeField}
              disabled={isSyncing}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  // onApplyPromoCode only has try/finally — applyPromoCode re-throws.
                  onApplyPromoCode().catch((err) => console.error('cart: failed to apply promo', err));
                }
              }}
            />
            <button
              onClick={onApplyPromoCode}
              className={styles.applyPromoButton}
              disabled={isSyncing || !promoCode.trim()}
            >
              {isApplyingPromo ? <Loader2 className={styles.buttonSpinner} size={16} /> : t('apply', 'Apply')}
            </button>
          </div>
        )}
      </div>

      {/* Price Breakdown */}
      <div className={styles.priceBreakdown}>
        <div className={styles.priceRow}>
          <span>{t('subtotal', 'Subtotal')}:</span>
          <span>{formatPlainCurrency(basket?.subTotal ?? 0)}</span>
        </div>

        {basket && basket.discount > 0 && (
          <div className={styles.priceRow}>
            <span>{t('discount', 'Discount')}:</span>
            <span className={styles.discountAmount}>-{formatPlainCurrency(basket.discount)}</span>
          </div>
        )}

        {basket && basket.customerDiscount > 0 && (
          <div className={styles.priceRow}>
            <span>{basket.customerDiscountName || t('customer_discount', 'Customer Discount')}:</span>
            <span className={styles.discountAmount}>-{formatPlainCurrency(basket.customerDiscount)}</span>
          </div>
        )}

        <div className={styles.totalRow}>
          <span>{t('total', 'Total')}:</span>
          <span className={styles.totalAmount}>{formatPlainCurrency(getTotal(), customerHasDiscount ? 0 : 2)}</span>
        </div>
      </div>

      {/* Checkout Button */}
      <button onClick={onCheckout} className={styles.checkoutButton} disabled={isResolving}>
        {t('proceed_to_checkout', 'Proceed to Checkout')} ({getItemCount()} {t('items', 'items')})
      </button>
    </div>
  );
}
