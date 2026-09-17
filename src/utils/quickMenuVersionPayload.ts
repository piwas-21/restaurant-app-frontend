import type { ProductDetails, ProductCategory, Variation } from '@/app/admin/menu-management/interfaces';
import type { MenuDefinition } from '@/types/menu';

export const MENU_VERSION_NAME_MAX_LENGTH = 100;

export interface MenuVersionPrefill {
  name: string;
  description: string;
  basePrice: number;
  isActive: boolean;
  isAvailable: boolean;
  allergens: string[];
  categories: ProductCategory[];
  primaryCategory?: { id: string; name: string };
  availableOrderTypes: number | null;
  content: Record<string, { name: string; description: string }>;
  menuDefinition: MenuDefinition;
}

export function buildQuickMenuVersionDefinition(
  product: ProductDetails,
  variation: Variation | undefined,
  mainSectionName: string,
): MenuDefinition {
  const variationId = variation?.id ?? null;
  return {
    id: '',
    parentOfferProductId: product.id,
    parentOfferVariationId: variationId,
    isAlwaysAvailable: true,
    startTime: undefined,
    endTime: undefined,
    availableMonday: true,
    availableTuesday: true,
    availableWednesday: true,
    availableThursday: true,
    availableFriday: true,
    availableSaturday: true,
    availableSunday: true,
    sections: [
      {
        id: 'temp-main-section',
        name: mainSectionName,
        description: undefined,
        displayOrder: 0,
        isRequired: true,
        minSelection: 1,
        maxSelection: 1,
        items: [
          {
            id: 'temp-main-item',
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

/** Builds route state for the full bundle editor; no API write occurs here. */
export function buildQuickMenuVersionPrefill(
  product: ProductDetails,
  name: string,
  price: number,
  variation: Variation | undefined,
  mainSectionName: string,
): MenuVersionPrefill {
  const sourceContent =
    product.content && typeof product.content === 'object'
      ? (product.content as Record<string, { name: string; description?: string }>)
      : { en: { name, description: product.description ?? '' } };
  const content = Object.fromEntries(
    Object.entries(sourceContent).map(([language, entry]) => [
      language,
      { name, description: entry.description ?? '' },
    ]),
  );

  return {
    name,
    description: product.description ?? '',
    basePrice: price,
    isActive: product.isActive,
    isAvailable: product.isAvailable,
    allergens: product.allergens ?? [],
    categories: product.categories ?? [],
    primaryCategory: product.primaryCategory,
    availableOrderTypes: product.availableOrderTypes ?? null,
    content,
    menuDefinition: buildQuickMenuVersionDefinition(product, variation, mainSectionName),
  };
}
