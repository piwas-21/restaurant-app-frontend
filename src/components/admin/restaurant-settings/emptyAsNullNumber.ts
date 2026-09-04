/**
 * A number input whose EMPTY state means "not set", never 0 (#716).
 *
 * `<input type="number">` yields `''` when cleared, and `Number('')` is 0 — so a coerced Zod number
 * turns "the admin removed the coordinate" into "the admin set it to 0". For a latitude/longitude
 * pair that is not a lost preference: **0,0 is a real place**, and `PUT /api/RestaurantInfo` is a
 * full upsert, so the pair is stored.
 *
 * Pairs with `emptyAsNullCoordinate` in `schemas.ts`, and the two are NOT redundant. This keeps the
 * FORM VALUE honest, so what the admin sees, what react-hook-form holds and what is submitted are
 * one value; the schema half makes the CONTRACT honest, so a caller that parses the schema without
 * this registration cannot reintroduce the 0.
 */
export const emptyAsNullNumber = {
  setValueAs: (value: unknown) => (value === '' || value === null || value === undefined ? null : Number(value)),
};
