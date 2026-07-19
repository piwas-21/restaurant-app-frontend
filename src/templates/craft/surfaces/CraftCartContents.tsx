'use client';

import { formatPlainCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { useCartContents, type UseCartContentsArgs } from '@/hooks/order/useCartContents';
import CartLineList from '@/components/order/CartLineList';
import CartCheckoutButton from '@/components/order/CartCheckoutButton';
import CraftOrderTypeToggle from './CraftOrderTypeToggle';
import styles from './CraftCartContents.module.css';

/**
 * Craft cart contents (S15 T4 surface slot) — a hand-written "order pad": each
 * line an Amatic dish name with a dotted-leader price (via the shared
 * `CartLineList` + craft CSS), then a kraft totals panel with an Amatic
 * terracotta grand total and a letterpress terracotta CTA. Shares all cart
 * state/behaviour + the line list + CTA with the classic `CartContents` (only the
 * DOM/CSS + heading/empty/total copy differ). Rendered only in the craft build
 * (resolved via `surfaceOr`).
 */
export default function CraftCartContents(props: Readonly<UseCartContentsArgs>) {
  const { t } = useTranslation();
  const { items, subtotal, canCheckout, isSyncing, isResolving, handleQty, handleRemove, handleCheckout, handlePick } =
    useCartContents(props);

  return (
    <>
      <CraftOrderTypeToggle onPick={handlePick} />

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>{t('cart_empty_message', 'Your cart is empty')}</p>
        </div>
      ) : (
        <CartLineList
          items={items}
          disabled={isSyncing}
          onQty={handleQty}
          onRemove={handleRemove}
          styles={styles}
          headerClassName={styles.leader}
        />
      )}

      <div className={styles.totals}>
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>{t('cart_total_label', 'Total')}</span>
          <span className={styles.totalValue}>{formatPlainCurrency(subtotal)}</span>
        </div>
      </div>

      <CartCheckoutButton
        disabled={!canCheckout || isResolving}
        onClick={handleCheckout}
        className={styles.checkoutButton}
      />
    </>
  );
}
