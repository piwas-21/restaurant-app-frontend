import { useId } from 'react';
import { useTranslation } from 'react-i18next';

interface GuestSelectorProps {
  numberOfGuests: number;
  onGuestsChange: (guests: number) => void;
  /** Per-template CSS module (ADR-006 reservations surface — the CartPage
   *  pattern): classic passes ./GuestSelector.module.css, craft its re-skin. */
  styles: Readonly<Record<string, string>>;
}

export default function GuestSelector({ numberOfGuests, onGuestsChange, styles }: Readonly<GuestSelectorProps>) {
  const { t } = useTranslation();
  const customId = useId();

  const presetNumbers = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className={styles.formSection}>
      <label className={styles.label}>{t('guests', 'Guests')}</label>
      <div className={styles.guestSelector}>
        {presetNumbers.map((num) => (
          <button
            key={num}
            type="button"
            className={`${styles.guestButton} ${numberOfGuests === num ? styles.selected : ''}`}
            onClick={() => onGuestsChange(num)}
          >
            {num}
          </button>
        ))}
      </div>
      <div className={styles.customInputWrapper}>
        <label htmlFor={customId} className={styles.customLabel}>
          {t('or_custom', 'Or custom')}:
        </label>
        <input
          id={customId}
          type="number"
          min="1"
          max="50"
          value={numberOfGuests}
          onChange={(e) => onGuestsChange(parseInt(e.target.value) || 1)}
          className={styles.customInput}
          placeholder={t('enter_guests', 'Enter number')}
        />
      </div>
    </div>
  );
}
