import { z } from 'zod';

/**
 * The two halves of a MONEY field, and the three gaps between them (#642).
 *
 * A Zod short-circuit skips a value before it can be coerced. There are three values that mean
 * "not set", and each wrapper skips a different subset of them:
 *
 * | wrapper | `undefined` | `null` | `''` |
 * |---|---|---|---|
 * | `.optional()` | skipped | **coerced -> 0** | **coerced -> 0** |
 * | `.nullish()`  | skipped | skipped | **coerced -> 0** |
 * | this module   | skipped | skipped | skipped |
 *
 * `''` is the one NEITHER wrapper skips, and it is the one every cleared `<input type="number">`
 * produces — so `.nullish()` alone is not sufficient for a coerced number, only for a string.
 * Measured against this repo's own zod, not read from the docs:
 *
 *     z.coerce.number().min(0).optional().safeParse(null)  ->  { success: true, data: 0 }
 *     z.coerce.number().min(0).nullish().safeParse('')     ->  { success: true, data: 0 }
 *
 * All three gaps have the same consequence here: `MembershipQrService` applies a group discount's
 * maximum on `HasValue` alone, so a cap of 0 makes the discount discount nothing.
 *
 * BOTH halves exist because they close the gap at different distances from the defect. The
 * `setValueAs` half keeps the FORM VALUE honest, so what the admin sees, what react-hook-form
 * holds, and what is submitted are one value. The schema half makes the CONTRACT honest, so a
 * caller that parses this schema without the registration — a test, a future page, an importer —
 * cannot reintroduce the 0. Neither is redundant: the widget cannot defend a direct `parse`, and
 * the schema cannot stop the form store from holding `''`.
 */

/**
 * A number input whose EMPTY state means "not set", not zero. Pass as the second argument to
 * `register`, e.g. `register('maximumDiscountAmount', emptyAsNull)`.
 */
export const emptyAsNull = {
  setValueAs: (value: unknown) => (value === '' || value === null || value === undefined ? null : Number(value)),
};

/** `''` / `null` / absent all mean "not set" — never 0. */
export const optionalMoney = () =>
  z.preprocess((value) => (value === '' ? null : value), z.coerce.number().min(0).nullish());

/**
 * A REQUIRED money field, where a blank box must be a refusal rather than a silent 0.
 *
 * `z.coerce.number().min(0)` reads `''` as 0 and accepts it, so clearing a discount's value used to
 * save a discount of 0 — the same "discounts nothing" outcome as a cap of 0, reached from the other
 * end of the form and with no message on screen. The preprocess turns the blank back into "absent"
 * so the field's own required message is what the admin reads.
 */
export const requiredMoney = (message: string) =>
  z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.coerce.number({ required_error: message, invalid_type_error: message }).min(0, { message }),
  );
