'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Clock, Home, Loader2, Receipt } from 'lucide-react';
import ConfirmationSuccessHeader from '@/app/checkout/confirmation/ConfirmationSuccessHeader';
import type { CheckoutReturn } from '@/hooks/checkout/useCheckoutReturn';
import styles from '@/app/styles/ConfirmationPage.module.css';

/**
 * What the diner sees on the way back from Stripe (SOFRA-PAYMENTS-PLAN §5 S9).
 *
 * It owns the whole page whenever the URL carries a `sessionId`, and that is deliberate: on this
 * visit the question is *"did my payment go through"*, not *"what did I order"*. The order detail
 * is auth-gated and a guest cannot read it at all, so a page that led with order detail would show
 * a returning guest an error where the answer about their money should be.
 *
 * **Only the `paid` branch reuses `ConfirmationSuccessHeader`.** Every other branch gets its own
 * chrome, because that component says "Order Received" over a green tick — the one thing that must
 * never appear above a payment we cannot vouch for.
 */
export default function CheckoutReturnPanel({
  outcome,
  settlement,
  orderId,
}: Readonly<CheckoutReturn & { orderId: string | null }>) {
  const { t } = useTranslation();
  const router = useRouter();

  const backToMenu = (
    <button type="button" onClick={() => router.push('/menu')} className={styles.menuButton}>
      <Home size={20} />
      {t('back_to_menu', 'Back to Menu')}
    </button>
  );

  if (outcome === 'settling') {
    return (
      <main className={styles.container}>
        <div className={styles.loadingState}>
          <Loader2 size={64} className={styles.spinner} />
          <p>{t('payment_confirming', 'Confirming your payment…')}</p>
        </div>
      </main>
    );
  }

  if (outcome === 'paid' && settlement) {
    return (
      <main className={styles.container}>
        <div className={styles.content}>
          <ConfirmationSuccessHeader orderNumber={settlement.orderNumber}>
            {/* Same route without `sessionId`, which is what makes it the ordinary confirmation
                view rather than this panel. Carrying orderNumber means a guest — who cannot read
                the auth-gated order endpoint — still lands on the existing graceful fallback
                instead of an error. */}
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/checkout/confirmation?orderId=${encodeURIComponent(orderId ?? '')}&orderNumber=${encodeURIComponent(settlement.orderNumber)}`,
                )
              }
              className={styles.menuButton}
            >
              <Receipt size={20} />
              {t('view_order_details', 'View Details')}
            </button>
            {backToMenu}
          </ConfirmationSuccessHeader>
        </div>
      </main>
    );
  }

  if (outcome === 'cancelled') {
    return (
      <main className={styles.container}>
        <div className={styles.errorState}>
          <AlertCircle size={64} className={styles.errorIcon} />
          <h1>{t('payment_not_completed', 'Payment not completed')}</h1>
          <p>
            {t(
              'payment_not_completed_message',
              'Your payment did not go through, so this order was cancelled. Nothing has been charged. Your basket is still here if you would like to try again.',
            )}
          </p>
          {backToMenu}
        </div>
      </main>
    );
  }

  // `pending` and `unknown` share this shape on purpose. They differ in what WE know — a delayed
  // payment method still clearing, versus a backend we could not reach — and in neither case do we
  // know enough to tell the diner their money is safe or that it is gone. The one thing that must
  // not happen is a green tick over either.
  return (
    <main className={styles.container}>
      <div className={styles.errorState}>
        <Clock size={64} className={styles.errorIcon} />
        <h1>{t('payment_still_confirming', 'We are still confirming your payment')}</h1>
        <p>
          {outcome === 'pending'
            ? t(
                'payment_pending_message',
                'Your payment is being processed. The restaurant will confirm your order as soon as it clears — you do not need to pay again.',
              )
            : t(
                'payment_unknown_message',
                'We could not confirm your payment just now. If it went through, the restaurant will still receive your order — please do not pay again. Contact the restaurant if you are unsure.',
              )}
        </p>
        {settlement && (
          <p className={styles.orderNumberValue}>
            {t('order_number', 'Order Number')}: {settlement.orderNumber}
          </p>
        )}
        {backToMenu}
      </div>
    </main>
  );
}
