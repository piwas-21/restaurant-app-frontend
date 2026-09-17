import type { ProductDetails, Variation } from '@/app/admin/menu-management/interfaces';
import type { MenuDefinitionData } from '@/services/menuBundleService';

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

export function buildQuickMenuVersionPayload(product: ProductDetails, price: number, variation?: Variation) {
  const content =
    product.content && typeof product.content === 'object'
      ? (product.content as Record<string, { name: string; description?: string }>)
      : { en: { name: product.name, description: product.description ?? '' } };
  return {
    name: `Menu ${product.name}`,
    description: product.description ?? '',
    basePrice: price,
    isActive: true,
    isAvailable: true,
    isSpecial: false,
    type: 'menu' as const,
    preparationTimeMinutes: product.preparationTimeMinutes ?? 0,
    displayOrder: product.displayOrder ?? 0,
    categoryIds: product.categories.map((category) => category.categoryId).filter(Boolean),
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
