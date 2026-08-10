'use client';

// Page logic for /checkout/review, extracted from the former 405-LOC inline page
// (thin-orchestrator rule §5.1; also unit-testable + shareable by any template).
// Verbatim lift: payment/points/tip state, display tax (useCheckoutTax), the
// place-order submit (buildOrderCommand), and the confirmation modal +
// auth-aware close routing. The prereq guard now lives in
// useCheckoutPrereqGuard, which owns its store-hydration gate; the success
// modal in useOrderConfirmationModal; the online-payment branch in
// useOnlineCheckout (S8).
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useCart } from '@/components/cart/CartContext';
import { useSession } from '@/hooks/useSession';
import { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import { createOrderFromBasket } from '@/services/orderService';
import { sendOrderConfirmationEmails } from '@/services/emailService';
import { getTranslatedOrderError } from '@/utils/orderErrorHandler';
import { formatPlainCurrency, formatCurrency } from '@/utils/currency';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';
import { PaymentMethod, OrderType as OrderTypeEnum } from '@/types/order';
import { buildOrderCommand } from '@/lib/checkout/buildOrderCommand';
import { useCheckoutTax } from './useCheckoutTax';
import { useCheckoutPrereqGuard } from './useCheckoutPrereqGuard';
import { useOrderConfirmationModal } from './useOrderConfirmationModal';
import { useOnlinePaymentAvailability } from './useOnlinePaymentAvailability';
import { useOnlineCheckout } from './useOnlineCheckout';

export function useCheckoutReview() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { state: checkoutState, clearCheckout, setTipAmount } = useCheckout();
  const { clearOrderType } = useOrderType();
  const { state: cartState, clearCart } = useCart();
  // Order-type follow-up modals, hosted so the "Edit" buttons re-open the
  // order-type/contact editor IN PLACE instead of bouncing to /menu.
  const orderTypeFollowUp = useOrderTypeFollowUp();
  useSession();

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
  const [redeemedPoints, setRedeemedPoints] = useState(0);
  const [pointsDiscount, setPointsDiscount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const confirmation = useOrderConfirmationModal();
  const onlinePaymentAvailable = useOnlinePaymentAvailability();
  const { payOnline } = useOnlineCheckout();

  const { taxConfig, taxAmount } = useCheckoutTax(checkoutState.orderType, cartState.basket);
  // Skipped while a just-confirmed order is showing — placing the order clears
  // both stores, and the success modal must not be redirected out from under it.
  const { isMissingPrereqs } = useCheckoutPrereqGuard(confirmation.confirmedOrder !== null);

  // Page-view event — fire ONCE on first client mount (ref guard survives
  // StrictMode double-invoke + cart/tax re-renders).
  const reviewViewedFiredRef = useRef(false);
  useEffect(() => {
    if (reviewViewedFiredRef.current) return;
    reviewViewedFiredRef.current = true;
    trackEvent('checkout_review_viewed', { loggedIn: isLoggedInForAnalytics() });
  }, []);

  const handlePointsRedemption = (points: number, discountAmount: number) => {
    setRedeemedPoints(points);
    setPointsDiscount(discountAmount);
  };

  const handlePlaceOrder = async () => {
    setIsSubmitting(true);
    setSubmitError('');
    // Set only on the online branch's success path, where the browser is leaving for Stripe and
    // Place Order must STAY disabled. A `return` inside `try` still runs `finally`, so the flag
    // is what makes that true rather than the comment beside the return.
    let leavingForStripe = false;

    try {
      const orderCommand = buildOrderCommand({
        orderType: checkoutState.orderType as OrderTypeEnum,
        customerName: checkoutState.customerInfo?.name,
        customerEmail: checkoutState.customerInfo?.email,
        customerPhone: checkoutState.customerInfo?.phone,
        tableNumber: checkoutState.tableNumber,
        deliveryAddress: checkoutState.deliveryAddress,
        specialInstructions: checkoutState.specialInstructions,
        tipAmount: checkoutState.tipAmount || 0,
        basket: cartState.basket,
        paymentMethod: selectedPaymentMethod,
        pointsDiscount,
        redeemedPoints,
      });

      // The online branch leaves this page for Stripe and finishes on the return trip (S9), so
      // NONE of the completion below applies to it: no success modal for an order nobody has
      // paid for, no confirmation email, and — the one the plan calls out — the cart is
      // deliberately NOT cleared. A diner who abandons Stripe comes back to a page that still
      // works; clearing here would return them to an expired order and an empty basket.
      if (selectedPaymentMethod === PaymentMethod.OnlinePayment) {
        await payOnline(orderCommand);
        // Leave Place Order DISABLED: the browser is already navigating to Stripe, and
        // re-enabling it for the fraction of a second that takes invites a second press —
        // `checkout-session` is rate-limited at 10 per 15 minutes per IP, and a whole dine-in
        // room shares one.
        leavingForStripe = true;
        return;
      }

      const createdOrder = await createOrderFromBasket(orderCommand);

      trackEvent('checkout_completed', {
        orderType: checkoutState.orderType ?? undefined,
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        loggedIn: isLoggedInForAnalytics(),
        source: 'review',
      });

      confirmation.setConfirmedOrder({
        id: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        customerEmail: checkoutState.customerInfo?.email || '',
      });

      // Reset BOTH contexts: OrderTypeContext persists its own copy, so without
      // clearOrderType() the next order has a chosen type yet empty contact.
      await clearCart();
      clearCheckout();
      clearOrderType();

      try {
        await sendOrderConfirmationEmails(createdOrder.id);
      } catch (emailError) {
        console.warn('Failed to send confirmation emails:', emailError);
      }

      enqueueSnackbar(t('order_placed_success', 'Order placed successfully!'), {
        variant: 'success',
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
      });
    } catch (error) {
      console.error('Error placing order:', error);
      const errorMessage = getTranslatedOrderError(error, t);
      setSubmitError(errorMessage);
      enqueueSnackbar(errorMessage, {
        variant: 'error',
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
      });
    } finally {
      if (!leavingForStripe) setIsSubmitting(false);
    }
  };

  const customerHasDiscount = (cartState.basket?.customerDiscount || 0) > 0 || (cartState.basket?.discount || 0) > 0;
  const formatPrice = (price: number) => formatCurrency(price);
  const formatTotal = (total: number) => formatPlainCurrency(total, customerHasDiscount ? 0 : 2);

  return {
    t,
    checkoutState,
    cartState,
    orderTypeFollowUp,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    onlinePaymentAvailable,
    redeemedPoints,
    handlePointsRedemption,
    taxConfig,
    taxAmount,
    pointsDiscount,
    setTipAmount,
    isSubmitting,
    submitError,
    showConfirmationModal: confirmation.showConfirmationModal,
    confirmedOrder: confirmation.confirmedOrder,
    isLoggedIn: confirmation.isLoggedIn,
    handleCloseConfirmationModal: confirmation.handleCloseConfirmationModal,
    handlePlaceOrder,
    formatPrice,
    formatTotal,
    // Loading placeholder only when prereqs are missing AND no just-confirmed
    // order (the confirmation modal renders instead).
    isLoading: isMissingPrereqs && !confirmation.confirmedOrder,
  };
}
