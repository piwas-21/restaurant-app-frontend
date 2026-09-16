'use client';

import { useTranslation } from 'react-i18next';
import styles from './StaffWorkspaceControls.module.css';

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  itemName?: string;
  onRemove?: () => void;
  disabled?: boolean;
  allowInput?: boolean;
  className?: string;
}

export default function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  label,
  itemName,
  onRemove,
  disabled = false,
  allowInput = true,
  className,
}: Readonly<QuantityStepperProps>) {
  const { t } = useTranslation();
  const accessibleItem = itemName ? ` ${itemName}` : '';
  const quantityLabel = label ?? t('quantity', 'Quantity');
  const decrementLabel = t('decrease_quantity_of_item', { itemName: itemName ?? quantityLabel });
  const incrementLabel = t('increase_quantity_of_item', { itemName: itemName ?? quantityLabel });
  const clamped = Math.min(max, Math.max(min, value));
  const canRemoveAtMinimum = Boolean(onRemove) && min > 0;

  const update = (next: number) => {
    if (!Number.isFinite(next)) return;
    onChange(Math.min(max, Math.max(min, Math.trunc(next))));
  };

  const decrement = () => {
    if (clamped <= min) {
      onRemove?.();
      return;
    }
    update(clamped - 1);
  };

  return (
    <fieldset className={[styles.stepper, className].filter(Boolean).join(' ')}>
      <legend className="sr-only">{`${quantityLabel}${accessibleItem}`}</legend>
      <button
        type="button"
        className={styles.stepButton}
        onClick={decrement}
        disabled={disabled || (clamped <= min && !canRemoveAtMinimum)}
        aria-label={canRemoveAtMinimum && clamped <= min ? t('remove_item', 'Remove item') : decrementLabel}
      >
        −
      </button>
      {allowInput ? (
        <input
          className={styles.quantityInput}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={clamped}
          disabled={disabled}
          aria-label={`${quantityLabel}${accessibleItem}`}
          onChange={(event) => update(Number(event.target.value))}
        />
      ) : (
        <output className={styles.quantityInput} aria-label={`${quantityLabel}${accessibleItem}`}>
          {clamped}
        </output>
      )}
      <button
        type="button"
        className={styles.stepButton}
        onClick={() => update(clamped + 1)}
        disabled={disabled || clamped >= max}
        aria-label={incrementLabel}
      >
        +
      </button>
    </fieldset>
  );
}
