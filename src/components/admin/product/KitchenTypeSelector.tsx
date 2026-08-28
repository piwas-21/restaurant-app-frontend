/**
 * Which station prints this item's ticket — section 6, **Service & availability** (plan §4).
 *
 * Rewritten for slice **S8** (D7, design-system debt). What it was: a row of `<button>`s styled by
 * a 12-property inline `style` object per button, with five raw hex values (`#D1D5DB`, `#FFFFFF`,
 * `#000000`, `#6B7280`, `#DC2626`) plus a sixth from `getKitchenTypeColor`, and a bare `<label>`
 * pointing at nothing. Three separate rule violations in one 60-line file — CLAUDE.md §5 forbids
 * inline hex and requires CSS Modules, and §5.8 dark mode never reached it at all, so the control
 * stayed white-on-white in a dark admin panel.
 *
 * Three things changed, and only the middle one is cosmetic:
 *
 * 1. **It is a radio group, not a row of buttons.** Kitchen type is one choice out of three, which
 *    is what a radio IS. Buttons gave every option the same "click me" affordance with no announced
 *    selected state and no group name — a screen reader read three unrelated buttons. Now: a
 *    `fieldset` + `legend` names the group, each option is a real `<input type="radio">` with its
 *    own `<label>`, and arrow-key navigation is the browser's, not ours. This closes part of #592
 *    (`label` / `select-name`) for this control.
 * 2. **Tokens, not hex.** Selected reads `--brand-primary` with `--text-on-primary` on top, which is
 *    the same fill the approved screen draws for the selected segment of *Kitchen printer* — see
 *    `service_availability_detail_margherita_pizza`. The per-kitchen blue/red is deliberately GONE:
 *    the screen colours by SELECTION, not by which kitchen, no other surface in the app colour-codes
 *    a kitchen type, and the two hues were this widget's own invention. Every token here already
 *    carries a `[data-theme='dark']` override, so dark mode arrives with the rewrite rather than
 *    needing a block of its own.
 * 3. **`getKitchenTypeColor` is deleted with its file.** `src/utils/kitchenTypeDisplay.ts` existed
 *    for this component; its other two exports (`getKitchenTypeLabel`, `getKitchenTypeOptions`) had
 *    no caller at all. S8 is the dead-controls slice, and a util whose last consumer just stopped
 *    calling it is dead code by the same argument.
 *
 * NOT changed: the value, the i18n keys, the `Controller` wiring or the payload. `kitchenType` is
 * registered exactly as it was.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { KitchenType, KITCHEN_TYPES } from '@/types/menu';
import styles from './KitchenTypeSelector.module.css';

interface KitchenTypeSelectorProps {
  readonly value: KitchenType | undefined;
  readonly onChange: (kitchenType: KitchenType) => void;
  readonly disabled?: boolean;
  readonly error?: string;
}

const ERROR_ID = 'product-field-kitchenType-error';

export default function KitchenTypeSelector({ value, onChange, disabled = false, error }: KitchenTypeSelectorProps) {
  const { t } = useTranslation();

  return (
    <fieldset
      className={styles.fieldset}
      // On the FIELDSET rather than on each radio: "no kitchen type chosen" is a property of the
      // group, and marking three inputs invalid makes a screen reader say it three times.
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? ERROR_ID : undefined}
    >
      <legend className={styles.legend}>{t('kitchen_type', 'Kitchen Type')}</legend>

      <div className={styles.segments}>
        {(Object.keys(KITCHEN_TYPES) as KitchenType[]).map((key) => {
          const id = `product-kitchen-type-${key.toLowerCase()}`;
          return (
            <div key={key} className={styles.segment}>
              {/* The input is visually hidden but NOT `display:none` — a hidden-by-display radio is
                  removed from the tab order and from the accessibility tree, which would undo the
                  whole point of using radios. It stays focusable, and `.label` draws the focus
                  ring for it via `:focus-visible +`. */}
              <input
                className={styles.input}
                type="radio"
                id={id}
                name="product-kitchen-type"
                value={key}
                checked={value === key}
                disabled={disabled}
                onChange={() => onChange(key)}
              />
              <label className={styles.label} htmlFor={id}>
                {t(`kitchen_type_${key.toLowerCase()}`, KITCHEN_TYPES[key].label)}
              </label>
            </div>
          );
        })}
      </div>

      {error && (
        <p id={ERROR_ID} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
