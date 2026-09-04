import { z } from 'zod';
import { productTypes } from './types';

/**
 * An optional string as the API really sends it: **absent, or `null`** (frontend #638, the phantom
 * "Fields to fix: 1" defect).
 *
 * `z.string().optional()` accepts `undefined` and REFUSES `null`, and every optional text column on
 * the wire is `string?` in C# — `ProductVariationDto.Description`, `ProductVariationContentDto`'s
 * two fields, `ProductDescriptionDto.Description`. System.Text.Json serialises those as an explicit
 * `null`, and `toItemDefaults` seeds the form from the fetched product verbatim. So a variation with
 * no description made the WHOLE form invalid — `Expected string, received null` — on a field that
 * renders no message, which refused every save with nothing on screen to explain it: the delete of
 * another variation was never sent, and the next fetch brought the deleted row back.
 *
 * `.nullish()` and not a transform to `''`: the payload builders already coalesce (`v.description ??
 * ''`, `isBlank`), so normalising here would be a second, competing answer to the same question.
 */
const optionalText = () => z.string().nullish();

// Zod Schemas for validation
export const variationSchema = z.object({
  id: z.string().optional(), // For edit operations
  /**
   * Provenance for a row picked from the variation library (plan S4).
   *
   * It MUST be declared here even though no input writes it. `z.object()` strips keys it does not
   * know, and `zodResolver` hands `handleSubmit` the PARSED value — so a field that lives only in
   * react-hook-form's store (as `displayOrder` and `id` do, having never had an input either)
   * would be silently dropped between the form and the payload builder.
   */
  // `.nullish()`, not `.optional()`: `ProductVariationDto.GlobalVariationId` is `Guid?` and the API
  // sets no `DefaultIgnoreCondition` (stated at `ApiResponse.cs:26`), so EVERY hand-typed variation
  // — one not taken from the library — arrives as an explicit `null`. `toItemDefaults` seeds the
  // form from that response verbatim, so this was the same save-blocking refusal #638 fixed on
  // `description`, on a field with no input at all.
  globalVariationId: z.string().nullish(),
  name: z.string().min(1, 'Variation name is required'),
  description: optionalText(),
  priceModifier: z.coerce.number(),
  isActive: z.boolean().default(true),
  displayOrder: z.coerce.number().int().default(0),
  // `.nullish()` on the map as well as on its two fields: the map is `Dictionary<…>?` on the wire,
  // and a variation translated to a locale that carries only a name sends `description: null`
  // there — a path with NO input at all since S4, so its refusal could not even be jumped to.
  content: z
    .record(
      z.string(),
      z.object({
        name: optionalText(),
        description: optionalText(),
      }),
    )
    .nullish()
    .transform((value) => value ?? {}),
});

export const contentSchema = z.object({
  language: z.string().min(1, 'Language is required'),
  /**
   * `.trim()` BEFORE `.min(1)` — the client half of backend #325.
   *
   * `min(1)` alone counts `"   "` as three valid characters, so the editor accepted a
   * whitespace-only translation name and `PUT /api/Products/{id}` stored it with a 200. The next
   * ordinary save then DELETED the whole row, description text included: the payload builder drops
   * it (`e?.name?.trim()`) and the handler does a full replace. The server refuses it now, which is
   * what closes the window — this rule cannot constrain a client that is not this editor. What it
   * adds is a sentence on the field instead of a 400 the admin has to decode.
   *
   * It is safe to tighten only because a STORED blank name is repaired on load (`flattenContent`,
   * #641). Tightening without that repair would turn "the item cannot be saved" from a defect into
   * a rule.
   */
  name: z.string().trim().min(1, 'Name is required for this language'),
  description: optionalText(),
});

// Base product schema shared by both create and edit
const baseProductSchema = z.object({
  name: z.string().min(1),
  description: optionalText(),
  basePrice: z.coerce.number().min(0),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  isSpecial: z.boolean().default(false),
  // Withhold the base ("no variation") row on the guest sheet, so the product is ordered as one of
  // its variations (Track F / F2). It must be IN the schema, not merely in the payload: zod strips
  // unknown keys, and the product PUT assigns the column unconditionally — a form that carried the
  // flag outside the schema would clear it on every unrelated save.
  hideBaseProduct: z.boolean().default(false),
  // An OPTION-ONLY item (frontend #631): it exists to be referenced by a bundle section — "choose 2
  // meats out of 6" — and must never appear on the guest menu or be orderable on its own. Same rule
  // as the flag above: it must be IN the schema, not merely in the payload, because zod strips
  // unknown keys and the product PUT assigns the column unconditionally, so a form that carried it
  // outside the schema would clear it on every unrelated save.
  isComponent: z.boolean().default(false),
  type: z.enum(productTypes),
  kitchenType: z.enum(['None', 'FrontKitchen', 'BackKitchen']).default('None'),
  allergens: z.array(z.string()).optional(),
  categoryIds: z.array(z.string()).min(1, 'Select at least one category'),
  primaryCategoryId: z.string().min(1, 'Primary category is required'),
  variations: z.array(variationSchema).default([]),
  content: z
    .array(contentSchema)
    .default([])
    .refine(
      (items) => {
        if (!items) return true;
        const languages = items.map((item) => item.language);
        return new Set(languages).size === languages.length;
      },
      { message: 'Each language can only be used once' },
    ),
  preparationTimeMinutes: z.coerce.number().min(0).default(0),
  suggestedSideItemIds: z.array(z.string()).default([]),
  // Raw OrderChannels mask. `null` = inherit from the primary category; 1..7 = an explicit
  // per-item override. The bounds mirror the server's `ValidOrderChannelMask` — 0 is rejected
  // there because "orderable on no channel" renders as a blocked item with no stateable reason.
  availableOrderTypes: z.number().int().min(1, 'Choose at least one order type').max(7).nullable().default(null),
  // The sauce GROUP rules (SHARED-MODIFIERS-AND-SAUCES-PLAN D9). Product-level, admin-editable, and
  // with NO tenant default: the owner's answer to §7 Q3 is that "one free sauce" is something a
  // restaurant types, never something this code assumes. They must be IN the schema and not merely
  // in the payload — zod strips unknown keys, and `UpdateProductCommand` assigns every column it
  // receives, so a value carried outside the schema is a stored rule cleared by the next save.
  //
  // `sauceMax` is nullable and `null` means NO CAP. `0` is a different, legal statement ("no sauce
  // may be picked"), which is why the empty input must resolve to null rather than fall through
  // `z.coerce.number()` — `Number('')` is 0. `.nullable()` short-circuits before the coercion, so
  // the null arrives intact; the input's `setValueAs` is what produces it (see `SauceGroupRules`).
  sauceMin: z.coerce.number().int().min(0).default(0),
  sauceMax: z.coerce.number().int().min(0).nullable().default(null),
  sauceIncludedFree: z.coerce.number().int().min(0).default(0),
});

/**
 * The two cross-field rules the server also enforces, stated client-side so the admin reads them on
 * the field instead of as a 400 with no field name. Applied per derived schema rather than on
 * `baseProductSchema`: a `superRefine` turns a ZodObject into a ZodEffects, which `.extend()`
 * refuses.
 */
const sauceGroupRules = (
  data: { sauceMin?: number; sauceMax?: number | null; sauceIncludedFree?: number },
  ctx: z.RefinementCtx,
) => {
  const max = data.sauceMax;
  if (max === null || max === undefined) return;
  if ((data.sauceMin ?? 0) > max) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sauceMax'], message: 'Maximum cannot be below the minimum' });
  }
  if ((data.sauceIncludedFree ?? 0) > max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sauceIncludedFree'],
      message: 'More free sauces than the maximum allows',
    });
  }
};

// Menu Definition Schemas
const menuSectionItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  additionalPrice: z.coerce.number().min(0).default(0),
  displayOrder: z.coerce.number().int().default(0),
  isDefault: z.boolean().default(false),
});

const menuSectionSchema = z.object({
  // Both `Guid?` and `string?` on the wire (`MenuSectionDto`), and `toMenuDefinitionState` hands the
  // fetched sections to the form verbatim — so a bundle section saved without a description refused
  // every save of that bundle, exactly as a variation without one did (#638).
  id: z.string().nullish(),
  name: z.string().min(1, 'Section name is required'),
  description: optionalText(),
  displayOrder: z.coerce.number().int().default(0),
  isRequired: z.boolean().default(true),
  minSelection: z.coerce.number().int().min(0).default(1),
  maxSelection: z.coerce.number().int().min(1).default(1),
  items: z.array(menuSectionItemSchema).default([]),
});

const menuDefinitionSchema = z.object({
  id: z.string().nullish(),
  isAlwaysAvailable: z.boolean().default(true),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  availableMonday: z.boolean().default(true),
  availableTuesday: z.boolean().default(true),
  availableWednesday: z.boolean().default(true),
  availableThursday: z.boolean().default(true),
  availableFriday: z.boolean().default(true),
  availableSaturday: z.boolean().default(true),
  availableSunday: z.boolean().default(true),
  sections: z.array(menuSectionSchema).default([]),
});

export const createProductSchema = baseProductSchema.extend({
  menuDefinition: menuDefinitionSchema.optional(),
});

/**
 * What the create RESOLVER runs: the object above plus the two cross-field sauce rules.
 *
 * They are a separate export because `.superRefine` returns a `ZodEffects`, which has neither
 * `.shape` nor `.pick` — and `quickAddItemSchema` picks from the object while
 * `schemas.quickAdd.test.ts` reads its shape to prove the two cannot drift. The form gets the
 * rules; the subset machinery gets the columns.
 */
export const createProductFormSchema = createProductSchema.superRefine(sauceGroupRules);

/**
 * The three things the quick-add modal asks for (MENU-ITEM-EDITOR-REDESIGN-PLAN, D3).
 *
 * Declared as a PICK MASK rather than as a list of field names, so the modal's schema can be
 * derived from the create schema instead of restated beside it. `categoryIds` rides along because
 * one select drives both: the chosen category is the item's only category AND its primary one,
 * which is the same pair the full editor's chip group + primary select produce.
 */
export const QUICK_ADD_ITEM_FIELDS = {
  name: true,
  basePrice: true,
  categoryIds: true,
  primaryCategoryId: true,
} as const;

/**
 * The quick-add modal's schema. `.pick()` and not a fresh `z.object`: it reuses the very same
 * validator instances the full create form runs, so the two cannot drift apart in bounds, in
 * coercion or in message. D3's guard rail ("the quick-add is a strict subset of the full editor")
 * is therefore a property of the code, not a review promise — `schemas.quickAdd.test.ts` asserts
 * the identity, and `quickAddItemPayload.ts` supplies every field this mask leaves out.
 */
export const quickAddItemSchema = createProductSchema.pick(QUICK_ADD_ITEM_FIELDS);

// Dedicated schema for Menu Bundles (cleaner, no redundant fields).
//
// The bounds below mirror MenuBundleCommandValidatorBase, which is STRICTER than the product
// validator: base price must be > 0 (not >= 0), name <= 100 (not 200), description <= 500.
// They were unreachable while every bundle edit 400'd on the product endpoint (#213); now
// that bundles reach /api/Menus, an unbounded field 400s server-side with no field-level
// error surfaced, so the client has to state the same contract.
const baseMenuBundleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').nullish(),
  basePrice: z.coerce.number().gt(0, 'Base price must be greater than 0'),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  isSpecial: z.boolean().default(false),
  type: z.literal('menu'),
  preparationTimeMinutes: z.coerce.number().min(0).default(0),
  displayOrder: z.coerce.number().int().default(0),
  content: z
    .array(contentSchema)
    .default([])
    .refine(
      (items) => {
        if (!items) return true;
        const languages = items.map((item) => item.language);
        return new Set(languages).size === languages.length;
      },
      { message: 'Each language can only be used once' },
    ),
  menuDefinition: menuDefinitionSchema,
  // Same field and same bounds as an item's. It has to be in the schema, not merely in the payload:
  // zod strips unknown keys, so a bundle form that carries the mask outside the schema silently
  // sends nothing — and because the bundle PUT assigns the column unconditionally, "sends nothing"
  // CLEARS a stored restriction on every unrelated save (§9.2).
  availableOrderTypes: z.number().int().min(1, 'Choose at least one order type').max(7).nullable().default(null),
  // Same field as an item's, and in the schema for the same reason as the mask above: zod strips
  // unknown keys, so a value carried outside it is silently dropped — and `productFormUtils`
  // already puts `allergens` into every bundle PUT, so "silently dropped" becomes `[]` on the
  // wire. Once the server reads that field (backend #478) an empty array WIPES the stored
  // labelling on every unrelated save, which for allergens is a safety regression rather than a
  // lost preference: the menu filter reads an unlabelled dish as free of everything.
  allergens: z.array(z.string()).optional(),
});

export const createMenuBundleSchema = baseMenuBundleSchema;

export const editProductSchema = baseProductSchema
  .extend({
    id: z.string().optional(),
    preparationTimeMinutes: z.coerce.number().optional(),
    displayOrder: z.coerce.number().optional(),
    menuDefinition: menuDefinitionSchema.optional(),
  })
  .refine((d) => !d.categoryIds || d.categoryIds.length === 0 || !!d.primaryCategoryId, {
    path: ['primaryCategoryId'],
    message: 'Primary category is required when categories are selected',
  })
  .superRefine(sauceGroupRules);

export const editMenuBundleSchema = baseMenuBundleSchema.extend({
  id: z.string().optional(),
});

export type FormData = z.infer<typeof createProductSchema>;
export type QuickAddItemFormData = z.infer<typeof quickAddItemSchema>;
export type EditFormData = z.infer<typeof editProductSchema>;
export type MenuBundleFormData = z.infer<typeof createMenuBundleSchema>;
export type EditMenuBundleFormData = z.infer<typeof editMenuBundleSchema>;

/**
 * The ONE resolver the unified editor uses, chosen by kind + mode and never swapped.
 *
 * The item schema requires `categoryIds.min(1)` + `primaryCategoryId` (a bundle has neither —
 * `MenuBundleDto` returns no categories); the bundle schema requires a `menuDefinition`; the create
 * schemas add the stricter server bounds a fresh row must meet.
 *
 * It lives beside the four schemas rather than in the hook because the CHOICE is schema knowledge,
 * and because four structurally-different schemas mean the ternary widens past `zodResolver`'s
 * overloads with no single shape for `useForm` to infer — so the caller casts once, here documented
 * once, instead of spreading `as never` across four branches.
 */
export function pickEditorSchema(isBundle: boolean, mode: 'create' | 'edit') {
  if (isBundle) return mode === 'create' ? createMenuBundleSchema : editMenuBundleSchema;
  return mode === 'create' ? createProductFormSchema : editProductSchema;
}
