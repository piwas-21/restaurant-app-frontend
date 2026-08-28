/**
 * The editor's number-input convention (MENU-ITEM-EDITOR-REDESIGN-PLAN slice **S8**, D7).
 *
 * Before this there were four conventions for the same idea, all inside one form:
 *
 * | field | markup |
 * |---|---|
 * | `basePrice` | `type="number" step="0.01"` |
 * | `variations.N.priceModifier` | `type="number" step="0.01"` |
 * | `preparationTimeMinutes` | `type="number" min="0" step="1"` + `placeholder="0"` |
 * | `variations.N.displayOrder`, an ingredient's quantity | bare `type="number"` |
 *
 * A bare `type="number"` steps by 1, so a price arrow-key'd from 12.50 lands on 13.50, and it
 * offers a phone the full QWERTY keyboard. Two constants replace all four, spread onto the input
 * AFTER `register()` so they cannot be overwritten by it:
 *
 * ```tsx
 * <input {...register('basePrice')} {...MONEY_INPUT_PROPS} />
 * ```
 *
 * `inputMode` is the half that is easy to forget and the half a phone actually reads: `decimal`
 * puts a decimal separator on the keypad, `numeric` does not offer one at all.
 */

/** Money that cannot be negative — a price. */
export const MONEY_INPUT_PROPS = {
  type: 'number',
  inputMode: 'decimal',
  step: '0.01',
  min: '0',
} as const;

/**
 * Money that CAN be negative — a variation's `priceModifier`.
 *
 * The distinction is not pedantry: a *Small* variation is priced BELOW the base item, so
 * `priceModifier` is legitimately `-2.00`, and `variationSchema.priceModifier` is a plain
 * `z.coerce.number()` with no floor precisely because of that. Giving this input `min="0"` would
 * make the browser refuse a value the schema, the API and the menu all accept.
 */
export const SIGNED_MONEY_INPUT_PROPS = {
  type: 'number',
  inputMode: 'decimal',
  step: '0.01',
} as const;

/** A whole count — minutes, a quantity, a display order. */
export const INTEGER_INPUT_PROPS = {
  type: 'number',
  inputMode: 'numeric',
  step: '1',
  min: '0',
} as const;
