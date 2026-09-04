/**
 * A number input whose EMPTY state means "not set", not zero (#642).
 *
 * `<input type="number">` yields `''` when cleared, and `Number('')` is 0 — so a coerced Zod number
 * turns "the admin removed the cap" into "the admin set the cap to 0". Those are different
 * statements everywhere it matters: `MembershipQrService:188` applies a group discount's maximum on
 * `HasValue` alone, with no `> 0` guard, so a cap of 0 makes the discount discount nothing.
 *
 * Shared by the two modals that write the same `GroupDiscount` — `DiscountModal` (edit) and
 * `UserGroupModal`'s initial-discount block (create) — because a fix applied to one of them looks
 * complete while the same field one screen away still stores 0.
 *
 * Pairs with `.nullish()` on the schema: this produces the null, and `.nullish()` is what stops the
 * coercion from turning it back into 0.
 */
export const emptyAsNull = {
  setValueAs: (value: unknown) => (value === '' || value === null || value === undefined ? null : Number(value)),
};
