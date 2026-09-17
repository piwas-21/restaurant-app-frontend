import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { MenuVersionPrefill } from './quickMenuVersionPayload';

export const MENU_VERSION_PREFILL_STORAGE_KEY = 'admin-menu-version-prefill';

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object');

const isPrefill = (value: unknown): value is MenuVersionPrefill => {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    typeof value.basePrice === 'number' &&
    typeof value.isActive === 'boolean' &&
    typeof value.isAvailable === 'boolean' &&
    Array.isArray(value.allergens) &&
    Array.isArray(value.categories) &&
    isRecord(value.menuDefinition) &&
    Array.isArray(value.menuDefinition.sections)
  );
};

export function writeMenuVersionPrefill(prefill: MenuVersionPrefill): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(MENU_VERSION_PREFILL_STORAGE_KEY, JSON.stringify(prefill));
}

export function consumeMenuVersionPrefill(): MenuVersionPrefill | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(MENU_VERSION_PREFILL_STORAGE_KEY);
  window.sessionStorage.removeItem(MENU_VERSION_PREFILL_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPrefill(parsed) ? parsed : null;
  } catch (error: unknown) {
    void error;
    return null;
  }
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
