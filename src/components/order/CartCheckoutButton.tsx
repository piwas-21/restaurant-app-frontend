'use client';

import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';

interface CartCheckoutButtonProps {
  /** Disabled for an empty cart or while order-type and checkout work is resolving. */
  disabled: boolean;
  onClick: () => void;
  /** Host template's checkout-button class (classic pill vs craft letterpress terracotta). */
  className: string;
}

/**
 * Proceed-to-Checkout CTA shared by the classic and craft cart renderings — same
 * label, icon, and a11y; only the passed-in class differs.
 */
export default function CartCheckoutButton({ disabled, onClick, className }: Readonly<CartCheckoutButtonProps>) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={t('proceed_to_checkout', 'Proceed to Checkout')}
    >
      {t('proceed_to_checkout', 'Proceed to Checkout')}
      <ChevronRight size={18} />
    </button>
  );
}
