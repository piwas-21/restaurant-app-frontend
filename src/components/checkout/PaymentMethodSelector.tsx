/**
 * Payment Method Selector Component
 *
 * Displays available payment methods and allows user to select one
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Info, CheckCircle } from 'lucide-react';
import { OrderType, PaymentMethod } from '@/types/order';
import { normalizePaymentMethodForOrderType, offerablePaymentMethods } from '@/config/paymentMethods';
import defaultStyles from './PaymentMethodSelector.module.css';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  /** The active checkout channel. Card at restaurant is not a Delivery option. */
  orderType: OrderType | null;
  /** Whether this restaurant can take an online payment (S8). Defaults to false so a caller
   *  that has not been taught to ask cannot accidentally offer it. */
  onlinePaymentAvailable?: boolean;
  /** Active-template CSS module (T4 re-skin). Defaults to the classic module, so
   *  callers that omit it — and classic — render byte-identically. */
  styles?: Readonly<Record<string, string>>;
}

export default function PaymentMethodSelector({
  selectedMethod,
  onMethodChange,
  orderType,
  onlinePaymentAvailable = false,
  styles = defaultStyles,
}: Readonly<PaymentMethodSelectorProps>) {
  const { t } = useTranslation();
  const methods = offerablePaymentMethods(onlinePaymentAvailable, orderType);
  // Keep the visual radio state valid even during the render in which an order-type edit changes
  // Delivery away from a previously selected Card at restaurant.
  const effectiveSelectedMethod = normalizePaymentMethodForOrderType(selectedMethod, orderType);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <CreditCard size={20} />
          {t('payment_method', 'Payment Method')}
        </h2>
      </div>

      {/* The banner states what this restaurant can actually take. The copy distinguishes on-site
          cash/card intents from the optional online payment route rendered below it. */}
      <div className={styles.infoMessage}>
        <Info size={18} />
        <p>
          {onlinePaymentAvailable
            ? t(
                'payment_methods_info_online',
                'Pay in cash or by card at the restaurant, or pay by card now — we will take you to our secure payment page.',
              )
            : t(
                'payment_methods_info',
                'Pay in cash or by card at the restaurant. Online payment and other methods are coming soon!',
              )}
        </p>
      </div>

      <div className={styles.paymentMethods}>
        {methods.map((method) => {
          const Icon = method.icon;
          const isDisabled = method.disabled;

          return (
            <label
              key={method.value}
              className={`${styles.paymentMethod} ${
                effectiveSelectedMethod === method.value ? styles.selected : ''
              } ${isDisabled ? styles.disabled : ''}`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={method.value}
                checked={effectiveSelectedMethod === method.value}
                onChange={() => !isDisabled && onMethodChange(method.value)}
                className={styles.paymentRadio}
                disabled={isDisabled}
              />
              <div className={styles.paymentIcon}>
                <Icon size={24} />
              </div>
              <div className={styles.paymentInfo}>
                <span className={styles.paymentLabel}>
                  {t(method.labelKey, method.label)}
                  {isDisabled && <span className={styles.comingSoon}> ({t('coming_soon', 'Coming Soon')})</span>}
                </span>
                <span className={styles.paymentDescription}>{t(method.descriptionKey, method.description)}</span>
              </div>
              {effectiveSelectedMethod === method.value && !isDisabled && (
                <CheckCircle size={20} className={styles.checkmark} />
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}
