import type { ProductDetails, Variation } from '@/app/admin/menu-management/interfaces';
import type { MenuDefinitionData } from '@/services/menuBundleService';

export const MENU_VERSION_NAME_MAX_LENGTH = 100;

export const defaultMenuVersionName = (productName: string): string =>
  `Draft menu · ${productName}`.slice(0, MENU_VERSION_NAME_MAX_LENGTH);

export function buildQuickMenuVersionDefinition(product: ProductDetails, variation?: Variation): MenuDefinitionData {
  const variationId = variation?.id ?? null;
  return {
    parentOfferProductId: product.id,
    parentOfferVariationId: variationId,
    isAlwaysAvailable: true,
    startTime: null,
    endTime: null,
    availableMonday: true,
    availableTuesday: true,
    availableWednesday: true,
    availableThursday: true,
    availableFriday: true,
    availableSaturday: true,
    availableSunday: true,
    sections: [
      {
        name: 'Main',
        description: null,
        displayOrder: 0,
        isRequired: true,
        minSelection: 1,
        maxSelection: 1,
        items: [
          {
            productId: product.id,
            productVariationId: variationId,
            additionalPrice: 0,
            displayOrder: 0,
            isDefault: true,
          },
        ],
      },
    ],
  };
}

export function buildQuickMenuVersionPayload(
  product: ProductDetails,
  name: string,
  price: number,
  variation?: Variation,
) {
  const sourceContent =
    product.content && typeof product.content === 'object'
      ? (product.content as Record<string, { name: string; description?: string }>)
      : { en: { name, description: product.description ?? '' } };
  const content = Object.fromEntries(
    Object.entries(sourceContent).map(([language, entry]) => [language, { ...entry, name }]),
  );
  return {
    name,
    description: product.description ?? '',
    basePrice: price,
    // Quick creation persists a clearly labelled, unavailable draft. The full bundle editor is
    // the only place that can complete sections before an admin publishes the offer.
    isActive: false,
    isAvailable: false,
    isSpecial: false,
    type: 'menu' as const,
    preparationTimeMinutes: product.preparationTimeMinutes ?? 0,
    displayOrder: product.displayOrder ?? 0,
    allergens: product.allergens ?? [],
    categoryIds: (product.categories ?? []).map((category) => category.categoryId).filter(Boolean),
    primaryCategoryId:
      product.primaryCategory?.id ?? product.categories.find((category) => category.isPrimary)?.categoryId,
    availableOrderTypes: product.availableOrderTypes ?? null,
    content,
    menuDefinition: buildQuickMenuVersionDefinition(product, variation),
  };
}

export function extractCreatedId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as { id?: unknown; data?: unknown };
  if (typeof value.id === 'string') return value.id;
  if (value.data && typeof value.data === 'object') {
    const nested = value.data as { id?: unknown };
    return typeof nested.id === 'string' ? nested.id : null;
  }
  return null;
}
