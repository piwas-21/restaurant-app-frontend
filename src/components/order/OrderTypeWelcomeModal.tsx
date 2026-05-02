'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Utensils, ShoppingBag, Truck } from 'lucide-react';
import BaseModal from '@/components/design-system/BaseModal';
import { OrderType } from '@/types/order';
import { useOrderType } from '@/contexts/OrderTypeContext';
import styles from './OrderTypeWelcomeModal.module.css';

interface OrderTypeWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fired after a type is picked, so the host can run any onboarding/redirect logic. */
  onChosen?: (type: OrderType) => void;
}

/**
 * First-touch order-type picker shown on /menu when the customer hasn't
 * already chosen one. Keeps the modal flow short — the actual table
 * selection (dine-in) and address (delivery) prompts come from C1.5.b
 * via dedicated TableSelectionModal / DeliveryAddressModal triggered from
 * the sticky header. For C1.5.a the modal just records the type.
 *
 * Uses BaseModal for the overlay, header, and ESC/backdrop dismissal.
 * disableBackdropClose + disableEscapeClose are NOT set — first-time
 * visitors can dismiss without choosing (the sticky header re-prompts
 * once a type is required for checkout). Keeping this lightweight is a
 * deliberate UX choice: nag-screens that block exploration are worse
 * than asking again at the right moment.
 */
export default function OrderTypeWelcomeModal({ isOpen, onClose, onChosen }: OrderTypeWelcomeModalProps) {
  const { t } = useTranslation();
  const { setOrderType } = useOrderType();

  const choose = (type: OrderType) => {
    setOrderType(type);
    onChosen?.(type);
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={t('order_type_welcome_title', 'How would you like to order?')}>
      <p className={styles.subtitle}>
        {t('order_type_welcome_subtitle', "Pick how you'd like to enjoy your meal — you can change this later.")}
      </p>
      <div className={styles.options}>
        <OrderOptionButton
          icon={<Utensils size={32} />}
          label={t('order_type_dine_in', 'Dine In')}
          description={t('order_type_dine_in_desc', 'Eat in the restaurant')}
          onClick={() => choose(OrderType.DineIn)}
        />
        <OrderOptionButton
          icon={<ShoppingBag size={32} />}
          label={t('order_type_takeaway', 'Takeaway')}
          description={t('order_type_takeaway_desc', 'Pick up your order')}
          onClick={() => choose(OrderType.Takeaway)}
        />
        <OrderOptionButton
          icon={<Truck size={32} />}
          label={t('order_type_delivery', 'Delivery')}
          description={t('order_type_delivery_desc', 'Bring it to me')}
          onClick={() => choose(OrderType.Delivery)}
        />
      </div>
    </BaseModal>
  );
}

interface OrderOptionButtonProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}

function OrderOptionButton({ icon, label, description, onClick }: OrderOptionButtonProps) {
  return (
    <button type="button" className={styles.option} onClick={onClick}>
      <span className={styles.optionIcon}>{icon}</span>
      <span className={styles.optionLabel}>{label}</span>
      <span className={styles.optionDescription}>{description}</span>
    </button>
  );
}
