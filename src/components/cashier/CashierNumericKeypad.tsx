import { Delete } from 'lucide-react';
import styles from './CashierNumericKeypad.module.css';

interface CashierNumericKeypadProps {
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly t: (key: string) => string;
  /** Extra layout class from the host form (e.g. dropping the default max width). */
  readonly className?: string;
}

/** Large, touch-safe keypad for the cash amount field. */
export default function CashierNumericKeypad({ value, disabled, onChange, t, className }: CashierNumericKeypadProps) {
  const append = (digit: string) => {
    if (digit === '.' && value.includes('.')) return;
    onChange(digit === '.' && value.length === 0 ? '0.' : `${value}${digit}`);
  };
  const remove = () => onChange(value.slice(0, -1));
  const clear = () => onChange('');

  return (
    <fieldset className={`${styles.numericKeypad} ${className ?? ''}`} aria-label={t('cashier.collection.keypad')}>
      {[...'123456789'].map((digit) => (
        <button
          type="button"
          className={styles.keypadButton}
          key={digit}
          onClick={() => append(digit)}
          disabled={disabled}
          aria-label={digit}
        >
          {digit}
        </button>
      ))}
      <button type="button" className={styles.keypadButton} onClick={() => append('.')} disabled={disabled}>
        .
      </button>
      <button
        type="button"
        className={styles.keypadButton}
        onClick={() => append('0')}
        disabled={disabled}
        aria-label="0"
      >
        0
      </button>
      <button
        type="button"
        className={styles.keypadButton}
        onClick={remove}
        disabled={disabled || value.length === 0}
        aria-label={t('cashier.collection.keypad_backspace')}
      >
        <Delete aria-hidden="true" size={22} />
      </button>
      <button type="button" className={styles.keypadClear} onClick={clear} disabled={disabled || value.length === 0}>
        {t('cashier.collection.keypad_clear')}
      </button>
    </fieldset>
  );
}
