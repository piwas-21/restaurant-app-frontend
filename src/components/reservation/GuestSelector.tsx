import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { RESERVATION_GUEST_CAP, RESERVATION_GUEST_MIN } from '@/lib/reservationLimits';

/** The party sizes offered as one-tap buttons — trimmed to what `maxGuests` allows. */
const PRESET_PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

interface GuestSelectorProps {
  numberOfGuests: number;
  onGuestsChange: (guests: number) => void;
  /**
   * The largest party this surface may offer. **Derived by the caller** from what the restaurant
   * actually has — the summed table capacities on the booking page, the booking's own table in the
   * edit modal — and never larger than the backend`s `[Range(1, 20)]`
   * (`lib/reservationLimits.ts`). The default is that ceiling, so a caller that forgets still
   * cannot offer a party the server refuses.
   *
   * This picker offered a flat `max="50"` until frontend #557: the guest filled the whole form,
   * pressed Book, and met a `400` from model validation.
   */
  maxGuests?: number;
  /** Per-template CSS module (ADR-006 reservations surface — the CartPage
   *  pattern): classic passes ./GuestSelector.module.css, craft its re-skin. */
  styles: Readonly<Record<string, string>>;
}

export default function GuestSelector({
  numberOfGuests,
  onGuestsChange,
  maxGuests = RESERVATION_GUEST_CAP,
  styles,
}: Readonly<GuestSelectorProps>) {
  const { t } = useTranslation();
  const customId = useId();

  const presetNumbers = PRESET_PARTY_SIZES.filter((num) => num <= maxGuests);

  // `max` on a number input is advisory: it marks the field invalid but does not stop a typed or
  // pasted value, and this form is not submitted through native validation. Clamping is what
  // actually keeps an over-cap party off the wire.
  const clamp = (value: number) => Math.min(Math.max(value, RESERVATION_GUEST_MIN), maxGuests);

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
          min={RESERVATION_GUEST_MIN}
          max={maxGuests}
          value={numberOfGuests}
          onChange={(e) => onGuestsChange(clamp(parseInt(e.target.value, 10) || RESERVATION_GUEST_MIN))}
          className={styles.customInput}
          placeholder={t('enter_guests', 'Enter number')}
        />
      </div>
      {numberOfGuests >= maxGuests && (
        // `<output>` rather than a `role="status"` div — it carries the status role implicitly,
        // which is the house convention here (EditReservationModal, CartContents) and what
        // SonarCloud S6819 asks for. Announced when the cap is REACHED, not once it is exceeded:
        // the clamp above means it can never be exceeded, so this is the only moment to say it.
        <output className={styles.capNotice}>
          {t(
            'reservation_guest_cap_notice',
            'We can seat at most {{max}} guests in one booking. Please contact us for a larger party.',
            { max: maxGuests },
          )}
        </output>
      )}
    </div>
  );
}
