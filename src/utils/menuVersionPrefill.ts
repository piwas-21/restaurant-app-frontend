import { z } from 'zod';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { MenuVersionPrefill } from './quickMenuVersionPayload';

export const MENU_VERSION_PREFILL_STORAGE_KEY = 'admin-menu-version-prefill';
/** A handoff is only useful for the navigation that immediately follows the quick-create modal. */
export const MENU_VERSION_PREFILL_TTL_MS = 5 * 60 * 1000;

const nonEmptyId = z.string().trim().min(1, 'An id is required');
const optionalId = nonEmptyId.nullish();

const categorySchema = z.object({
  categoryId: nonEmptyId,
  categoryName: z.string().trim().min(1),
  isPrimary: z.boolean(),
  displayOrder: z.number().int().nonnegative().optional(),
});

const menuItemSchema = z.object({
  id: nonEmptyId,
  productId: nonEmptyId,
  productVariationId: optionalId,
  productName: z.string().optional(),
  additionalPrice: z.number().finite().nonnegative(),
  displayOrder: z.number().int().nonnegative(),
  isDefault: z.boolean(),
});

const menuSectionSchema = z
  .object({
    id: nonEmptyId,
    name: z.string().trim().min(1),
    description: z.string().optional(),
    displayOrder: z.number().int().nonnegative(),
    isRequired: z.boolean(),
    minSelection: z.number().int().nonnegative(),
    maxSelection: z.number().int().positive(),
    items: z.array(menuItemSchema).min(1),
  })
  .superRefine((section, ctx) => {
    if (section.minSelection > section.maxSelection) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['minSelection'], message: 'Minimum exceeds maximum' });
    }
    if (section.maxSelection > section.items.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maxSelection'], message: 'Maximum exceeds item count' });
    }
    if (section.isRequired && section.minSelection < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minSelection'],
        message: 'Required sections need a minimum',
      });
    }
    const itemIds = new Set<string>();
    section.items.forEach((item, index) => {
      if (itemIds.has(item.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'id'], message: 'Item ids must be unique' });
      }
      itemIds.add(item.id);
    });
  });

const menuDefinitionSchema = z
  .object({
    // The definition itself is new during the handoff, so its id is intentionally empty. Nested
    // section/item ids are still required because a missing one means the draft was corrupted.
    id: z.string(),
    parentOfferProductId: nonEmptyId,
    parentOfferVariationId: optionalId,
    isAlwaysAvailable: z.boolean(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    availableMonday: z.boolean(),
    availableTuesday: z.boolean(),
    availableWednesday: z.boolean(),
    availableThursday: z.boolean(),
    availableFriday: z.boolean(),
    availableSaturday: z.boolean(),
    availableSunday: z.boolean(),
    sections: z.array(menuSectionSchema).min(1),
  })
  .superRefine((definition, ctx) => {
    const sectionIds = new Set<string>();
    definition.sections.forEach((section, index) => {
      if (sectionIds.has(section.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sections', index, 'id'],
          message: 'Section ids must be unique',
        });
      }
      sectionIds.add(section.id);
    });
  });

const contentSchema = z.record(
  z.string().trim().min(1),
  z.object({ name: z.string().trim().min(1), description: z.string() }),
);

/** Public so hostile-storage tests and callers can validate without consuming the handoff. */
export const menuVersionPrefillSchema = z
  .object({
    isBundle: z.literal(true),
    name: z.string().trim().min(1).max(100),
    description: z.string(),
    basePrice: z.number().finite().positive(),
    isActive: z.boolean(),
    isAvailable: z.boolean(),
    allergens: z.array(z.string()),
    categories: z.array(categorySchema).min(1),
    primaryCategory: z.object({ id: nonEmptyId, name: z.string().trim().min(1) }).optional(),
    availableOrderTypes: z.number().int().min(1).max(7).nullable(),
    content: contentSchema,
    menuDefinition: menuDefinitionSchema,
  })
  .superRefine((prefill, ctx) => {
    const categoryIds = new Set<string>();
    prefill.categories.forEach((category, index) => {
      if (categoryIds.has(category.categoryId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['categories', index, 'categoryId'],
          message: 'Category ids must be unique',
        });
      }
      categoryIds.add(category.categoryId);
    });
    if (prefill.primaryCategory && !categoryIds.has(prefill.primaryCategory.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primaryCategory', 'id'],
        message: 'Primary category must be selected',
      });
    }
  });

export function isMenuVersionPrefill(value: unknown): value is MenuVersionPrefill {
  return menuVersionPrefillSchema.safeParse(value).success;
}

interface MenuVersionPrefillEnvelope {
  nonce: string;
  expiresAt: number;
  prefill: MenuVersionPrefill;
}

const envelopeSchema = z.object({
  nonce: z.string().trim().min(1),
  expiresAt: z.number().finite(),
  prefill: menuVersionPrefillSchema,
});

const createNonce = (): string => {
  if (typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  if (typeof window !== 'undefined' && typeof window.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

/** Store a validated, expiring handoff without allowing storage failures to create a blank editor. */
export function writeMenuVersionPrefill(prefill: MenuVersionPrefill): boolean {
  if (typeof window === 'undefined' || !isMenuVersionPrefill(prefill)) return false;
  const envelope: MenuVersionPrefillEnvelope = {
    nonce: createNonce(),
    expiresAt: Date.now() + MENU_VERSION_PREFILL_TTL_MS,
    prefill,
  };
  try {
    window.sessionStorage.setItem(MENU_VERSION_PREFILL_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch (error: unknown) {
    console.warn('Could not store menu version handoff', error);
    return false;
  }
}

/**
 * Read and consume only a complete, current envelope. Invalid/expired state is left untouched so
 * a failed read can never destroy a valid handoff before deep validation has completed.
 */
export function consumeMenuVersionPrefill(): MenuVersionPrefill | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(MENU_VERSION_PREFILL_STORAGE_KEY);
  } catch (error: unknown) {
    console.warn('Could not read menu version handoff', error);
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error: unknown) {
    void error;
    return null;
  }
  const envelope = envelopeSchema.safeParse(parsed);
  if (!envelope.success || envelope.data.expiresAt <= Date.now()) return null;
  try {
    window.sessionStorage.removeItem(MENU_VERSION_PREFILL_STORAGE_KEY);
  } catch (error: unknown) {
    console.warn('Could not consume menu version handoff', error);
    return null;
  }
  return envelope.data.prefill;
}

export function productFromMenuVersionPrefill(prefill: MenuVersionPrefill): ProductDetails {
  return {
    id: '',
    name: prefill.name,
    description: prefill.description,
    basePrice: prefill.basePrice,
    isActive: prefill.isActive,
    isAvailable: prefill.isAvailable,
    isSpecial: false,
    preparationTimeMinutes: 0,
    displayOrder: 0,
    type: 'menu',
    ingredients: [],
    allergens: prefill.allergens,
    categories: prefill.categories,
    primaryCategory: prefill.primaryCategory,
    variations: [],
    images: [],
    suggestedSideItems: [],
    availableOrderTypes: prefill.availableOrderTypes,
    content: prefill.content,
    menuDefinition: prefill.menuDefinition,
  };
}
