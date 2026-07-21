'use client';

// Page logic for /checkout/review, extracted from the former 405-LOC inline page
// (thin-orchestrator rule §5.1; also unit-testable + shareable by any template).
// Verbatim lift: payment/points/tip state, display tax (useCheckoutTax), the
// place-order submit (buildOrderCommand), the confirmation modal + auth-aware
// close routing, and the prereq guard.
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

export function useCheckoutReview() {
  const { t } = useTranslation();
  const router = useRouter();
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
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    id: string;
    orderNumber: string;
    customerEmail: string;
  } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const { taxConfig, taxAmount } = useCheckoutTax(checkoutState.orderType, cartState.basket);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsLoggedIn(!!localStorage.getItem('auth_token'));
    }
  }, []);

  // Page-view event — fire ONCE on first client mount (ref guard survives
  // StrictMode double-invoke + cart/tax re-renders).
  const reviewViewedFiredRef = useRef(false);
  useEffect(() => {
    if (reviewViewedFiredRef.current) return;
    reviewViewedFiredRef.current = true;
    trackEvent('checkout_review_viewed', { loggedIn: isLoggedInForAnalytics() });
  }, []);

  useEffect(() => {
    if (confirmedOrder) setShowConfirmationModal(true);
  }, [confirmedOrder]);

  // Prereq guard — but never redirect while a just-confirmed order is showing.
  useEffect(() => {
    if (confirmedOrder) return;
    if (cartState.items.length === 0) {
      router.push('/cart');
    } else if (!checkoutState.orderType || !checkoutState.customerInfo) {
      router.push('/menu');
    }
  }, [cartState.items.length, checkoutState.orderType, checkoutState.customerInfo, router, confirmedOrder]);

  const handlePointsRedemption = (points: number, discountAmount: number) => {
    setRedeemedPoints(points);
    setPointsDiscount(discountAmount);
  };

  // Close (X / ESC / backdrop / "Back to Menu"). The confirmation page is
  // auth-gated, so guests would hit "Failed to load order details" → send them
  // to /menu (they already saw the number + email).
  const handleCloseConfirmationModal = () => {
    setShowConfirmationModal(false);
    if (!confirmedOrder) return;
    if (isLoggedIn) {
      router.push(`/checkout/confirmation?orderId=${confirmedOrder.id}&orderNumber=${confirmedOrder.orderNumber}`);
    } else {
      router.push('/menu');
    }
  };

  const handlePlaceOrder = async () => {
    setIsSubmitting(true);
    setSubmitError('');

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

      const createdOrder = await createOrderFromBasket(orderCommand);

      trackEvent('checkout_completed', {
        orderType: checkoutState.orderType ?? undefined,
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        loggedIn: isLoggedInForAnalytics(),
        source: 'review',
      });

      setConfirmedOrder({
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
      setIsSubmitting(false);
    }
  };

  const customerHasDiscount = (cartState.basket?.customerDiscount || 0) > 0 || (cartState.basket?.discount || 0) > 0;
  const formatPrice = (price: number) => formatCurrency(price);
  const formatTotal = (total: number) => formatPlainCurrency(total, customerHasDiscount ? 0 : 2);

  const isMissingPrereqs = cartState.items.length === 0 || !checkoutState.orderType || !checkoutState.customerInfo;

  return {
    t,
    checkoutState,
    cartState,
    orderTypeFollowUp,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    redeemedPoints,
    handlePointsRedemption,
    taxConfig,
    taxAmount,
    pointsDiscount,
    setTipAmount,
    isSubmitting,
    submitError,
    showConfirmationModal,
    confirmedOrder,
    isLoggedIn,
    handleCloseConfirmationModal,
    handlePlaceOrder,
    formatPrice,
    formatTotal,
    // Loading placeholder only when prereqs are missing AND no just-confirmed
    // order (the confirmation modal renders instead).
    isLoading: isMissingPrereqs && !confirmedOrder,
  };
}
