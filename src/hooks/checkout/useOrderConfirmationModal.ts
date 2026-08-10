'use client';

// The just-placed-order success modal and where its close button goes. Lifted out of
// useCheckoutReview unchanged, to make room for the online-payment branch (S8) — that hook
// was at 190 of its 200 permitted lines.
//
// It is a genuinely separate concern from placing an order: nothing here touches the cart, the
// basket or the money. It owns one fact (an order was just confirmed on this page) and the two
// pieces of UI that fact drives.
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface ConfirmedOrder {
  id: string;
  orderNumber: string;
  customerEmail: string;
}

export function useOrderConfirmationModal() {
  const router = useRouter();
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsLoggedIn(!!localStorage.getItem('auth_token'));
    }
  }, []);

  useEffect(() => {
    if (confirmedOrder) setShowConfirmationModal(true);
  }, [confirmedOrder]);

  // Close (X / ESC / backdrop / "Back to Menu"). The confirmation page is auth-gated, so guests
  // would hit "Failed to load order details" → send them to /menu (they already saw the number
  // + email).
  const handleCloseConfirmationModal = () => {
    setShowConfirmationModal(false);
    if (!confirmedOrder) return;
    if (isLoggedIn) {
      router.push(`/checkout/confirmation?orderId=${confirmedOrder.id}&orderNumber=${confirmedOrder.orderNumber}`);
    } else {
      router.push('/menu');
    }
  };

  return {
    confirmedOrder,
    setConfirmedOrder,
    showConfirmationModal,
    isLoggedIn,
    handleCloseConfirmationModal,
  };
}
