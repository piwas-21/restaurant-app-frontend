'use client';

import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import styles from './SheetFooter.module.css';

interface SheetFooterProps {
  total: number;
  /** The last step commits the order; every earlier one moves the flow on. */
  isLast: boolean;
  isSubmitting: boolean;
  quantity: number;
  setQuantity: (quantity: number) => void;
  onAdd: () => void;
  onContinue: () => void;
  /** The step is optional and the guest has not touched it — the action is honestly "Skip". */
  isSkip: boolean;
  /** Why the guest cannot move on yet, revealed only once they have tried (never on arrival). */
  blockedMessage?: string;
}

/**
 * The sheet's action bar (MENU-CUSTOMIZATION-FLOW-PLAN §3.2). One component for both shapes so the
 * live total is rendered by the same expression on every step and cannot drift between them.
 *
 * **Continue is never disabled.** A disabled control explains nothing (#208, the same argument that
 * replaced the disabled Add on a blocked item): pressing it on an unsatisfied required step reveals
 * the reason instead, which is also how the bundle body has always handled its own `Add`.
 */
export default function SheetFooter({
  total,
  isLast,
  isSubmitting,
  quantity,
  setQuantity,
  onAdd,
  onContinue,
  isSkip,
  blockedMessage,
}: Readonly<SheetFooterProps>) {
  const { t } = useTranslation();

  const amount = formatPlainCurrency(total);

  /**
   * The running total, ANNOUNCED (S6): ticking a paid sauce changes this number, and that is the
   * one part of the customization a screen-reader guest cannot see coming.
   *
   * Its own region OUTSIDE the controls, not an `aria-live` span inside the Add button: a live
   * region nested in an interactive control is unreliable across screen readers, and it would make
   * the button's accessible name change on every tick.
   */
  const announcement = (
    <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
      {t('total')} {amount}
    </p>
  );

  if (!isLast) {
    return (
      <div className={styles.footer}>
        {blockedMessage && (
          <p className={styles.blocked} role="alert">
            {blockedMessage}
          </p>
        )}
        <div className={styles.row}>
          <p className={styles.total}>
            <span className={styles.totalLabel}>{t('total')}</span>
            {amount}
          </p>
          <button type="button" className={styles.primary} onClick={onContinue}>
            {isSkip ? t('step_skip') : t('step_continue')}
          </button>
        </div>
        {announcement}
      </div>
    );
  }

  return (
    <div className={styles.footer}>
      <div className={styles.row}>
        <div className={styles.quantityStepper} aria-label={t('quantity')}>
          <button
            type="button"
            className={styles.stepperButton}
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
            aria-label={t('decrease_quantity', 'Decrease quantity')}
          >
            <Minus size={16} />
          </button>
          <span className={styles.quantityValue}>{quantity}</span>
          <button
            type="button"
            className={styles.stepperButton}
            onClick={() => setQuantity(quantity + 1)}
            aria-label={t('increase_quantity', 'Increase quantity')}
          >
            <Plus size={16} />
          </button>
        </div>
        <button type="button" className={styles.primary} onClick={onAdd} disabled={isSubmitting}>
          {t('add_to_order')} • {amount}
        </button>
      </div>
      {announcement}
    </div>
  );
}
