'use client';

import { useTranslation } from 'react-i18next';
import { Trash2, Plus, Minus } from 'lucide-react';

interface CartLineControlsProps {
  quantity: number;
  /** Cart sync in flight — disables all three buttons. */
  disabled: boolean;
  onRemove: () => void;
  onDecrement: () => void;
  onIncrement: () => void;
  /**
   * Host template's CSS module — must define `itemControls`, `iconButton`,
   * `qtyGroup`, `qtyButton`, `qty`. The classic and craft cart modules both do,
   * so the two share this markup (Sonar new-code dedup) and differ only in CSS
   * (and in how each row positions the cluster).
   */
  styles: Readonly<Record<string, string>>;
}

/**
 * Remove + quantity stepper shared by the classic and craft cart line rows. The
 * markup, handlers, icons, and a11y labels are identical across templates; only
 * the passed-in CSS module differs.
 */
export default function CartLineControls({
  quantity,
  disabled,
  onRemove,
  onDecrement,
  onIncrement,
  styles,
}: Readonly<CartLineControlsProps>) {
  const { t } = useTranslation();
  return (
    <div className={styles.itemControls}>
      <button
        type="button"
        onClick={onRemove}
        className={styles.iconButton}
        aria-label={t('remove_item', 'Remove item')}
        disabled={disabled}
      >
        <Trash2 size={16} />
      </button>
      <div className={styles.qtyGroup}>
        <button
          type="button"
          onClick={onDecrement}
          className={styles.qtyButton}
          aria-label={t('decrease_quantity', 'Decrease quantity')}
          disabled={disabled || quantity <= 1}
        >
          <Minus size={14} />
        </button>
        <span className={styles.qty}>{quantity}</span>
        <button
          type="button"
          onClick={onIncrement}
          className={styles.qtyButton}
          aria-label={t('increase_quantity', 'Increase quantity')}
          disabled={disabled}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
