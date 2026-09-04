import { z } from 'zod';

/**
 * E.164 validation matches the backend regex (`^\+[1-9]\d{6,14}$`).
 * 8-16 chars, leading `+`, country digit non-zero. Tighter than the spec
 * but blocks country-code-only entries. See backend
 * `PhoneNumberValidation` for rationale.
 */
const e164 = z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format (e.g. +41227863333)');

/**
 * "Not set" for a coerced numeric field: `''` and `null` both mean absent, and neither may become 0.
 *
 * Applied to the schema rather than only to the input registration, and the two are NOT redundant —
 * the widget cannot defend a caller that parses this schema directly (a test, a future page, an
 * importer), and the schema cannot stop react-hook-form's store from holding `''`. Both halves are
 * fixed here; `GeneralSettingsTab` carries the other one.
 */
const emptyAsNullCoordinate = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((value) => (value === '' ? null : value), inner.nullable().default(null));

/** Form data for the singleton fields (no phone numbers — managed separately). */
export const restaurantInfoSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  addressLine1: z.string().min(1, 'Address line 1 is required').max(200),
  addressLine2: z.string().max(200).nullable().default(null),
  city: z.string().min(1, 'City is required').max(100),
  postalCode: z.string().min(1, 'Postal code is required').max(20),
  country: z.string().min(1, 'Country is required').max(100),
  /**
   * Optional coordinates, where CLEARED means "no coordinate" — never 0 (#716).
   *
   * The comment that used to sit here claimed the empty string was coerced to null "at the form
   * layer". It was not: `GeneralSettingsTab` registers both with a plain `register('latitude')` and
   * no `setValueAs`, so the `''` a cleared `<input type="number">` produces reached the schema
   * intact. `.nullable()` short-circuits on `null` and never on `''`, and `Number('')` is 0 —
   * measured, not read from the docs:
   *
   *     restaurantInfoSchema.safeParse({ …valid, latitude: '', longitude: '' })
   *       ->  { latitude: 0, longitude: 0 }
   *
   * And 0,0 is a REAL place. `PUT /api/RestaurantInfo` is a full upsert, so clearing the boxes did
   * not clear the coordinates — it moved the restaurant to 0°N 0°E in the Gulf of Guinea, and left
   * the admin with no way to remove a wrong pair at all: the boxes look empty and the record says 0.
   *
   * A FALSE COMMENT IS HALF THE DEFECT. This one described the fix that was missing, so a reader
   * checking whether the empty string was handled found a sentence saying yes. `website`, four
   * lines below, is the positive control: it really does handle `''`, with
   * `.or(z.literal('').transform(() => null))`.
   *
   * `z.preprocess` and not that `.or(…)` spelling, because these two are COERCED numbers: the union
   * would still let `''` reach `z.coerce.number()` on the other branch. The preprocess runs first,
   * so the empty string never meets the coercion.
   */
  latitude: emptyAsNullCoordinate(z.coerce.number().min(-90).max(90)),
  longitude: emptyAsNullCoordinate(z.coerce.number().min(-180).max(180)),
  email: z.string().min(1, 'Email is required').email('Invalid email address').max(254),
  website: z
    .string()
    .max(2048)
    .url('Must be a valid URL (include https://)')
    .nullable()
    .or(z.literal('').transform(() => null))
    .default(null),
});

// Input = pre-default shape (what RHF stores). Output = post-default
// (what `data` in handleSubmit receives). Splitting these makes the
// useForm<Input> generic match the resolver without an `as any` cast.
export type RestaurantInfoFormInput = z.input<typeof restaurantInfoSchema>;
export type RestaurantInfoFormOutput = z.output<typeof restaurantInfoSchema>;
export type RestaurantInfoFormData = RestaurantInfoFormOutput;

/** Form data for adding / editing a phone number. */
export const phoneNumberSchema = z.object({
  label: z
    .string()
    .max(50)
    .nullable()
    .or(z.literal('').transform(() => null))
    .default(null),
  number: e164,
  whatsAppEnabled: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type PhoneNumberFormInput = z.input<typeof phoneNumberSchema>;
export type PhoneNumberFormOutput = z.output<typeof phoneNumberSchema>;
export type PhoneNumberFormData = PhoneNumberFormOutput;
